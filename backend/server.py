# pyrefly: ignore [missing-import]
import sys
import calendar
import os
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager

# Support running as PyInstaller bundle OR from source
if getattr(sys, 'frozen', False):
    # Running as backend.exe — .env is bundled next to the executable
    ROOT_DIR = Path(sys.executable).parent
else:
    ROOT_DIR = Path(__file__).parent

load_dotenv(ROOT_DIR / '.env')

import io
import csv
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field, EmailStr
from openpyxl import Workbook


from contextvars import ContextVar

# ------- Mongo -------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
master_db = client["pos_master"]
default_db_name = os.environ.get('DB_NAME', 'pos')

tenant_db_ctx: ContextVar = ContextVar("tenant_db_ctx", default=client[default_db_name])

class DBProxy:
    def __getattr__(self, name):
        return tenant_db_ctx.get()[name]

db = DBProxy()

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

# ------- Helpers -------
def now_utc() -> datetime: return datetime.now(timezone.utc)
def iso(dt: datetime) -> str: return dt.isoformat()
def new_id() -> str: return str(uuid.uuid4())
def hash_password(p: str) -> str: return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
def verify_password(p: str, h: str) -> bool: return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str, tenant_id: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "tenant_id": tenant_id,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        print("Auth failed: No token provided in cookies or header")
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        print("Auth failed: Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"Auth failed: Invalid token - {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await master_db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        print(f"Auth failed: User not found in DB for sub {payload.get('sub')}")
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep


# ------- Models -------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RestaurantSettings(BaseModel):
    name: str = "Thali House"
    address: str = ""
    gstin: str = ""
    phone: str = ""
    gst_rate: float = 5.0
    footer_msg: str = "Thank you for dining with us!"
    show_gst: bool = True
    show_payment: bool = True
    show_thali_selections: bool = False
    paper_width: int = 80
    font_size: str = "medium"
    header_alignment: str = "center"
    header_template: str = "classic"
    auto_print: bool = True
    receipt_prefix: str = ""
    receipt_padding: int = 6
    tax_label: str = "GST"
    language: str = "en"


class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0


class ThaliGroup(BaseModel):
    category_id: str
    label: str = ""
    count: int = 1


class MenuItemIn(BaseModel):
    name: str
    category_id: str
    price: float
    available: bool = True
    is_thali: bool = False
    thali_groups: List[ThaliGroup] = Field(default_factory=list)
    thali_extras: str = ""
    portion_weight_kg: float = 0.0


class TemplateIn(BaseModel):
    name: str
    item_ids: List[str]


class ThaliSelections(BaseModel):
    # category_id -> list of selected item names
    by_category: Dict[str, List[str]] = Field(default_factory=dict)


class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    qty: int
    tax_rate: float = 5.0
    is_thali: bool = False
    thali_selections: Optional[Dict[str, List[str]]] = None
    thali_extras: str = ""


class OrderIn(BaseModel):
    items: List[OrderItem]
    discount: float = 0.0
    payment_mode: Literal["cash", "card", "upi"] = "cash"
    notes: str = ""


# ------- Inventory Models -------
class SupplierIn(BaseModel):
    name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    gstin: str = ""


class StockAdjustmentIn(BaseModel):
    product_id: str
    qty_change: int
    reason: Literal["damage", "loss", "correction", "count", "other"] = "correction"
    remarks: str = ""


class PurchaseOrderItemIn(BaseModel):
    product_id: str
    product_name: str = ""
    qty: int
    unit_cost: float


class PurchaseOrderIn(BaseModel):
    supplier_id: str
    items: List[PurchaseOrderItemIn]
    notes: str = ""


class GoodsReceivedItemIn(BaseModel):
    product_id: str
    qty_received: int


class GoodsReceivedIn(BaseModel):
    items: List[GoodsReceivedItemIn]
    notes: str = ""


class MenuItemInventoryUpdate(BaseModel):
    current_stock: Optional[int] = None
    reorder_level: int = 10
    min_stock: int = 5
    max_stock: int = 1000
    sku: Optional[str] = None
    barcode: Optional[str] = None
    unit_cost: float = 0.0
    location_id: str = "main"


# ------- Inventory Helpers -------
async def _record_inventory_transaction(
    product_id: str, qty_change: int, tx_type: str,
    reference_id: str = "", user_id: str = "", remarks: str = "",
    location_id: str = "main",
):
    """Record every stock change in the audit ledger."""
    tx = {
        "id": new_id(),
        "product_id": product_id,
        "qty_change": qty_change,
        "type": tx_type,  # sale, purchase, return, adjustment, damage, transfer
        "reference_id": reference_id,
        "user_id": user_id,
        "remarks": remarks,
        "location_id": location_id,
        "created_at": iso(now_utc()),
    }
    await db.inventory_transactions.insert_one(tx.copy())
    return tx


async def _create_stock_alert(product_id: str, product_name: str, current_stock: int, threshold: int):
    """Create a low-stock or out-of-stock alert if one doesn't already exist (unresolved)."""
    alert_type = "out_of_stock" if current_stock <= 0 else "low_stock"
    existing = await db.stock_alerts.find_one({
        "product_id": product_id, "alert_type": alert_type, "is_resolved": False,
    })
    if existing:
        await db.stock_alerts.update_one(
            {"id": existing["id"]},
            {"$set": {"current_stock": current_stock, "updated_at": iso(now_utc())}},
        )
        return existing
    alert = {
        "id": new_id(),
        "product_id": product_id,
        "product_name": product_name,
        "alert_type": alert_type,
        "current_stock": current_stock,
        "threshold": threshold,
        "is_read": False,
        "is_resolved": False,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    }
    await db.stock_alerts.insert_one(alert.copy())
    return alert


async def _update_stock_and_record(product_id: str, qty_change: float, tx_type: str,
                                    reference_id: str = "", user_id: str = "", remarks: str = ""):
    """Atomically update stock on a menu item and record the transaction."""
    item = await db.menu.find_one({"id": product_id})
    if not item or item.get("current_stock") is None:
        return None  # inventory not tracked for this item
    
    qty_change = round(qty_change, 3)
    new_stock = max(0.0, round(item["current_stock"] + qty_change, 3))
    
    await db.menu.update_one({"id": product_id}, {"$set": {"current_stock": new_stock}})
    tx = await _record_inventory_transaction(
        product_id=product_id, qty_change=qty_change, tx_type=tx_type,
        reference_id=reference_id, user_id=user_id, remarks=remarks,
    )
    reorder = item.get("reorder_level", 10)
    if new_stock <= reorder:
        await _create_stock_alert(product_id, item["name"], new_stock, reorder)
    elif new_stock > reorder:
        # auto-resolve any existing alerts for this product
        await db.stock_alerts.update_many(
            {"product_id": product_id, "is_resolved": False},
            {"$set": {"is_resolved": True, "updated_at": iso(now_utc())}},
        )
    return {"new_stock": new_stock, "transaction": tx}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index("email", unique=True)
    await db.menu.create_index("id", unique=True)
    await db.categories.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("receipt_no")
    # Inventory indexes
    await db.inventory_transactions.create_index("id", unique=True)
    await db.inventory_transactions.create_index("product_id")
    await db.inventory_transactions.create_index("created_at")
    await db.suppliers.create_index("id", unique=True)
    await db.purchase_orders.create_index("id", unique=True)
    await db.stock_adjustments.create_index("id", unique=True)
    await db.stock_alerts.create_index("id", unique=True)
    await db.stock_alerts.create_index("product_id")
    await seed_defaults()

    creds_dir = Path("/app/memory")
    try:
        creds_dir.mkdir(exist_ok=True)
    except OSError:
        creds_dir = Path(__file__).parent.parent / "memory"
        creds_dir.mkdir(exist_ok=True)
    (creds_dir / "test_credentials.md").write_text(
        "# Thali POS Test Credentials\n\n"
        f"- Owner (admin): {os.environ.get('ADMIN_EMAIL', 'admin@pos.com')} / {os.environ.get('ADMIN_PASSWORD', 'admin123')}\n"
        "- Cashier: cashier@pos.com / cashier123\n\n"
        "Auth endpoints: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout\n"
    )
    yield
    client.close()


# ------- App -------
app = FastAPI(title="Thali POS", lifespan=lifespan)

@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    tenant_id = request.query_params.get("tenant_id")
    if not tenant_id:
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                tenant_id = payload.get("tenant_id")
            except Exception:
                pass
    
    if not tenant_id:
        tenant_id = "default"
    
    db_name = default_db_name if tenant_id == "default" else f"pos_{tenant_id}"
    token_ctx = tenant_db_ctx.set(client[db_name])
    
    try:
        response = await call_next(request)
    finally:
        tenant_db_ctx.reset(token_ctx)
    return response

api = APIRouter(prefix="/api")


# ------- Auth -------
class SignupIn(BaseModel):
    email: EmailStr
    password: str
    restaurant_name: str


@api.post("/auth/signup")
async def signup(body: SignupIn):
    email = body.email.lower()
    existing = await master_db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    tenant_id = new_id()
    user_id = new_id()
    
    # Create master user
    await master_db.users.insert_one({
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": "Owner",
        "role": "admin",
        "tenant_id": tenant_id,
        "created_at": iso(now_utc())
    })
    
    # Create tenant record
    await master_db.tenants.insert_one({
        "tenant_id": tenant_id,
        "restaurant_name": body.restaurant_name,
        "created_at": iso(now_utc())
    })
    
    # Initialize Tenant DB settings
    tenant_db = client[f"pos_{tenant_id}"]
    await tenant_db.settings.insert_one({
        "id": "restaurant",
        "name": body.restaurant_name,
        "address": "", "gstin": "", "phone": "", "gst_rate": 5.0,
        "footer_msg": "Thank you for dining with us!",
        "auto_print": False, "tax_label": "GST", "language": "en"
    })
    
    return {"ok": True, "tenant_id": tenant_id}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await master_db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    tenant_id = user.get("tenant_id", "default")
    token = create_access_token(user["id"], user["email"], user["role"], tenant_id)
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=12 * 3600, path="/",
    )
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "tenant_id": tenant_id}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


@api.post("/auth/change-password")
async def change_password(body: PasswordChangeIn, user=Depends(get_current_user)):
    """Change user password. Requires current password for verification."""
    # Verify current password
    db_user = await master_db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(body.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    # Don't allow reusing default password
    if body.new_password == "admin123":
        raise HTTPException(status_code=400, detail="Cannot use default password")
    
    # Update password
    new_hash = hash_password(body.new_password)
    await master_db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"ok": True, "message": "Password changed successfully"}


# ------- Staff Accounts -------
class StaffIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "cashier"


@api.get("/staff", dependencies=[Depends(require_roles("admin"))])
async def list_staff(user=Depends(get_current_user)):
    tenant_id = user.get("tenant_id", "default")
    cursor = master_db.users.find({"tenant_id": tenant_id}, {"_id": 0, "password_hash": 0})
    users = await cursor.to_list(100)
    
    profiles = await db.staff_profiles.find({}, {"_id": 0}).to_list(500)
    profile_map = {p["user_id"]: p for p in profiles}
    
    structures = await db.employees_salary_structure.find({}, {"_id": 0}).to_list(500)
    structure_map = {s["employee_id"]: s for s in structures}
    
    for u in users:
        p = profile_map.get(u["id"], {})
        s = structure_map.get(u["id"], {})
        # ensure employee_id alias for frontend
        u["employee_id"] = u["id"]
        for k, v in p.items():
            if k not in u:
                u[k] = v
        # Defaults if no profile
        if "status" not in u: u["status"] = "Active"
        if "designation" not in u: u["designation"] = ""
        if "department" not in u: u["department"] = ""
        
        # Merge salary details for frontend display
        u["salary_wage_type"] = s.get("wage_type", "Fixed")
        u["salary_basic"] = s.get("basic_salary", 0)
        u["salary_hourly_rate"] = s.get("hourly_rate", 0)
        
    return users


@api.post("/staff", dependencies=[Depends(require_roles("admin"))])
async def create_staff(body: StaffIn, user=Depends(get_current_user)):
    tenant_id = user.get("tenant_id", "default")
    email = body.email.lower()
    
    existing = await master_db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user_id = new_id()
    await master_db.users.insert_one({
        "id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "tenant_id": tenant_id,
        "created_at": iso(now_utc())
    })
    
    await db.staff_profiles.insert_one({
        "user_id": user_id,
        "designation": "",
        "department": "",
        "joining_date": iso(now_utc())[:10],
        "employment_type": "Full-Time",
        "bank_name": "", "bank_account": "", "ifsc_code": "",
        "pan_number": "", "uan_number": "", "status": "Active",
        "mobile_number": "", "emergency_contact": "", "address": ""
    })
    
    await db.employees_salary_structure.insert_one({
        "id": new_id(), "employee_id": user_id, 
        "wage_type": "Fixed", "basic_salary": 0, "hra": 0, "conveyance": 0, "medical": 0, "special_allowance": 0,
        "pf_deduction": 0, "esi_deduction": 0, "professional_tax": 0, "hourly_rate": 0
    })
    
    return {"ok": True, "id": user_id}

@api.put("/staff/{user_id}", dependencies=[Depends(require_roles("admin"))])
async def update_staff(user_id: str, body: dict, user=Depends(get_current_user)):
    tenant_id = user.get("tenant_id", "default")
    user_updates = {}
    if "name" in body: user_updates["name"] = body["name"]
    if "role" in body: user_updates["role"] = body["role"]
    if "email" in body: user_updates["email"] = body["email"]
    
    if user_updates:
        await master_db.users.update_one({"id": user_id, "tenant_id": tenant_id}, {"$set": user_updates})
        
    profile_updates = {k: v for k, v in body.items() if k not in ["id", "password", "email", "name", "role", "created_at", "tenant_id", "password_hash", "employee_id", "user_id"]}
    if profile_updates:
        await db.staff_profiles.update_one({"user_id": user_id}, {"$set": profile_updates}, upsert=True)
        
    return {"ok": True}

@api.delete("/staff/{user_id}", dependencies=[Depends(require_roles("admin"))])
async def delete_staff(user_id: str, user=Depends(get_current_user)):
    tenant_id = user.get("tenant_id", "default")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    result = await master_db.users.delete_one({"id": user_id, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    # Also delete profile & salary struct
    await db.staff_profiles.delete_one({"user_id": user_id})
    await db.employees_salary_structure.delete_one({"employee_id": user_id})
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ------- Settings -------
@api.get("/settings")
async def get_settings(_: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "restaurant"}, {"_id": 0})
    if not s:
        s = {"id": "restaurant", **RestaurantSettings().model_dump()}
        await db.settings.insert_one(s.copy())
    else:
        # Backward-compatible upgrade: merge defaults for any newly introduced settings fields
        s = {**RestaurantSettings().model_dump(), **s}
    return s


@api.put("/settings")
async def update_settings(body: RestaurantSettings, _: dict = Depends(require_roles("admin"))):
    await db.settings.update_one(
        {"id": "restaurant"},
        {"$set": body.model_dump()},
        upsert=True,
    )
    s = await db.settings.find_one({"id": "restaurant"}, {"_id": 0})
    return s


# ------- Categories -------
@api.get("/categories")
async def list_categories(_: dict = Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)


@api.post("/categories")
async def create_category(body: CategoryIn, _: dict = Depends(require_roles("admin"))):
    obj = {"id": new_id(), **body.model_dump()}
    await db.categories.insert_one(obj.copy())
    return obj


@api.delete("/categories/{cid}")
async def delete_category(cid: str, _: dict = Depends(require_roles("admin"))):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ------- Menu -------
@api.get("/menu")
async def list_menu(_: dict = Depends(get_current_user)):
    return await db.menu.find({}, {"_id": 0}).to_list(2000)


@api.post("/menu")
async def create_menu(body: MenuItemIn, _: dict = Depends(require_roles("admin"))):
    obj = {"id": new_id(), **body.model_dump()}
    await db.menu.insert_one(obj.copy())
    return obj


@api.put("/menu/{mid}")
async def update_menu(mid: str, body: MenuItemIn, _: dict = Depends(require_roles("admin"))):
    await db.menu.update_one({"id": mid}, {"$set": body.model_dump()})
    return await db.menu.find_one({"id": mid}, {"_id": 0})


@api.patch("/menu/{mid}/toggle")
async def toggle_menu(mid: str, _: dict = Depends(get_current_user)):
    item = await db.menu.find_one({"id": mid}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Not found")
    new_val = not item.get("available", True)
    await db.menu.update_one({"id": mid}, {"$set": {"available": new_val}})
    return {"ok": True, "available": new_val}


@api.delete("/menu/{mid}")
async def delete_menu(mid: str, _: dict = Depends(require_roles("admin"))):
    await db.menu.delete_one({"id": mid})
    return {"ok": True}


# ------- Templates (Daily Menu snapshots) -------
@api.get("/templates")
async def list_templates(_: dict = Depends(get_current_user)):
    return await db.templates.find({}, {"_id": 0}).to_list(100)


@api.post("/templates")
async def create_template(body: TemplateIn, _: dict = Depends(require_roles("admin"))):
    obj = {"id": new_id(), **body.model_dump(), "created_at": iso(now_utc())}
    await db.templates.insert_one(obj.copy())
    return obj


@api.post("/templates/{tid}/activate")
async def activate_template(tid: str, _: dict = Depends(require_roles("admin"))):
    tpl = await db.templates.find_one({"id": tid}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Template not found")
    active_ids = set(tpl["item_ids"])
    items = await db.menu.find({}, {"_id": 0}).to_list(2000)
    for it in items:
        await db.menu.update_one({"id": it["id"]}, {"$set": {"available": it["id"] in active_ids}})
    return {"ok": True, "activated": len(active_ids)}


@api.delete("/templates/{tid}")
async def delete_template(tid: str, _: dict = Depends(require_roles("admin"))):
    await db.templates.delete_one({"id": tid})
    return {"ok": True}


# ------- Orders -------
def _compute_totals(items: list, discount: float) -> dict:
    subtotal = sum(i["price"] * i["qty"] for i in items)
    tax = sum((i["price"] * i["qty"]) * (i.get("tax_rate", 5.0) / 100) for i in items)
    total = max(0.0, round(subtotal + tax - discount, 2))
    return {"subtotal": round(subtotal, 2), "tax": round(tax, 2), "total": total}


async def _next_receipt_number() -> int:
    res = await db.counters.find_one_and_update(
        {"id": "receipt"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return res["value"]


@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    items = [i.model_dump() for i in body.items]
    if not items:
        raise HTTPException(400, "Cart is empty")
    
    # Apply configured GST rate from settings to items that use the default 5%
    s = await db.settings.find_one({"id": "restaurant"})
    gst_rate = s.get("gst_rate", 5.0) if s else 5.0
    for item in items:
        if item.get("tax_rate") is None or item.get("tax_rate") == 5.0:
            item["tax_rate"] = gst_rate

    totals = _compute_totals(items, body.discount)
    rn = await _next_receipt_number()
    ts = iso(now_utc())
    order = {
        "id": new_id(),
        "receipt_no": rn,
        "items": items,
        "subtotal": totals["subtotal"],
        "tax": totals["tax"],
        "discount": body.discount,
        "total": totals["total"],
        "payment_mode": body.payment_mode,
        "notes": body.notes,
        "created_at": ts,
        "paid_at": ts,
        "cashier_email": user.get("email"),
        "cashier_name": user.get("name"),
    }
    await db.orders.insert_one(order.copy())

    # --- Inventory hook: decrement stock for each sold item ---
    for item in items:
        mid = item.get("menu_item_id")
        if not mid: continue
        
        qty = item.get("qty", 1)
        menu_item = await db.menu.find_one({"id": mid})
        if not menu_item: continue
        
        pw_kg = menu_item.get("portion_weight_kg", 0.0)

        if item.get("is_thali") and item.get("thali_selections"):
            # Deduct for the base thali item itself (either by weight or per piece)
            deduction = (qty * pw_kg) if pw_kg > 0 else qty
            await _update_stock_and_record(
                product_id=mid, qty_change=-deduction, tx_type="sale",
                reference_id=order["id"], user_id=user.get("id", ""),
                remarks=f"Sale #{order['receipt_no']} (Thali Base)"
            )
            # Deduct for each selected sub-item
            thali_sel = item.get("thali_selections", {})
            if isinstance(thali_sel, dict):
                selections_dict = thali_sel.get("by_category", thali_sel)
                for group, sub_items in selections_dict.items():
                    if isinstance(sub_items, list):
                        for sub_item_name in sub_items:
                            # find the item by name to get its portion weight
                            sub_db_item = await db.menu.find_one({"name": sub_item_name})
                            if sub_db_item:
                                sub_pw = sub_db_item.get("portion_weight_kg", 0.0)
                                sub_deduction = (qty * sub_pw) if sub_pw > 0 else qty
                                await _update_stock_and_record(
                                    product_id=sub_db_item["id"], 
                                    qty_change=-sub_deduction, 
                                    tx_type="sale",
                                    reference_id=order["id"], user_id=user.get("id", ""),
                                    remarks=f"Sale #{order['receipt_no']} (Thali Selection)"
                                )
        else:
            # Standard item
            deduction = (qty * pw_kg) if pw_kg > 0 else qty
            await _update_stock_and_record(
                product_id=mid, qty_change=-deduction, tx_type="sale",
                reference_id=order["id"], user_id=user.get("id", ""),
                remarks=f"Sale #{order['receipt_no']}"
            )

    return order


@api.get("/orders")
async def list_orders(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user.get("role") == "cashier":
        query["cashier_email"] = user.get("email")
    # Note: paid_at is stored as a uniform ISO-8601 UTC string (from iso(now_utc()))
    # which allows correct lexicographical sorting and range comparison ($gte/$lte)
    # in MongoDB without needing native datetime conversions.
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date
        query["paid_at"] = rng
    if q:
        # search by receipt no (numeric) or partial id
        try:
            rn = int(q)
            query["$or"] = [{"receipt_no": rn}, {"id": {"$regex": q, "$options": "i"}}]
        except ValueError:
            query["id"] = {"$regex": q, "$options": "i"}
    cursor = db.orders.find(query, {"_id": 0}).sort("paid_at", -1).limit(limit)
    return await cursor.to_list(limit)


@api.get("/orders/{oid}")
async def get_order(oid: str, _: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    return o


# ------- Dashboard -------
def _day_range(days_back: int):
    end = now_utc()
    start = end - timedelta(days=days_back)
    return iso(start), iso(end)


def _today_range():
    today = now_utc().date()
    start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)
    return iso(start), iso(end)


async def _orders_in_range(start_iso: str, end_iso: str) -> list:
    return await db.orders.find(
        {"paid_at": {"$gte": start_iso, "$lte": end_iso}},
        {"_id": 0},
    ).to_list(20000)


def _agg_top_items(orders: list, only_thali: bool = False, top: int = 5) -> list:
    counter: Dict[str, int] = {}
    rev: Dict[str, float] = {}
    for o in orders:
        for it in o.get("items", []):
            if only_thali and not it.get("is_thali"): continue
            if (not only_thali) and it.get("is_thali"): continue
            name = it["name"]
            counter[name] = counter.get(name, 0) + it["qty"]
            rev[name] = rev.get(name, 0.0) + (it["price"] * it["qty"])
    out = sorted(counter.items(), key=lambda x: -x[1])[:top]
    return [{"name": n, "qty": q, "revenue": round(rev[n], 2)} for n, q in out]


def _agg_payment_breakdown(orders: list) -> dict:
    out = {"cash": 0.0, "card": 0.0, "upi": 0.0}
    for o in orders:
        m = o.get("payment_mode", "cash")
        if m in out:
            out[m] += o.get("total", 0)
    return {k: round(v, 2) for k, v in out.items()}


@api.get("/dashboard/summary")
async def dashboard_summary(_: dict = Depends(get_current_user)):
    today_s, today_e = _today_range()
    week_s, _w = _day_range(7)
    month_s, _m = _day_range(30)

    today_orders = await _orders_in_range(today_s, today_e)
    week_orders = await _orders_in_range(week_s, iso(now_utc()))
    month_orders = await _orders_in_range(month_s, iso(now_utc()))

    def kpi(orders):
        total = sum(o.get("total", 0) for o in orders)
        count = len(orders)
        return {
            "revenue": round(total, 2),
            "orders": count,
            "avg": round(total / count, 2) if count else 0.0,
        }

    # Last 7-day daily series
    series = []
    for i in range(6, -1, -1):
        day = (now_utc() - timedelta(days=i)).date()
        ds = iso(datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc))
        de = iso(datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc))
        day_orders = [o for o in week_orders if ds <= o.get("paid_at", "") <= de]
        series.append({
            "date": day.isoformat(),
            "revenue": round(sum(o.get("total", 0) for o in day_orders), 2),
            "orders": len(day_orders),
        })

    return {
        "today": kpi(today_orders),
        "week": kpi(week_orders),
        "month": kpi(month_orders),
        "series": series,
        "top_items_today": _agg_top_items(today_orders, only_thali=False),
        "top_items_week": _agg_top_items(week_orders, only_thali=False),
        "top_items_month": _agg_top_items(month_orders, only_thali=False),
        "top_thalis_today": _agg_top_items(today_orders, only_thali=True),
        "top_thalis_week": _agg_top_items(week_orders, only_thali=True),
        "top_thalis_month": _agg_top_items(month_orders, only_thali=True),
        "payment_today": _agg_payment_breakdown(today_orders),
        "payment_week": _agg_payment_breakdown(week_orders),
        "payment_month": _agg_payment_breakdown(month_orders),
    }


# ------- Reports -------
async def _reports_orders(from_date: Optional[str], to_date: Optional[str]) -> list:
    fd = from_date or iso(now_utc() - timedelta(days=30))
    td = to_date or iso(now_utc())
    return await _orders_in_range(fd, td)


@api.get("/reports/sales")
async def report_sales(from_date: Optional[str] = None, to_date: Optional[str] = None, _: dict = Depends(get_current_user)):
    return await _reports_orders(from_date, to_date)


@api.get("/reports/products")
async def report_products(from_date: Optional[str] = None, to_date: Optional[str] = None, _: dict = Depends(get_current_user)):
    orders = await _reports_orders(from_date, to_date)
    return _agg_top_items(orders, only_thali=False, top=1000)


@api.get("/reports/thalis")
async def report_thalis(from_date: Optional[str] = None, to_date: Optional[str] = None, _: dict = Depends(get_current_user)):
    orders = await _reports_orders(from_date, to_date)
    by_name = _agg_top_items(orders, only_thali=True, top=1000)
    # also aggregate which sabji/dal selections were popular
    pick_counter: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            if not it.get("is_thali"): continue
            for _cat, names in (it.get("thali_selections") or {}).items():
                for n in names:
                    pick_counter[n] = pick_counter.get(n, 0) + it["qty"]
    top_picks = [{"name": n, "qty": q} for n, q in sorted(pick_counter.items(), key=lambda x: -x[1])[:50]]
    return {"thalis": by_name, "selection_picks": top_picks}


def _build_xlsx(rows: list, headers: list) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_csv(rows: list, headers: list) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode("utf-8")


@api.get("/reports/export/{rtype}.{fmt}")
async def export_report(
    rtype: Literal["sales", "products", "thalis"],
    fmt: Literal["csv", "xlsx"],
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    orders = await _reports_orders(from_date, to_date)

    if rtype == "sales":
        headers = ["Receipt #", "Date", "Items", "Subtotal", "Tax", "Discount", "Total", "Payment", "Cashier"]
        rows = []
        for o in orders:
            items_txt = "; ".join(f"{i['name']} x{i['qty']}" for i in o.get("items", []))
            rows.append([
                o.get("receipt_no", ""),
                o.get("paid_at", ""),
                items_txt,
                o.get("subtotal", 0),
                o.get("tax", 0),
                o.get("discount", 0),
                o.get("total", 0),
                o.get("payment_mode", ""),
                o.get("cashier_name", ""),
            ])
    elif rtype == "products":
        agg = _agg_top_items(orders, only_thali=False, top=1000)
        headers = ["Product", "Qty Sold", "Revenue (Rs)"]
        rows = [[a["name"], a["qty"], a["revenue"]] for a in agg]
    else:  # thalis
        agg = _agg_top_items(orders, only_thali=True, top=1000)
        headers = ["Thali", "Qty Sold", "Revenue (Rs)"]
        rows = [[a["name"], a["qty"], a["revenue"]] for a in agg]

    fname = f"{rtype}_{(from_date or 'all')[:10]}_{(to_date or 'now')[:10]}.{fmt}"
    if fmt == "xlsx":
        data = _build_xlsx(rows, headers)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        data = _build_csv(rows, headers)
        media = "text/csv"

    return StreamingResponse(
        iter([data]),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ------- Health -------
@api.get("/")
async def root():
    return {"ok": True, "service": "Thali POS"}


# ------- Seed -------
async def _seed_users():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@pos.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await master_db.users.find_one({"email": admin_email})
    if not existing:
        await master_db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Owner",
            "role": "admin", "password_hash": hash_password(admin_pw),
            "tenant_id": "default",
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await master_db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    if not await master_db.users.find_one({"email": "cashier@pos.com"}):
        await master_db.users.insert_one({
            "id": new_id(), "email": "cashier@pos.com", "name": "Cashier",
            "role": "cashier", "password_hash": hash_password("cashier123"),
            "tenant_id": "default",
            "created_at": iso(now_utc()),
        })


async def _seed_settings():
    if await db.settings.find_one({"id": "restaurant"}):
        return
    await db.settings.insert_one({
        "id": "restaurant",
        "name": "Anndevta Thali House",
        "address": "12, MG Road, Bengaluru 560001",
        "gstin": "29ABCDE1234F1Z5",
        "phone": "+91 98765 43210",
        "gst_rate": 5.0,
        "footer_msg": "Thank you! Please visit again.",
        "show_gst": True,
        "show_payment": True,
        "show_thali_selections": False,
        "paper_width": 80,
        "font_size": "medium",
        "header_alignment": "center",
        "header_template": "classic",
        "auto_print": True,
        "receipt_prefix": "",
        "receipt_padding": 6,
        "tax_label": "GST",
        "language": "en",
    })


async def _seed_categories() -> dict:
    if await db.categories.count_documents({}) == 0:
        for c in [
            {"name": "Thali", "sort_order": 1},
            {"name": "Sabji", "sort_order": 2},
            {"name": "Dal", "sort_order": 3},
            {"name": "Rice", "sort_order": 4},
            {"name": "Bread", "sort_order": 5},
            {"name": "Drinks", "sort_order": 6},
        ]:
            await db.categories.insert_one({"id": new_id(), **c})
    rows = await db.categories.find({}, {"_id": 0}).to_list(20)
    return {c["name"]: c["id"] for c in rows}


def _thali_seed_rows(cat_lookup: dict) -> list:
    return [
        {
            "name": "Regular Thali", "price": 150,
            "thali_groups": [
                {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 2},
                {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
            ],
            "thali_extras": "Roti (4), Rice, Salad, Papad, Buttermilk",
        },
        {
            "name": "Mini Thali", "price": 100,
            "thali_groups": [
                {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 1},
                {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
            ],
            "thali_extras": "Roti (2), Rice, Salad",
        },
        {
            "name": "Special Thali", "price": 220,
            "thali_groups": [
                {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 2},
                {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
                {"category_id": cat_lookup.get("Rice"), "label": "Rice", "count": 1},
            ],
            "thali_extras": "Roti (4), Sweet, Salad, Papad, Pickle, Buttermilk",
        },
    ]


def _alacarte_seed_rows() -> dict:
    return {
        "Sabji": [("Paneer Masala", 120), ("Mix Veg", 90), ("Bhindi Fry", 100), ("Aloo Matar", 90), ("Chana Masala", 95)],
        "Dal": [("Dal Tadka", 80), ("Dal Fry", 80), ("Dal Makhani", 110)],
        "Rice": [("Jeera Rice", 90), ("Steamed Rice", 60)],
        "Bread": [("Roti", 15), ("Butter Roti", 20), ("Butter Naan", 50), ("Garlic Naan", 60)],
        "Drinks": [("Buttermilk", 30), ("Masala Chai", 25), ("Fresh Lime", 40)],
    }


async def _seed_menu(cat_lookup: dict):
    if await db.menu.count_documents({}) > 0:
        return
    for t in _thali_seed_rows(cat_lookup):
        await db.menu.insert_one({
            "id": new_id(), "category_id": cat_lookup["Thali"], "available": True,
            "is_thali": True, **t,
        })
    for cat_name, rows in _alacarte_seed_rows().items():
        for n, p in rows:
            await db.menu.insert_one({
                "id": new_id(), "name": n, "category_id": cat_lookup[cat_name],
                "price": p, "available": True, "is_thali": False,
                "thali_groups": [], "thali_extras": "",
            })


async def seed_defaults():
    await _seed_users()
    await _seed_settings()
    cat_lookup = await _seed_categories()
    await _seed_menu(cat_lookup)



# ======= INVENTORY MODULE =======

# ------- Inventory Dashboard -------
@api.get("/inventory/dashboard")
async def inventory_dashboard(_: dict = Depends(require_roles("admin"))):
    """Aggregated inventory KPIs."""
    all_items = await db.menu.find({}, {"_id": 0}).to_list(5000)
    tracked = [i for i in all_items if i.get("current_stock") is not None]
    total_value = sum((i.get("current_stock", 0) * (i.get("unit_cost") or i.get("price") or 0)) for i in tracked)
    low_stock = [i for i in tracked if 0 < i.get("current_stock", 0) <= i.get("reorder_level", 10)]
    out_of_stock = [i for i in tracked if i.get("current_stock", 0) <= 0]

    # Recent activity
    recent_txns = await db.inventory_transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)

    # Unread alerts
    alerts = await db.stock_alerts.find({"is_resolved": False}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)

    # Top moving products (by total absolute qty_change in last 30 days)
    cutoff = iso(now_utc() - timedelta(days=30))
    recent_sales = await db.inventory_transactions.find(
        {"type": "sale", "created_at": {"$gte": cutoff}}, {"_id": 0}
    ).to_list(10000)
    move_counter: Dict[str, int] = {}
    for tx in recent_sales:
        pid = tx["product_id"]
        move_counter[pid] = move_counter.get(pid, 0) + abs(tx.get("qty_change", 0))
    top_movers_ids = sorted(move_counter.items(), key=lambda x: -x[1])[:10]
    top_movers = []
    for pid, qty in top_movers_ids:
        item = await db.menu.find_one({"id": pid}, {"_id": 0, "name": 1, "current_stock": 1})
        if item:
            top_movers.append({"name": item["name"], "qty_sold": round(qty, 3), "current_stock": item.get("current_stock")})

    # Today's Consumption
    today_start = iso(now_utc().replace(hour=0, minute=0, second=0, microsecond=0))
    today_sales = await db.inventory_transactions.find(
        {"type": "sale", "created_at": {"$gte": today_start}}
    ).to_list(10000)
    todays_consumption = round(sum(abs(tx.get("qty_change", 0)) for tx in today_sales), 3)

    # Unmapped items
    unmapped_items_count = sum(1 for i in all_items if i.get("portion_weight_kg", 0) <= 0)

    return {
        "total_value": round(total_value, 2),
        "total_products": len(tracked),
        "low_stock_count": len(low_stock),
        "out_of_stock_count": len(out_of_stock),
        "low_stock_items": [{"id": i["id"], "name": i["name"], "current_stock": i.get("current_stock", 0), "reorder_level": i.get("reorder_level", 10)} for i in low_stock[:10]],
        "out_of_stock_items": [{"id": i["id"], "name": i["name"]} for i in out_of_stock[:10]],
        "recent_activity": recent_txns,
        "alerts": alerts,
        "top_movers": top_movers,
        "todays_consumption_kg": todays_consumption,
        "unmapped_items_count": unmapped_items_count
    }


# ------- Stock Management -------
@api.get("/inventory/stock")
async def list_stock(
    q: Optional[str] = None,
    status: Optional[str] = None,  # all, low, out, in_stock
    _: dict = Depends(require_roles("admin")),
):
    """All products with stock levels."""
    query = {}
    items = await db.menu.find(query, {"_id": 0}).to_list(5000)
    # Enrich with stock status
    result = []
    for it in items:
        stock = it.get("current_stock")
        reorder = it.get("reorder_level", 10)
        if stock is None:
            stock_status = "untracked"
        elif stock <= 0:
            stock_status = "out_of_stock"
        elif stock <= reorder:
            stock_status = "low_stock"
        else:
            stock_status = "in_stock"
        it["stock_status"] = stock_status
        # Filter
        if status and status != "all" and stock_status != status:
            continue
        if q:
            ql = q.lower()
            if not (ql in it.get("name", "").lower() or ql in (it.get("sku") or "").lower() or ql in (it.get("barcode") or "").lower()):
                continue
        result.append(it)
    return result


@api.patch("/inventory/stock/{mid}")
async def update_inventory_fields(mid: str, body: MenuItemInventoryUpdate, _: dict = Depends(require_roles("admin"))):
    """Update inventory fields for a menu item."""
    update_data = body.model_dump()
    await db.menu.update_one({"id": mid}, {"$set": update_data})
    updated = await db.menu.find_one({"id": mid}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Product not found")
    return updated


class StockChangeIn(BaseModel):
    qty: int
    remarks: str = ""


@api.post("/inventory/stock/{mid}/add")
async def add_stock(mid: str, body: StockChangeIn, user: dict = Depends(require_roles("admin"))):
    """Add stock to a product."""
    if body.qty <= 0:
        raise HTTPException(400, "Quantity must be positive")
    result = await _update_stock_and_record(
        product_id=mid, qty_change=body.qty, tx_type="adjustment",
        user_id=user.get("id", ""), remarks=body.remarks or "Manual stock addition",
    )
    if result is None:
        # Item not tracked yet, enable tracking
        item = await db.menu.find_one({"id": mid})
        if not item:
            raise HTTPException(404, "Product not found")
        await db.menu.update_one({"id": mid}, {"$set": {"current_stock": body.qty}})
        tx = await _record_inventory_transaction(
            product_id=mid, qty_change=body.qty, tx_type="adjustment",
            user_id=user.get("id", ""), remarks=body.remarks or "Initial stock entry",
        )
        return {"new_stock": body.qty, "transaction": tx}
    return result


@api.post("/inventory/stock/{mid}/remove")
async def remove_stock(mid: str, body: StockChangeIn, user: dict = Depends(require_roles("admin"))):
    """Remove stock from a product."""
    if body.qty <= 0:
        raise HTTPException(400, "Quantity must be positive")
    result = await _update_stock_and_record(
        product_id=mid, qty_change=-body.qty, tx_type="adjustment",
        user_id=user.get("id", ""), remarks=body.remarks or "Manual stock removal",
    )
    if result is None:
        raise HTTPException(400, "Inventory not tracked for this product")
    return result


@api.post("/inventory/adjust")
async def adjust_stock(body: StockAdjustmentIn, user: dict = Depends(require_roles("admin"))):
    """Manual stock adjustment with full audit."""
    item = await db.menu.find_one({"id": body.product_id})
    if not item:
        raise HTTPException(404, "Product not found")
    old_stock = item.get("current_stock", 0) or 0
    new_stock = max(0, old_stock + body.qty_change)
    await db.menu.update_one({"id": body.product_id}, {"$set": {"current_stock": new_stock}})
    # Record adjustment doc
    adj = {
        "id": new_id(),
        "product_id": body.product_id,
        "qty_before": old_stock,
        "qty_after": new_stock,
        "qty_change": body.qty_change,
        "reason": body.reason,
        "user_id": user.get("id", ""),
        "remarks": body.remarks,
        "created_at": iso(now_utc()),
    }
    await db.stock_adjustments.insert_one(adj.copy())
    tx_type = "damage" if body.reason in ("damage", "loss") else "adjustment"
    await _record_inventory_transaction(
        product_id=body.product_id, qty_change=body.qty_change, tx_type=tx_type,
        reference_id=adj["id"], user_id=user.get("id", ""),
        remarks=f"{body.reason}: {body.remarks}",
    )
    # Check alerts
    reorder = item.get("reorder_level", 10)
    if new_stock <= reorder:
        await _create_stock_alert(body.product_id, item["name"], new_stock, reorder)
    return {"adjustment": adj, "new_stock": new_stock}


# ------- Inventory Transactions Ledger -------
@api.get("/inventory/transactions")
async def list_inventory_transactions(
    product_id: Optional[str] = None,
    tx_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200,
    _: dict = Depends(require_roles("admin")),
):
    query = {}
    if product_id:
        query["product_id"] = product_id
    if tx_type:
        query["type"] = tx_type
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date
        query["created_at"] = rng
    txns = await db.inventory_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    # Enrich with product name
    product_cache = {}
    for tx in txns:
        pid = tx.get("product_id")
        if pid and pid not in product_cache:
            p = await db.menu.find_one({"id": pid}, {"_id": 0, "name": 1})
            product_cache[pid] = p.get("name", "Unknown") if p else "Deleted"
        tx["product_name"] = product_cache.get(pid, "Unknown")
    return txns


# ------- Stock Alerts -------
@api.get("/inventory/alerts")
async def list_alerts(resolved: Optional[bool] = None, _: dict = Depends(require_roles("admin"))):
    query = {}
    if resolved is not None:
        query["is_resolved"] = resolved
    return await db.stock_alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)


@api.get("/inventory/alerts/count")
async def alert_count(_: dict = Depends(get_current_user)):
    """Unread alert count for nav badge."""
    count = await db.stock_alerts.count_documents({"is_resolved": False, "is_read": False})
    return {"count": count}


@api.patch("/inventory/alerts/{aid}/read")
async def mark_alert_read(aid: str, _: dict = Depends(require_roles("admin"))):
    await db.stock_alerts.update_one({"id": aid}, {"$set": {"is_read": True}})
    return {"ok": True}


@api.patch("/inventory/alerts/{aid}/resolve")
async def resolve_alert(aid: str, _: dict = Depends(require_roles("admin"))):
    await db.stock_alerts.update_one({"id": aid}, {"$set": {"is_resolved": True, "updated_at": iso(now_utc())}})
    return {"ok": True}


# ------- Suppliers -------
@api.get("/inventory/suppliers")
async def list_suppliers(_: dict = Depends(require_roles("admin"))):
    return await db.suppliers.find({"is_active": {"$ne": False}}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/inventory/suppliers")
async def create_supplier(body: SupplierIn, _: dict = Depends(require_roles("admin"))):
    obj = {"id": new_id(), **body.model_dump(), "is_active": True, "created_at": iso(now_utc())}
    await db.suppliers.insert_one(obj.copy())
    return obj


@api.put("/inventory/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, _: dict = Depends(require_roles("admin"))):
    await db.suppliers.update_one({"id": sid}, {"$set": body.model_dump()})
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})


@api.delete("/inventory/suppliers/{sid}")
async def delete_supplier(sid: str, _: dict = Depends(require_roles("admin"))):
    """Soft delete."""
    await db.suppliers.update_one({"id": sid}, {"$set": {"is_active": False}})
    return {"ok": True}


# ------- Purchase Orders -------
@api.get("/inventory/purchase-orders")
async def list_purchase_orders(
    status: Optional[str] = None,
    _: dict = Depends(require_roles("admin")),
):
    query = {}
    if status and status != "all":
        query["status"] = status
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    # Enrich with supplier name
    for po in pos:
        sup = await db.suppliers.find_one({"id": po.get("supplier_id")}, {"_id": 0, "name": 1})
        po["supplier_name"] = sup["name"] if sup else "Unknown"
    return pos


async def _next_po_number() -> int:
    res = await db.counters.find_one_and_update(
        {"id": "purchase_order"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return res["value"]


@api.post("/inventory/purchase-orders")
async def create_purchase_order(body: PurchaseOrderIn, user: dict = Depends(require_roles("admin"))):
    po_num = await _next_po_number()
    total = sum(i.qty * i.unit_cost for i in body.items)
    items_data = []
    for i in body.items:
        d = i.model_dump()
        if not d.get("product_name"):
            p = await db.menu.find_one({"id": d["product_id"]}, {"_id": 0, "name": 1})
            d["product_name"] = p["name"] if p else "Unknown"
        items_data.append(d)
    po = {
        "id": new_id(),
        "po_number": po_num,
        "supplier_id": body.supplier_id,
        "items": items_data,
        "status": "draft",
        "total_amount": round(total, 2),
        "notes": body.notes,
        "created_by": user.get("id", ""),
        "created_at": iso(now_utc()),
        "ordered_at": None,
        "received_at": None,
    }
    await db.purchase_orders.insert_one(po.copy())
    return po


@api.get("/inventory/purchase-orders/{pid}")
async def get_purchase_order(pid: str, _: dict = Depends(require_roles("admin"))):
    po = await db.purchase_orders.find_one({"id": pid}, {"_id": 0})
    if not po:
        raise HTTPException(404, "Purchase order not found")
    sup = await db.suppliers.find_one({"id": po.get("supplier_id")}, {"_id": 0, "name": 1})
    po["supplier_name"] = sup["name"] if sup else "Unknown"
    return po


class POStatusUpdate(BaseModel):
    status: Literal["draft", "ordered", "partial", "received", "cancelled"]


@api.patch("/inventory/purchase-orders/{pid}/status")
async def update_po_status(pid: str, body: POStatusUpdate, _: dict = Depends(require_roles("admin"))):
    update_data = {"status": body.status}
    if body.status == "ordered":
        update_data["ordered_at"] = iso(now_utc())
    elif body.status == "received":
        update_data["received_at"] = iso(now_utc())
    await db.purchase_orders.update_one({"id": pid}, {"$set": update_data})
    return await db.purchase_orders.find_one({"id": pid}, {"_id": 0})


@api.post("/inventory/purchase-orders/{pid}/receive")
async def receive_goods(pid: str, body: GoodsReceivedIn, user: dict = Depends(require_roles("admin"))):
    """GRN — Receive goods against a PO, auto-increase stock."""
    po = await db.purchase_orders.find_one({"id": pid}, {"_id": 0})
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po["status"] == "cancelled":
        raise HTTPException(400, "Cannot receive goods for a cancelled PO")

    results = []
    for gi in body.items:
        result = await _update_stock_and_record(
            product_id=gi.product_id, qty_change=gi.qty_received, tx_type="purchase",
            reference_id=pid, user_id=user.get("id", ""),
            remarks=f"PO #{po['po_number']}: {body.notes}",
        )
        if result is None:
            # Enable tracking on first receive
            item = await db.menu.find_one({"id": gi.product_id})
            if item:
                await db.menu.update_one({"id": gi.product_id}, {"$set": {"current_stock": gi.qty_received}})
                await _record_inventory_transaction(
                    product_id=gi.product_id, qty_change=gi.qty_received, tx_type="purchase",
                    reference_id=pid, user_id=user.get("id", ""),
                    remarks=f"PO #{po['po_number']}: {body.notes}",
                )
                result = {"new_stock": gi.qty_received}
        results.append({"product_id": gi.product_id, "qty_received": gi.qty_received, **(result or {})})

    await db.purchase_orders.update_one({"id": pid}, {"$set": {"status": "received", "received_at": iso(now_utc())}})
    return {"po_id": pid, "results": results}


# ------- Inventory Reports -------
@api.get("/inventory/reports/current-stock")
async def report_current_stock(_: dict = Depends(require_roles("admin"))):
    items = await db.menu.find({"current_stock": {"$ne": None}}, {"_id": 0}).to_list(5000)
    return [{"id": i["id"], "name": i["name"], "sku": i.get("sku", ""), "barcode": i.get("barcode", ""),
             "category_id": i.get("category_id", ""), "current_stock": i.get("current_stock", 0),
             "reorder_level": i.get("reorder_level", 10), "unit_cost": i.get("unit_cost", 0),
             "price": i.get("price", 0),
             "stock_value": round(i.get("current_stock", 0) * (i.get("unit_cost") or i.get("price") or 0), 2),
             } for i in items]


@api.get("/inventory/reports/valuation")
async def report_valuation(_: dict = Depends(require_roles("admin"))):
    items = await db.menu.find({"current_stock": {"$ne": None}}, {"_id": 0}).to_list(5000)
    rows = []
    total_cost = 0.0
    total_retail = 0.0
    for i in items:
        cost_val = i.get("current_stock", 0) * (i.get("unit_cost") or i.get("price") or 0)
        retail_val = i.get("current_stock", 0) * (i.get("price") or 0)
        total_cost += cost_val
        total_retail += retail_val
        rows.append({"id": i["id"], "name": i["name"], "current_stock": i.get("current_stock", 0),
                     "unit_cost": i.get("unit_cost", 0), "price": i.get("price", 0),
                     "cost_value": round(cost_val, 2), "retail_value": round(retail_val, 2)})
    return {"items": rows, "total_cost_value": round(total_cost, 2), "total_retail_value": round(total_retail, 2)}


@api.get("/inventory/reports/movement")
async def report_movement(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _: dict = Depends(require_roles("admin")),
):
    fd = from_date or iso(now_utc() - timedelta(days=30))
    td = to_date or iso(now_utc())
    txns = await db.inventory_transactions.find(
        {"created_at": {"$gte": fd, "$lte": td}}, {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    # Aggregate by product
    by_product: Dict[str, dict] = {}
    for tx in txns:
        pid = tx["product_id"]
        if pid not in by_product:
            p = await db.menu.find_one({"id": pid}, {"_id": 0, "name": 1, "current_stock": 1})
            by_product[pid] = {"product_id": pid, "name": p.get("name", "?") if p else "Deleted",
                               "current_stock": p.get("current_stock", 0) if p else 0,
                               "total_in": 0, "total_out": 0, "net": 0}
        chg = tx.get("qty_change", 0)
        if chg > 0:
            by_product[pid]["total_in"] += chg
        else:
            by_product[pid]["total_out"] += abs(chg)
        by_product[pid]["net"] += chg
    return list(by_product.values())


@api.get("/inventory/reports/low-stock")
async def report_low_stock(_: dict = Depends(require_roles("admin"))):
    items = await db.menu.find({"current_stock": {"$ne": None}}, {"_id": 0}).to_list(5000)
    low = [i for i in items if i.get("current_stock", 0) <= i.get("reorder_level", 10)]
    return [{"id": i["id"], "name": i["name"], "current_stock": i.get("current_stock", 0),
             "reorder_level": i.get("reorder_level", 10), "min_stock": i.get("min_stock", 5),
             "deficit": max(0, i.get("reorder_level", 10) - i.get("current_stock", 0))} for i in low]


@api.get("/inventory/reports/dead-stock")
async def report_dead_stock(
    days: int = 30,
    _: dict = Depends(require_roles("admin")),
):
    """Items with zero sales in the given period."""
    cutoff = iso(now_utc() - timedelta(days=days))
    sold_txns = await db.inventory_transactions.find(
        {"type": "sale", "created_at": {"$gte": cutoff}}, {"_id": 0, "product_id": 1}
    ).to_list(10000)
    sold_ids = set(tx["product_id"] for tx in sold_txns)
    tracked = await db.menu.find({"current_stock": {"$ne": None}}, {"_id": 0}).to_list(5000)
    dead = [i for i in tracked if i["id"] not in sold_ids and i.get("current_stock", 0) > 0]
    return [{"id": i["id"], "name": i["name"], "current_stock": i.get("current_stock", 0),
             "unit_cost": i.get("unit_cost", 0),
             "stock_value": round(i.get("current_stock", 0) * (i.get("unit_cost") or i.get("price") or 0), 2),
             "days_no_sale": days} for i in dead]


@api.get("/inventory/reports/purchases")
async def report_purchases(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _: dict = Depends(require_roles("admin")),
):
    query: dict = {}
    if from_date or to_date:
        rng = {}
        if from_date: rng["$gte"] = from_date
        if to_date: rng["$lte"] = to_date
        query["created_at"] = rng
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for po in pos:
        sup = await db.suppliers.find_one({"id": po.get("supplier_id")}, {"_id": 0, "name": 1})
        po["supplier_name"] = sup["name"] if sup else "Unknown"
    return pos


@api.get("/inventory/reports/export/{rtype}.{fmt}")
async def export_inventory_report(
    rtype: Literal["current-stock", "valuation", "low-stock", "dead-stock", "movement", "purchases"],
    fmt: Literal["csv", "xlsx"],
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _: dict = Depends(require_roles("admin")),
):
    if rtype == "current-stock":
        data = await report_current_stock(_)
        headers = ["Name", "SKU", "Barcode", "Stock", "Reorder Level", "Unit Cost", "Price", "Stock Value"]
        rows = [[d["name"], d["sku"], d["barcode"], d["current_stock"], d["reorder_level"],
                 d["unit_cost"], d["price"], d["stock_value"]] for d in data]
    elif rtype == "valuation":
        data = await report_valuation(_)
        headers = ["Name", "Stock", "Unit Cost", "Price", "Cost Value", "Retail Value"]
        rows = [[d["name"], d["current_stock"], d["unit_cost"], d["price"],
                 d["cost_value"], d["retail_value"]] for d in data["items"]]
    elif rtype == "low-stock":
        data = await report_low_stock(_)
        headers = ["Name", "Current Stock", "Reorder Level", "Min Stock", "Deficit"]
        rows = [[d["name"], d["current_stock"], d["reorder_level"], d["min_stock"], d["deficit"]] for d in data]
    elif rtype == "dead-stock":
        data = await report_dead_stock(days=30, _=_)
        headers = ["Name", "Current Stock", "Unit Cost", "Stock Value", "Days No Sale"]
        rows = [[d["name"], d["current_stock"], d["unit_cost"], d["stock_value"], d["days_no_sale"]] for d in data]
    elif rtype == "movement":
        data = await report_movement(from_date=from_date, to_date=to_date, _=_)
        headers = ["Name", "Current Stock", "Total In", "Total Out", "Net"]
        rows = [[d["name"], d["current_stock"], d["total_in"], d["total_out"], d["net"]] for d in data]
    else:  # purchases
        data = await report_purchases(from_date=from_date, to_date=to_date, _=_)
        headers = ["PO #", "Supplier", "Status", "Total", "Created", "Received"]
        rows = [[d.get("po_number"), d.get("supplier_name"), d.get("status"),
                 d.get("total_amount"), d.get("created_at", ""), d.get("received_at", "")] for d in data]

    fname = f"inventory_{rtype}_{(from_date or 'all')[:10]}_{(to_date or 'now')[:10]}.{fmt}"
    if fmt == "xlsx":
        file_data = _build_xlsx(rows, headers)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        file_data = _build_csv(rows, headers)
        media = "text/csv"

    return StreamingResponse(
        iter([file_data]),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos")


@api.post("/backup/create")
async def create_backup(_user=Depends(require_roles("admin"))):
    """Create a complete backup of all collections."""
    import json
    from datetime import datetime
    
    backup_data = {
        "timestamp": iso(now_utc()),
        "version": "1.0.0",
        "collections": {}
    }
    
    # Backup all collections
    collections = ["users", "settings", "categories", "menu", "templates", "orders", "counters",
                   "inventory_transactions", "suppliers", "purchase_orders", "stock_adjustments", "stock_alerts"]
    for coll_name in collections:
        docs = await db[coll_name].find().to_list(None)
        # Convert ObjectId and datetime to strings for JSON serialization
        for doc in docs:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
        backup_data["collections"][coll_name] = docs
    
    # Return as JSON string
    json_str = json.dumps(backup_data, indent=2, default=str)
    return Response(content=json_str, media_type="application/json")


@api.post("/backup/restore")
async def restore_backup(request: Request, _user=Depends(require_roles("admin"))):
    """Restore database from backup file."""
    import json
    
    body = await request.body()
    backup_data = json.loads(body.decode("utf-8"))
    
    # Validate backup structure
    if "collections" not in backup_data or "timestamp" not in backup_data:
        raise HTTPException(status_code=400, detail="Invalid backup file format")
    
    # Restore each collection
    for coll_name, docs in backup_data["collections"].items():
        if coll_name in ["users", "settings", "categories", "menu", "templates", "orders", "counters",
                         "inventory_transactions", "suppliers", "purchase_orders", "stock_adjustments", "stock_alerts"]:
            # Clear existing data
            await db[coll_name].delete_many({})
            # Insert backup data
            if docs:
                await db[coll_name].insert_many(docs)
    
    return {"status": "success", "restored_at": iso(now_utc()), "backup_timestamp": backup_data["timestamp"]}


@api.get("/backup/last")
async def get_last_backup(_user=Depends(require_roles("admin"))):
    """Get last backup timestamp from settings or local storage."""
    # For now, return null - frontend will track this in localStorage
    return {"last_backup": None}


@app.get("/api/health")
async def health_check():
    """Lightweight liveness probe used by the Electron main process."""
    return {"status": "ok", "version": "1.0.0"}



# ==========================================
# PAYROLL & HR MODULE MODELS
# ==========================================

class EmployeeIn(BaseModel):
    user_id: Optional[str] = None
    full_name: str
    photo_url: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    emergency_contact: Optional[str] = ""
    designation: str
    department: str
    joining_date: str
    employment_type: Literal["Full-Time", "Part-Time", "Contract"]
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    ifsc_code: Optional[str] = ""
    pan_number: Optional[str] = ""
    aadhaar_number: Optional[str] = ""
    uan_number: Optional[str] = ""
    notes: Optional[str] = ""
    status: Literal["Active", "Inactive"] = "Active"

class SalaryStructureIn(BaseModel):
    wage_type: Literal["Fixed", "Hourly"] = "Fixed"
    basic_salary: float = 0
    hra: float = 0
    conveyance: float = 0
    medical: float = 0
    special_allowance: float = 0
    pf_deduction: float = 0
    esi_deduction: float = 0
    professional_tax: float = 0
    hourly_rate: float = 0

class AttendanceRecordIn(BaseModel):
    employee_id: str
    date: str  # YYYY-MM-DD
    status: Literal["Present", "Absent", "Half-Day", "Leave", "Holiday"]
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    overtime_hours: float = 0
    late_mark: bool = False

class AttendanceBulkIn(BaseModel):
    records: List[AttendanceRecordIn]

class LeaveRequestIn(BaseModel):
    employee_id: str
    type: Literal["Casual Leave", "Sick Leave", "Paid Leave", "Unpaid Leave"]
    start_date: str
    end_date: str
    reason: str
    status: Literal["Pending", "Approved", "Rejected"] = "Pending"

class BiometricSyncIn(BaseModel):
    device_id: str
    employee_id: str
    timestamp: str # ISO string
    scan_type: Literal["check-in", "check-out"]

class SalaryAdvanceIn(BaseModel):
    employee_id: str
    amount: float
    emi_amount: float
    reason: str
    status: Literal["Pending", "Approved", "Rejected"] = "Pending"

class PayrollProcessIn(BaseModel):
    month: int
    year: int

class PayrollStatusUpdate(BaseModel):
    status: Literal["Draft", "Approved", "Paid", "Partial"]
    payment_mode: Optional[str] = None
    transaction_id: Optional[str] = None

class ItemPaymentIn(BaseModel):
    amount: float
    payment_mode: str

class DirectPaymentIn(BaseModel):
    employee_id: str
    amount: float
    payment_mode: str
    notes: str

# ==========================================
# PAYROLL & HR MODULE API ROUTES
# ==========================================

@api.get("/payroll/dashboard")
async def get_payroll_dashboard(user=Depends(require_roles("admin"))):
    tenant_id = user.get("tenant_id", "default")
    all_users = await master_db.users.count_documents({"tenant_id": tenant_id})
    active_emps = all_users # Simplifying: assume all tenant users are active unless profiled otherwise
    
    now = datetime.now()
    month, year = now.month, now.year
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1

    last_payroll = await db.payrolls.find_one({"month": prev_month, "year": prev_year})
    last_cost = last_payroll.get("total_net_pay", 0) if last_payroll else 0
    pending_payouts = await db.payrolls.count_documents({"status": {"$in": ["Draft", "Approved"]}})
    
    today_str = now.strftime("%Y-%m-%d")
    att_today = await db.attendance.find({"date": today_str}).to_list(None)
    present_today = sum(1 for a in att_today if a["status"] == "Present")
    absent_today = sum(1 for a in att_today if a["status"] == "Absent")
    
    # If no attendance yet today, absent_today might just be 0 instead of active_emps. 
    # For a realistic dashboard, absent is either explicitly marked or (active - present). We'll stick to explicit + implied.
    implicit_absent = active_emps - len(att_today)
    total_absent_today = absent_today + (implicit_absent if implicit_absent > 0 else 0)

    # Advances
    advances = await db.salary_advances.find({"balance": {"$gt": 0}, "status": "Approved"}).to_list(None)
    outstanding_advances = sum(a["balance"] for a in advances)

    
    # Get employee balances from latest payroll run
    latest_run = await db.payrolls.find_one({}, sort=[("created_at", -1)])
    employee_balances = []
    if latest_run:
        items = await db.payroll_items.find({"payroll_id": latest_run["id"]}).to_list(None)
        for item in items:
            status = "Paid" if latest_run["status"] == "Paid" else "Pending"
            # In a real system partial payments would be calculated here
            employee_balances.append({
                "id": item.get("employee_id"),
                "name": item.get("employee_name"),
                "gross": item.get("gross_pay", 0),
                "advances": item.get("advance_deduction", 0),
                "deductions": item.get("deductions", 0) + item.get("penalties", 0),
                "outstanding": item.get("net_pay", 0),
                "status": status
            })

    return {
        "active_employees": active_emps,
        "last_month_cost": last_cost,
        "pending_payouts": pending_payouts,
        "present_today": present_today,
        "absent_today": total_absent_today,
        "outstanding_advances": outstanding_advances,
        "employee_balances": employee_balances
    }



@api.get("/payroll/employees/{emp_id}/structure")
async def get_salary_structure(emp_id: str, _=Depends(require_roles("admin"))):
    struct = await db.employees_salary_structure.find_one({"employee_id": emp_id}, {"_id": 0})
    if not struct:
        raise HTTPException(404, "Structure not found")
    return struct

@api.put("/payroll/employees/{emp_id}/structure")
async def update_salary_structure(emp_id: str, body: SalaryStructureIn, _=Depends(require_roles("admin"))):
    await db.employees_salary_structure.update_one({"employee_id": emp_id}, {"$set": body.model_dump()}, upsert=True)
    return {"status": "success"}

@api.get("/payroll/attendance")
async def get_attendance(date: str, _=Depends(require_roles("admin"))):
    records = await db.attendance_records.find({"date": date}, {"_id": 0}).to_list(None)
    return records

@api.post("/payroll/attendance")
async def save_attendance(body: AttendanceBulkIn, _=Depends(require_roles("admin"))):
    for rec in body.records:
        await db.attendance_records.update_one(
            {"employee_id": rec.employee_id, "date": rec.date},
            {"$set": rec.model_dump()},
            upsert=True
        )
    return {"status": "success"}

@api.get("/payroll/advances")
async def get_advances(_=Depends(require_roles("admin"))):
    advances = await db.salary_advances.find({}, {"_id": 0}).to_list(None)
    for a in advances:
        emp = await master_db.users.find_one({"id": a["employee_id"]})
        a["employee_name"] = emp["name"] if emp else "Unknown"
    return advances

@api.post("/payroll/advances")
async def create_advance(body: SalaryAdvanceIn, _=Depends(require_roles("admin"))):
    advance = {"id": str(uuid.uuid4()), "created_at": iso(now_utc()), "balance": body.amount, **body.model_dump()}
    await db.salary_advances.insert_one(advance)
    return {"status": "success"}

@api.get("/payroll/direct-payments")
async def get_direct_payments(_=Depends(require_roles("admin"))):
    payments = await db.direct_payments.find({}, {"_id": 0}).sort("date", -1).to_list(None)
    for p in payments:
        emp = await master_db.users.find_one({"id": p["employee_id"]})
        p["employee_name"] = emp["name"] if emp else "Unknown"
    return payments

@api.post("/payroll/direct-payments")
async def create_direct_payment(body: DirectPaymentIn, _=Depends(require_roles("admin"))):
    payment = {"id": str(uuid.uuid4()), "date": iso(now_utc()), **body.model_dump()}
    await db.direct_payments.insert_one(payment)
    return {"status": "success"}
@api.get("/payroll/leaves")
async def get_leaves(_=Depends(require_roles("admin"))):
    leaves = await db.leave_requests.find({}, {"_id": 0}).sort("start_date", -1).to_list(None)
    for l in leaves:
        emp = await master_db.users.find_one({"id": l["employee_id"]})
        l["employee_name"] = emp["name"] if emp else "Unknown"
    return leaves

@api.post("/payroll/leaves")
async def create_leave(body: LeaveRequestIn, _=Depends(require_roles("admin"))):
    leave = {"id": str(uuid.uuid4()), "created_at": iso(now_utc()), **body.model_dump()}
    await db.leave_requests.insert_one(leave)
    return {"status": "success"}

@api.post("/payroll/attendance/biometric-sync")
async def biometric_sync(body: BiometricSyncIn):
    # This is a webhook that biometric devices can push to
    date_str = body.timestamp[:10] # Extract YYYY-MM-DD
    
    # Upsert attendance record for this date
    att = await db.attendance.find_one({"employee_id": body.employee_id, "date": date_str})
    
    if not att:
        att = {
            "employee_id": body.employee_id,
            "date": date_str,
            "status": "Present", # Default to present if they scanned
            "check_in": None,
            "check_out": None,
            "overtime_hours": 0,
            "late_mark": False
        }
    
    # Update check_in or check_out
    if body.scan_type == "check-in":
        if not att.get("check_in"):
            att["check_in"] = body.timestamp
    elif body.scan_type == "check-out":
        att["check_out"] = body.timestamp
        
    await db.attendance.update_one(
        {"employee_id": body.employee_id, "date": date_str},
        {"$set": att},
        upsert=True
    )
    
    return {"status": "success", "message": "Biometric log synced"}

class BonusPenaltyIn(BaseModel):
    employee_id: str
    amount: float
    reason: str
    date: str

@api.get("/payroll/bonuses")
async def get_bonuses(_=Depends(require_roles("admin"))):
    bonuses = await db.bonuses.find({}, {"_id": 0}).sort("date", -1).to_list(None)
    for b in bonuses:
        emp = await master_db.users.find_one({"id": b["employee_id"]})
        b["employee_name"] = emp["name"] if emp else "Unknown"
    return bonuses

@api.post("/payroll/bonuses")
async def create_bonus(body: BonusPenaltyIn, _=Depends(require_roles("admin"))):
    bonus = {"id": str(uuid.uuid4()), "status": "Pending", "created_at": iso(now_utc()), **body.model_dump()}
    await db.bonuses.insert_one(bonus)
    return {"status": "success"}

@api.get("/payroll/penalties")
async def get_penalties(_=Depends(require_roles("admin"))):
    penalties = await db.penalties.find({}, {"_id": 0}).sort("date", -1).to_list(None)
    for p in penalties:
        emp = await master_db.users.find_one({"id": p["employee_id"]})
        p["employee_name"] = emp["name"] if emp else "Unknown"
    return penalties

@api.post("/payroll/penalties")
async def create_penalty(body: BonusPenaltyIn, _=Depends(require_roles("admin"))):
    penalty = {"id": str(uuid.uuid4()), "status": "Pending", "created_at": iso(now_utc()), **body.model_dump()}
    await db.penalties.insert_one(penalty)
    return {"status": "success"}



@api.get("/payroll/runs")
async def get_payrolls(_=Depends(require_roles("admin"))):
    runs = await db.payrolls.find({}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return runs

@api.get("/payroll/runs/{run_id}")
async def get_payroll_details(run_id: str, _=Depends(require_roles("admin"))):
    run = await db.payrolls.find_one({"id": run_id}, {"_id": 0})
    if not run: raise HTTPException(404, "Run not found")
    items = await db.payroll_items.find({"payroll_id": run_id}, {"_id": 0}).to_list(None)
    return {"run": run, "items": items}

@api.post("/payroll/process")
async def process_payroll(body: PayrollProcessIn, user=Depends(require_roles("admin"))):
    existing = await db.payrolls.find_one({"month": body.month, "year": body.year})
    if existing and existing["status"] != "Draft":
        raise HTTPException(400, "Payroll for this month is already approved/paid.")
    
    # Calculate days in month
    _, total_days = calendar.monthrange(body.year, body.month)
    start_date = f"{body.year}-{body.month:02d}-01"
    end_date = f"{body.year}-{body.month:02d}-{total_days}"

    tenant_id = user.get("tenant_id", "default")
    all_users = await master_db.users.find({"tenant_id": tenant_id}).to_list(None)
    profiles = await db.staff_profiles.find({}).to_list(None)
    profile_map = {p["user_id"]: p for p in profiles}
    emps = []
    for u in all_users:
        p = profile_map.get(u["id"], {})
        if p.get("status", "Active") == "Active":
            emps.append(u)
    items = []
    total_net = 0

    for emp in emps:
        struct = await db.employees_salary_structure.find_one({"employee_id": emp["id"]})
        if not struct: continue

        # Get attendance
        att_records = await db.attendance_records.find({
            "employee_id": emp["id"],
            "date": {"$gte": start_date, "$lte": end_date}
        }).to_list(None)

        present = sum(1 for r in att_records if r["status"] == "Present")
        half_days = sum(1 for r in att_records if r["status"] == "Half-Day")
        holidays = sum(1 for r in att_records if r["status"] == "Holiday")
        leaves = sum(1 for r in att_records if r["status"] == "Leave")
        
        # Unpaid leaves deduction
        unpaid_leave_requests = await db.leave_requests.find({
            "employee_id": emp["id"],
            "status": "Approved",
            "type": "Unpaid Leave",
            "start_date": {"$lte": end_date},
            "end_date": {"$gte": start_date}
        }).to_list(None)
        
        unpaid_leave_days = 0
        for ul in unpaid_leave_requests:
            # Calculate overlap days in this month
            sd = max(ul["start_date"], start_date)
            ed = min(ul["end_date"], end_date)
            if sd <= ed:
                dt_start = datetime.strptime(sd, "%Y-%m-%d")
                dt_end = datetime.strptime(ed, "%Y-%m-%d")
                unpaid_leave_days += (dt_end - dt_start).days + 1

        # Calculate working days credit
        days_credited = max(0, present + (half_days * 0.5) + holidays + leaves - unpaid_leave_days)
        
        gross = 0
        basic = struct.get("basic_salary", 0)
        
        if struct.get("wage_type") == "Fixed":
            # Prorate fixed salary based on days credited vs total days
            prorate_factor = days_credited / total_days if total_days > 0 else 0
            gross = (basic + struct.get("hra", 0) + struct.get("conveyance", 0) + struct.get("medical", 0) + struct.get("special_allowance", 0)) * prorate_factor
        else:
            # Hourly wage
            overtime = sum(r.get("overtime_hours", 0) for r in att_records)
            gross = (overtime * struct.get("hourly_rate", 0)) # assuming basic represents base hours, needs proper hourly tracking but simplifying for now.

        deductions = struct.get("pf_deduction", 0) + struct.get("esi_deduction", 0) + struct.get("professional_tax", 0)
        
        # Advance Salary EMI deduction
        advance_deduction = 0
        active_advances = await db.salary_advances.find({"employee_id": emp["id"], "balance": {"$gt": 0}, "status": "Approved"}).to_list(None)
        for advance in active_advances:
            emi = min(advance["emi_amount"], advance["balance"])
            advance_deduction += emi

        total_deductions = deductions + advance_deduction

        # Direct / Gig Payments deduction
        direct_payouts = await db.direct_payments.find({
            "employee_id": emp["id"],
            "date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
        }).to_list(None)
        direct_payments_total = sum(p["amount"] for p in direct_payouts)

        # Bonuses and Penalties
        pending_bonuses = await db.bonuses.find({
            "employee_id": emp["id"],
            "status": "Pending",
            "date": {"$lte": end_date + "T23:59:59"}
        }).to_list(None)
        total_bonuses = sum(b["amount"] for b in pending_bonuses)
        
        pending_penalties = await db.penalties.find({
            "employee_id": emp["id"],
            "status": "Pending",
            "date": {"$lte": end_date + "T23:59:59"}
        }).to_list(None)
        total_penalties = sum(p["amount"] for p in pending_penalties)

        net_pay = max(0, gross + total_bonuses - total_deductions - direct_payments_total - total_penalties)

        item = {
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "employee_name": emp.get("name", "Unknown"),
            "days_credited": days_credited,
            "gross_pay": gross,
            "deductions": deductions,
            "advance_deduction": advance_deduction,
            "direct_payments_deduction": direct_payments_total,
            "bonuses": total_bonuses,
            "penalties": total_penalties,
            "net_pay": net_pay
        }
        items.append(item)
        total_net += net_pay

    if existing:
        await db.payroll_items.delete_many({"payroll_id": existing["id"]})
        run_id = existing["id"]
        await db.payrolls.update_one({"id": run_id}, {"$set": {"total_net_pay": total_net, "employee_count": len(items), "updated_at": iso(now_utc())}})
    else:
        run_id = str(uuid.uuid4())
        await db.payrolls.insert_one({
            "id": run_id, "month": body.month, "year": body.year, 
            "status": "Draft", "total_net_pay": total_net, "employee_count": len(items),
            "created_at": iso(now_utc()), "created_by": user.get("email")
        })

    for it in items:
        it["payroll_id"] = run_id
    if items:
        await db.payroll_items.insert_many(items)

    return {"status": "success", "run_id": run_id}

@api.patch("/payroll/runs/{run_id}/status")
async def update_payroll_status(run_id: str, body: PayrollStatusUpdate, user=Depends(require_roles("admin"))):
    run = await db.payrolls.find_one({"id": run_id})
    if not run: raise HTTPException(404, "Run not found")

    update_data = {"status": body.status, "updated_at": iso(now_utc())}
    if body.status == "Paid":
        update_data["payment_mode"] = body.payment_mode
        update_data["transaction_id"] = body.transaction_id
        update_data["paid_at"] = iso(now_utc())

        # deduct loan balances
        items = await db.payroll_items.find({"payroll_id": run_id}).to_list(None)
        for item in items:
            if item.get("advance_deduction", 0) > 0:
                # Find active advance and reduce balance
                active_advance = await db.salary_advances.find_one({"employee_id": item["employee_id"], "balance": {"$gt": 0}})
                if active_advance:
                    await db.salary_advances.update_one({"id": active_advance["id"]}, {"$inc": {"balance": -item["advance_deduction"]}})
            
            # Mark bonuses and penalties as Paid/Deducted
            if item.get("bonuses", 0) > 0:
                await db.bonuses.update_many({"employee_id": item["employee_id"], "status": "Pending"}, {"$set": {"status": "Paid", "payroll_id": run_id}})
            if item.get("penalties", 0) > 0:
                await db.penalties.update_many({"employee_id": item["employee_id"], "status": "Pending"}, {"$set": {"status": "Deducted", "payroll_id": run_id}})

    await db.payrolls.update_one({"id": run_id}, {"$set": update_data})
    
    await db.payroll_audit_logs.insert_one({
        "id": str(uuid.uuid4()), "payroll_id": run_id, "status": body.status,
        "changed_by": user.get("email"), "timestamp": iso(now_utc())
    })
    return {"status": "success"}

@api.post("/payroll/runs/{run_id}/items/{item_id}/pay")
async def pay_payroll_item(run_id: str, item_id: str, body: ItemPaymentIn, _=Depends(require_roles("admin"))):
    item = await db.payroll_items.find_one({"id": item_id})
    if not item: raise HTTPException(404, "Item not found")
    
    paid_so_far = item.get("paid_amount", 0) + body.amount
    await db.payroll_items.update_one({"id": item_id}, {"$set": {"paid_amount": paid_so_far, "payment_mode": body.payment_mode}})
    
    run_items = await db.payroll_items.find({"payroll_id": run_id}).to_list(None)
    all_paid = all(i.get("paid_amount", 0) >= i["net_pay"] for i in run_items)
    
    if all_paid:
        await db.payrolls.update_one({"id": run_id}, {"$set": {"status": "Paid"}})
    elif paid_so_far > 0:
        await db.payrolls.update_one({"id": run_id}, {"$set": {"status": "Partial"}})
        
    return {"status": "success"}

@api.get("/payroll/payslip/{item_id}")
async def get_payslip(item_id: str, _=Depends(require_roles("admin"))):
    item = await db.payroll_items.find_one({"id": item_id}, {"_id": 0})
    if not item: raise HTTPException(404, "Payslip not found")
    emp = await master_db.users.find_one({"id": item["employee_id"]}, {"_id": 0})
    profile = await db.staff_profiles.find_one({"user_id": item["employee_id"]}, {"_id": 0}) or {}
    if emp:
        emp.update(profile)
    run = await db.payrolls.find_one({"id": item["payroll_id"]}, {"_id": 0})
    struct = await db.employees_salary_structure.find_one({"employee_id": item["employee_id"]}, {"_id": 0})
    
    return {"item": item, "employee": emp, "payroll": run, "structure": struct}

app.include_router(api)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
