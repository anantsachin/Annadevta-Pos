from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr


# ------- Mongo -------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

# ------- Helpers -------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": now_utc() + timedelta(hours=12),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep


# ------- Models -------
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "manager", "cashier", "kitchen"] = "cashier"


class Category(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    sort_order: int = 0
    color: str = "#FDECE8"

class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0
    color: str = "#FDECE8"


class MenuItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category_id: str
    price: float
    description: str = ""
    image_url: str = ""
    available: bool = True
    tax_rate: float = 5.0  # %
    is_veg: bool = True

class MenuItemIn(BaseModel):
    name: str
    category_id: str
    price: float
    description: str = ""
    image_url: str = ""
    available: bool = True
    tax_rate: float = 5.0
    is_veg: bool = True


class TableModel(BaseModel):
    id: str = Field(default_factory=new_id)
    number: str
    capacity: int = 4
    status: Literal["free", "occupied", "reserved"] = "free"
    current_order_id: Optional[str] = None

class TableIn(BaseModel):
    number: str
    capacity: int = 4


class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    qty: int
    notes: str = ""
    tax_rate: float = 5.0

class OrderIn(BaseModel):
    type: Literal["dine_in", "takeaway", "swiggy", "zomato"] = "dine_in"
    table_id: Optional[str] = None
    items: List[OrderItem]
    customer_id: Optional[str] = None
    customer_name: str = ""
    customer_phone: str = ""
    discount: float = 0.0
    notes: str = ""
    external_id: Optional[str] = None  # for swiggy/zomato

class PaymentIn(BaseModel):
    payment_mode: Literal["cash", "card", "upi", "online"] = "cash"
    amount: float


class CustomerIn(BaseModel):
    name: str
    phone: str
    email: str = ""


class InventoryIn(BaseModel):
    name: str
    quantity: float
    unit: str = "units"
    low_stock_threshold: float = 5.0


class DiscountIn(BaseModel):
    code: str
    type: Literal["percent", "flat"] = "percent"
    value: float
    active: bool = True


class SyncOrdersIn(BaseModel):
    orders: List[OrderIn]


# ------- App -------
app = FastAPI(title="Restaurant POS")
api = APIRouter(prefix="/api")

# ------- Auth Endpoints -------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=12 * 3600, path="/",
    )
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
    }

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)

@api.post("/auth/register")
async def register(body: RegisterIn, _: dict = Depends(require_roles("admin"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="User already exists")
    user = {
        "id": new_id(),
        "email": email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

@api.get("/auth/staff")
async def list_staff(_: dict = Depends(require_roles("admin", "manager"))):
    rows = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return rows

@api.delete("/auth/staff/{user_id}")
async def delete_staff(user_id: str, _: dict = Depends(require_roles("admin"))):
    res = await db.users.delete_one({"id": user_id})
    return {"deleted": res.deleted_count}


# ------- Google Auth (Emergent) -------
import httpx

@api.get("/auth/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID") or request.query_params.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data.get("email", "").lower()
    name = data.get("name", "")
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": new_id(),
            "email": email,
            "name": name or email.split("@")[0],
            "role": "admin",  # first google user becomes admin
            "password_hash": hash_password(new_id()),
            "created_at": iso(now_utc()),
            "google": True,
        }
        await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=12 * 3600, path="/",
    )
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
    }


# ------- Categories -------
@api.get("/categories")
async def list_categories(_: dict = Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)

@api.post("/categories")
async def create_category(body: CategoryIn, _: dict = Depends(require_roles("admin", "manager"))):
    obj = Category(**body.model_dump()).model_dump()
    await db.categories.insert_one(obj.copy())
    return obj

@api.delete("/categories/{cid}")
async def delete_category(cid: str, _: dict = Depends(require_roles("admin", "manager"))):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ------- Menu -------
@api.get("/menu")
async def list_menu(_: dict = Depends(get_current_user)):
    return await db.menu.find({}, {"_id": 0}).to_list(2000)

@api.post("/menu")
async def create_menu(body: MenuItemIn, _: dict = Depends(require_roles("admin", "manager"))):
    obj = MenuItem(**body.model_dump()).model_dump()
    await db.menu.insert_one(obj.copy())
    return obj

@api.put("/menu/{mid}")
async def update_menu(mid: str, body: MenuItemIn, _: dict = Depends(require_roles("admin", "manager"))):
    await db.menu.update_one({"id": mid}, {"$set": body.model_dump()})
    return await db.menu.find_one({"id": mid}, {"_id": 0})

@api.patch("/menu/{mid}/toggle")
async def toggle_menu(mid: str, _: dict = Depends(require_roles("admin", "manager", "cashier"))):
    item = await db.menu.find_one({"id": mid}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Not found")
    await db.menu.update_one({"id": mid}, {"$set": {"available": not item.get("available", True)}})
    return {"ok": True, "available": not item.get("available", True)}

@api.delete("/menu/{mid}")
async def delete_menu(mid: str, _: dict = Depends(require_roles("admin", "manager"))):
    await db.menu.delete_one({"id": mid})
    return {"ok": True}


# ------- Tables -------
@api.get("/tables")
async def list_tables(_: dict = Depends(get_current_user)):
    return await db.tables.find({}, {"_id": 0}).to_list(500)

@api.post("/tables")
async def create_table(body: TableIn, _: dict = Depends(require_roles("admin", "manager"))):
    obj = TableModel(**body.model_dump()).model_dump()
    await db.tables.insert_one(obj.copy())
    return obj

@api.patch("/tables/{tid}/status")
async def set_table_status(tid: str, body: dict, _: dict = Depends(get_current_user)):
    status = body.get("status")
    if status not in ("free", "occupied", "reserved"):
        raise HTTPException(400, "Bad status")
    await db.tables.update_one({"id": tid}, {"$set": {"status": status, "current_order_id": None if status == "free" else (await db.tables.find_one({"id": tid}, {"_id": 0}) or {}).get("current_order_id")}})
    return {"ok": True}

@api.delete("/tables/{tid}")
async def delete_table(tid: str, _: dict = Depends(require_roles("admin", "manager"))):
    await db.tables.delete_one({"id": tid})
    return {"ok": True}


# ------- Orders -------
def _compute_totals(items: list, discount: float = 0.0) -> dict:
    subtotal = sum(i["price"] * i["qty"] for i in items)
    tax = sum((i["price"] * i["qty"]) * (i.get("tax_rate", 5.0) / 100) for i in items)
    total = max(0.0, round(subtotal + tax - discount, 2))
    return {"subtotal": round(subtotal, 2), "tax": round(tax, 2), "total": total}


async def _create_order(body: OrderIn, user_email: str = "system") -> dict:
    totals = _compute_totals([i.model_dump() for i in body.items], body.discount)
    order = {
        "id": new_id(),
        "type": body.type,
        "table_id": body.table_id,
        "items": [i.model_dump() for i in body.items],
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "discount": body.discount,
        "notes": body.notes,
        "external_id": body.external_id,
        "subtotal": totals["subtotal"],
        "tax": totals["tax"],
        "total": totals["total"],
        "status": "open",  # open -> kot_sent -> ready -> served -> paid -> closed
        "kot_status": "pending",  # pending -> preparing -> ready
        "payment_mode": None,
        "paid_amount": 0,
        "created_at": iso(now_utc()),
        "created_by": user_email,
    }
    await db.orders.insert_one(order.copy())
    if body.table_id:
        await db.tables.update_one(
            {"id": body.table_id},
            {"$set": {"status": "occupied", "current_order_id": order["id"]}},
        )
    if body.customer_phone:
        await db.customers.update_one(
            {"phone": body.customer_phone},
            {"$inc": {"total_orders": 1, "loyalty_points": int(totals["total"] // 10)},
             "$setOnInsert": {"id": new_id(), "name": body.customer_name, "phone": body.customer_phone, "created_at": iso(now_utc())}},
            upsert=True,
        )
    return order


@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    return await _create_order(body, user["email"])

@api.get("/orders")
async def list_orders(status: Optional[str] = None, type: Optional[str] = None, _: dict = Depends(get_current_user)):
    q = {}
    if status: q["status"] = status
    if type: q["type"] = type
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.get("/orders/{oid}")
async def get_order(oid: str, _: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return o

@api.patch("/orders/{oid}/kot")
async def update_kot(oid: str, body: dict, _: dict = Depends(get_current_user)):
    status = body.get("kot_status")
    if status not in ("pending", "preparing", "ready", "served"):
        raise HTTPException(400, "Bad status")
    update = {"kot_status": status}
    if status == "preparing":
        update["status"] = "kot_sent"
    if status == "ready":
        update["status"] = "ready"
    if status == "served":
        update["status"] = "served"
    await db.orders.update_one({"id": oid}, {"$set": update})
    return {"ok": True}

@api.post("/orders/{oid}/pay")
async def pay_order(oid: str, body: PaymentIn, _: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one(
        {"id": oid},
        {"$set": {
            "payment_mode": body.payment_mode,
            "paid_amount": body.amount,
            "status": "paid",
            "paid_at": iso(now_utc()),
        }},
    )
    if order.get("table_id"):
        await db.tables.update_one(
            {"id": order["table_id"]},
            {"$set": {"status": "free", "current_order_id": None}},
        )
    return {"ok": True}

@api.delete("/orders/{oid}")
async def delete_order(oid: str, _: dict = Depends(require_roles("admin", "manager"))):
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if order and order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]}, {"$set": {"status": "free", "current_order_id": None}})
    await db.orders.delete_one({"id": oid})
    return {"ok": True}


# ------- KOT board -------
@api.get("/kot")
async def kot_board(_: dict = Depends(get_current_user)):
    rows = await db.orders.find(
        {"status": {"$in": ["open", "kot_sent", "ready"]}, "kot_status": {"$ne": "served"}},
        {"_id": 0},
    ).sort("created_at", 1).to_list(500)
    return rows


# ------- Sync offline orders -------
@api.post("/sync/orders")
async def sync_offline_orders(body: SyncOrdersIn, user: dict = Depends(get_current_user)):
    created = []
    for o in body.orders:
        created.append(await _create_order(o, user["email"]))
    return {"synced": len(created), "orders": created}


# ------- Customers -------
@api.get("/customers")
async def list_customers(_: dict = Depends(get_current_user)):
    return await db.customers.find({}, {"_id": 0}).sort("name", 1).to_list(2000)

@api.post("/customers")
async def create_customer(body: CustomerIn, _: dict = Depends(get_current_user)):
    obj = {"id": new_id(), **body.model_dump(), "total_orders": 0, "loyalty_points": 0, "created_at": iso(now_utc())}
    await db.customers.insert_one(obj.copy())
    return obj


# ------- Inventory -------
@api.get("/inventory")
async def list_inventory(_: dict = Depends(get_current_user)):
    return await db.inventory.find({}, {"_id": 0}).to_list(2000)

@api.post("/inventory")
async def create_inventory(body: InventoryIn, _: dict = Depends(require_roles("admin", "manager"))):
    obj = {"id": new_id(), **body.model_dump()}
    await db.inventory.insert_one(obj.copy())
    return obj

@api.put("/inventory/{iid}")
async def update_inventory(iid: str, body: InventoryIn, _: dict = Depends(require_roles("admin", "manager"))):
    await db.inventory.update_one({"id": iid}, {"$set": body.model_dump()})
    return await db.inventory.find_one({"id": iid}, {"_id": 0})

@api.delete("/inventory/{iid}")
async def delete_inventory(iid: str, _: dict = Depends(require_roles("admin", "manager"))):
    await db.inventory.delete_one({"id": iid})
    return {"ok": True}


# ------- Discounts -------
@api.get("/discounts")
async def list_discounts(_: dict = Depends(get_current_user)):
    return await db.discounts.find({}, {"_id": 0}).to_list(500)

@api.post("/discounts")
async def create_discount(body: DiscountIn, _: dict = Depends(require_roles("admin", "manager"))):
    obj = {"id": new_id(), **body.model_dump()}
    await db.discounts.insert_one(obj.copy())
    return obj

@api.delete("/discounts/{did}")
async def delete_discount(did: str, _: dict = Depends(require_roles("admin", "manager"))):
    await db.discounts.delete_one({"id": did})
    return {"ok": True}


# ------- Swiggy/Zomato mock -------
import random

@api.get("/online-orders")
async def list_online_orders(_: dict = Depends(get_current_user)):
    return await db.online_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/online-orders/simulate")
async def simulate_online_order(body: dict, _: dict = Depends(get_current_user)):
    platform = body.get("platform", random.choice(["swiggy", "zomato"]))
    menu_items = await db.menu.find({"available": True}, {"_id": 0}).to_list(200)
    if not menu_items:
        raise HTTPException(400, "Add menu items first")
    chosen = random.sample(menu_items, min(len(menu_items), random.randint(1, 3)))
    items = [{"menu_item_id": i["id"], "name": i["name"], "price": i["price"], "qty": random.randint(1, 3), "tax_rate": i.get("tax_rate", 5.0), "notes": ""} for i in chosen]
    totals = _compute_totals(items)
    fake_names = ["Aarav K.", "Ishita M.", "Rohit S.", "Priya R.", "Vikram J.", "Neha P.", "Karan V.", "Sneha T."]
    customer = random.choice(fake_names)
    obj = {
        "id": new_id(),
        "platform": platform,
        "external_id": f"{platform[:3].upper()}-{random.randint(100000, 999999)}",
        "items": items,
        "customer_name": customer,
        "customer_phone": f"98{random.randint(10000000, 99999999)}",
        "address": "Sector 21, Sample Address",
        "subtotal": totals["subtotal"],
        "tax": totals["tax"],
        "total": totals["total"],
        "status": "incoming",  # incoming -> accepted -> rejected -> dispatched
        "created_at": iso(now_utc()),
    }
    await db.online_orders.insert_one(obj.copy())
    return obj

@api.post("/online-orders/{oid}/accept")
async def accept_online_order(oid: str, user: dict = Depends(get_current_user)):
    o = await db.online_orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    # Create a real POS order from it
    order_in = OrderIn(
        type=o["platform"],
        items=[OrderItem(**i) for i in o["items"]],
        customer_name=o["customer_name"],
        customer_phone=o["customer_phone"],
        external_id=o["external_id"],
    )
    order = await _create_order(order_in, user["email"])
    await db.online_orders.update_one({"id": oid}, {"$set": {"status": "accepted", "order_id": order["id"]}})
    return {"ok": True, "order_id": order["id"]}

@api.post("/online-orders/{oid}/reject")
async def reject_online_order(oid: str, _: dict = Depends(get_current_user)):
    await db.online_orders.update_one({"id": oid}, {"$set": {"status": "rejected"}})
    return {"ok": True}

@api.post("/online-orders/{oid}/dispatch")
async def dispatch_online_order(oid: str, _: dict = Depends(get_current_user)):
    await db.online_orders.update_one({"id": oid}, {"$set": {"status": "dispatched"}})
    return {"ok": True}


# ------- Dashboard -------
@api.get("/dashboard/summary")
async def dashboard_summary(_: dict = Depends(get_current_user)):
    today_start = datetime.combine(now_utc().date(), datetime.min.time(), tzinfo=timezone.utc)
    today_iso = iso(today_start)
    paid = await db.orders.find(
        {"status": "paid", "paid_at": {"$gte": today_iso}}, {"_id": 0}
    ).to_list(5000)
    today_sales = sum(o.get("total", 0) for o in paid)
    today_orders = len(paid)

    all_paid = await db.orders.find({"status": "paid"}, {"_id": 0}).to_list(20000)
    total_sales = sum(o.get("total", 0) for o in all_paid)

    # Top items
    counter = {}
    for o in all_paid:
        for it in o.get("items", []):
            counter[it["name"]] = counter.get(it["name"], 0) + it["qty"]
    top_items = sorted(counter.items(), key=lambda x: -x[1])[:5]

    # By type
    by_type = {}
    for o in paid:
        by_type[o["type"]] = by_type.get(o["type"], 0) + o["total"]

    # Last 7 days
    series = []
    for i in range(6, -1, -1):
        day = (now_utc() - timedelta(days=i)).date()
        d_start = iso(datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc))
        d_end = iso(datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc))
        day_orders = [o for o in all_paid if d_start <= o.get("paid_at", "") <= d_end]
        series.append({"date": day.isoformat(), "sales": round(sum(o["total"] for o in day_orders), 2), "orders": len(day_orders)})

    open_orders = await db.orders.count_documents({"status": {"$ne": "paid"}})
    tables_occupied = await db.tables.count_documents({"status": "occupied"})
    tables_total = await db.tables.count_documents({})
    low_stock = await db.inventory.find({}, {"_id": 0}).to_list(2000)
    low_stock_count = sum(1 for it in low_stock if it["quantity"] <= it.get("low_stock_threshold", 5))

    return {
        "today_sales": round(today_sales, 2),
        "today_orders": today_orders,
        "total_sales": round(total_sales, 2),
        "open_orders": open_orders,
        "tables_occupied": tables_occupied,
        "tables_total": tables_total,
        "low_stock_count": low_stock_count,
        "top_items": [{"name": n, "qty": q} for n, q in top_items],
        "by_type": [{"type": k, "sales": round(v, 2)} for k, v in by_type.items()],
        "series": series,
    }


# ------- Health -------
@api.get("/")
async def root():
    return {"ok": True, "service": "Restaurant POS"}


# ------- Seed defaults -------
async def seed_defaults():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@pos.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Admin",
            "role": "admin", "password_hash": hash_password(admin_pw),
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    # Test cashier
    cashier_email = "cashier@pos.com"
    if not await db.users.find_one({"email": cashier_email}):
        await db.users.insert_one({
            "id": new_id(), "email": cashier_email, "name": "Cashier One",
            "role": "cashier", "password_hash": hash_password("cashier123"),
            "created_at": iso(now_utc()),
        })

    # Categories + menu
    if await db.categories.count_documents({}) == 0:
        cats = [
            {"name": "Starters", "color": "#FDECE8", "sort_order": 1},
            {"name": "Main Course", "color": "#D8F3DC", "sort_order": 2},
            {"name": "Breads", "color": "#FEF3C7", "sort_order": 3},
            {"name": "Beverages", "color": "#DBEAFE", "sort_order": 4},
            {"name": "Desserts", "color": "#FCE7F3", "sort_order": 5},
        ]
        cat_objs = []
        for c in cats:
            obj = Category(**c).model_dump()
            await db.categories.insert_one(obj.copy())
            cat_objs.append(obj)
        items_seed = [
            ("Paneer Tikka", "Starters", 280, True),
            ("Chicken 65", "Starters", 320, False),
            ("Veg Spring Rolls", "Starters", 220, True),
            ("Butter Chicken", "Main Course", 420, False),
            ("Paneer Butter Masala", "Main Course", 360, True),
            ("Dal Makhani", "Main Course", 280, True),
            ("Veg Biryani", "Main Course", 260, True),
            ("Chicken Biryani", "Main Course", 340, False),
            ("Butter Naan", "Breads", 60, True),
            ("Garlic Naan", "Breads", 80, True),
            ("Tandoori Roti", "Breads", 40, True),
            ("Masala Chai", "Beverages", 50, True),
            ("Fresh Lime Soda", "Beverages", 90, True),
            ("Cold Coffee", "Beverages", 140, True),
            ("Gulab Jamun", "Desserts", 120, True),
            ("Chocolate Brownie", "Desserts", 180, True),
        ]
        cat_lookup = {c["name"]: c["id"] for c in cat_objs}
        for name, cat, price, veg in items_seed:
            obj = MenuItem(name=name, category_id=cat_lookup[cat], price=price, is_veg=veg, tax_rate=5.0).model_dump()
            await db.menu.insert_one(obj.copy())

    if await db.tables.count_documents({}) == 0:
        for i in range(1, 13):
            obj = TableModel(number=f"T{i}", capacity=4 if i % 2 else 6).model_dump()
            await db.tables.insert_one(obj.copy())

    # Seed demo Swiggy/Zomato orders so the page is alive on first load
    if await db.online_orders.count_documents({}) == 0:
        menu_items = await db.menu.find({"available": True}, {"_id": 0}).to_list(200)
        if menu_items:
            demo_orders = [
                {"platform": "swiggy", "customer_name": "Aarav Khanna", "phone": "9876543210", "address": "Flat 302, Lotus Apt, Indiranagar, Bangalore", "items_idx": [(0, 2), (8, 2)], "minutes_ago": 2, "status": "incoming"},
                {"platform": "zomato", "customer_name": "Ishita Mehra", "phone": "9123456780", "address": "B-12, Green Park, Koramangala, Bangalore", "items_idx": [(3, 1), (9, 2), (11, 2)], "minutes_ago": 5, "status": "incoming"},
                {"platform": "swiggy", "customer_name": "Rohit Sharma", "phone": "9988776655", "address": "Tower 4, Prestige Heights, HSR Layout", "items_idx": [(7, 1), (10, 3)], "minutes_ago": 7, "status": "incoming"},
                {"platform": "zomato", "customer_name": "Priya Raghavan", "phone": "9012345678", "address": "Villa 18, Adarsh Palm Retreat, Bellandur", "items_idx": [(1, 1), (4, 1), (14, 2)], "minutes_ago": 12, "status": "accepted"},
                {"platform": "swiggy", "customer_name": "Vikram Joshi", "phone": "9001122334", "address": "Apt 9B, Brigade Gateway, Malleshwaram", "items_idx": [(5, 1), (8, 2), (13, 1)], "minutes_ago": 18, "status": "accepted"},
                {"platform": "zomato", "customer_name": "Neha Patel", "phone": "9876501234", "address": "Plot 22, Whitefield Main Rd", "items_idx": [(2, 2), (15, 1)], "minutes_ago": 26, "status": "dispatched"},
                {"platform": "swiggy", "customer_name": "Karan Verma", "phone": "9876512345", "address": "Sector 17, Powai, Mumbai", "items_idx": [(6, 1), (9, 1), (12, 2)], "minutes_ago": 38, "status": "dispatched"},
                {"platform": "zomato", "customer_name": "Sneha Iyer", "phone": "9876523456", "address": "MG Road, Pune", "items_idx": [(0, 1), (3, 1)], "minutes_ago": 55, "status": "rejected"},
            ]
            for idx, d in enumerate(demo_orders):
                items = []
                for mi, qty in d["items_idx"]:
                    if mi < len(menu_items):
                        m = menu_items[mi]
                        items.append({"menu_item_id": m["id"], "name": m["name"], "price": m["price"], "qty": qty, "tax_rate": m.get("tax_rate", 5.0), "notes": ""})
                if not items: continue
                totals = _compute_totals(items)
                created = now_utc() - timedelta(minutes=d["minutes_ago"])
                await db.online_orders.insert_one({
                    "id": new_id(),
                    "platform": d["platform"],
                    "external_id": f"{d['platform'][:3].upper()}-{100000 + idx * 311}",
                    "items": items,
                    "customer_name": d["customer_name"],
                    "customer_phone": d["phone"],
                    "address": d["address"],
                    "subtotal": totals["subtotal"],
                    "tax": totals["tax"],
                    "total": totals["total"],
                    "status": d["status"],
                    "created_at": iso(created),
                })

    if await db.inventory.count_documents({}) == 0:
        for n, q, u, t in [
            ("Tomatoes", 20, "kg", 5),
            ("Onions", 30, "kg", 5),
            ("Paneer", 8, "kg", 3),
            ("Chicken", 12, "kg", 5),
            ("Basmati Rice", 25, "kg", 10),
            ("Cooking Oil", 4, "L", 5),
        ]:
            await db.inventory.insert_one({"id": new_id(), "name": n, "quantity": q, "unit": u, "low_stock_threshold": t})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.menu.create_index("id", unique=True)
    await db.categories.create_index("id", unique=True)
    await db.tables.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await seed_defaults()
    # write test credentials
    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    (creds_dir / "test_credentials.md").write_text(
        "# POS Test Credentials\n\n"
        f"- Admin: {os.environ.get('ADMIN_EMAIL', 'admin@pos.com')} / {os.environ.get('ADMIN_PASSWORD', 'admin123')} (role: admin)\n"
        "- Cashier: cashier@pos.com / cashier123 (role: cashier)\n\n"
        "## Auth Endpoints\n"
        "- POST /api/auth/login\n- GET /api/auth/me\n- POST /api/auth/logout\n- POST /api/auth/register (admin)\n- GET /api/auth/session (Google session exchange)\n"
    )


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos")


@app.on_event("shutdown")
async def shutdown():
    client.close()
