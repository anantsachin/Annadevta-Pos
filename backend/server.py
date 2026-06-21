from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
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


# ------- Mongo -------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

# ------- Helpers -------
def now_utc() -> datetime: return datetime.now(timezone.utc)
def iso(dt: datetime) -> str: return dt.isoformat()
def new_id() -> str: return str(uuid.uuid4())
def hash_password(p: str) -> str: return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
def verify_password(p: str, h: str) -> bool: return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
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


# ------- App -------
app = FastAPI(title="Thali POS")
api = APIRouter(prefix="/api")


# ------- Auth -------
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
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
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
    return order


@api.get("/orders")
async def list_orders(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
    _: dict = Depends(get_current_user),
):
    query = {}
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
async def seed_defaults():
    # Users
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@pos.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Owner",
            "role": "admin", "password_hash": hash_password(admin_pw),
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    if not await db.users.find_one({"email": "cashier@pos.com"}):
        await db.users.insert_one({
            "id": new_id(), "email": "cashier@pos.com", "name": "Cashier",
            "role": "cashier", "password_hash": hash_password("cashier123"),
            "created_at": iso(now_utc()),
        })

    # Settings
    if not await db.settings.find_one({"id": "restaurant"}):
        await db.settings.insert_one({
            "id": "restaurant",
            "name": "Annapurna Thali House",
            "address": "12, MG Road, Bengaluru 560001",
            "gstin": "29ABCDE1234F1Z5",
            "phone": "+91 98765 43210",
            "gst_rate": 5.0,
            "footer_msg": "Thank you! Please visit again.",
        })

    # Categories
    if await db.categories.count_documents({}) == 0:
        cats = [
            {"name": "Thali", "sort_order": 1},
            {"name": "Sabji", "sort_order": 2},
            {"name": "Dal", "sort_order": 3},
            {"name": "Rice", "sort_order": 4},
            {"name": "Bread", "sort_order": 5},
            {"name": "Drinks", "sort_order": 6},
        ]
        for c in cats:
            await db.categories.insert_one({"id": new_id(), **c})

    cat_lookup = {c["name"]: c["id"] for c in await db.categories.find({}, {"_id": 0}).to_list(20)}

    # Menu
    if await db.menu.count_documents({}) == 0:
        # Thalis
        thalis = [
            {
                "name": "Regular Thali", "price": 150,
                "is_thali": True,
                "thali_groups": [
                    {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 2},
                    {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
                ],
                "thali_extras": "Roti (4), Rice, Salad, Papad, Buttermilk",
            },
            {
                "name": "Mini Thali", "price": 100,
                "is_thali": True,
                "thali_groups": [
                    {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 1},
                    {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
                ],
                "thali_extras": "Roti (2), Rice, Salad",
            },
            {
                "name": "Special Thali", "price": 220,
                "is_thali": True,
                "thali_groups": [
                    {"category_id": cat_lookup.get("Sabji"), "label": "Sabji", "count": 2},
                    {"category_id": cat_lookup.get("Dal"), "label": "Dal", "count": 1},
                    {"category_id": cat_lookup.get("Rice"), "label": "Rice", "count": 1},
                ],
                "thali_extras": "Roti (4), Sweet, Salad, Papad, Pickle, Buttermilk",
            },
        ]
        for t in thalis:
            await db.menu.insert_one({"id": new_id(), "category_id": cat_lookup["Thali"], "available": True, **t})

        # Sabji
        for n, p in [("Paneer Masala", 120), ("Mix Veg", 90), ("Bhindi Fry", 100), ("Aloo Matar", 90), ("Chana Masala", 95)]:
            await db.menu.insert_one({"id": new_id(), "name": n, "category_id": cat_lookup["Sabji"], "price": p, "available": True, "is_thali": False, "thali_groups": [], "thali_extras": ""})
        # Dal
        for n, p in [("Dal Tadka", 80), ("Dal Fry", 80), ("Dal Makhani", 110)]:
            await db.menu.insert_one({"id": new_id(), "name": n, "category_id": cat_lookup["Dal"], "price": p, "available": True, "is_thali": False, "thali_groups": [], "thali_extras": ""})
        # Rice
        for n, p in [("Jeera Rice", 90), ("Steamed Rice", 60)]:
            await db.menu.insert_one({"id": new_id(), "name": n, "category_id": cat_lookup["Rice"], "price": p, "available": True, "is_thali": False, "thali_groups": [], "thali_extras": ""})
        # Bread
        for n, p in [("Roti", 15), ("Butter Roti", 20), ("Butter Naan", 50), ("Garlic Naan", 60)]:
            await db.menu.insert_one({"id": new_id(), "name": n, "category_id": cat_lookup["Bread"], "price": p, "available": True, "is_thali": False, "thali_groups": [], "thali_extras": ""})
        # Drinks
        for n, p in [("Buttermilk", 30), ("Masala Chai", 25), ("Fresh Lime", 40)]:
            await db.menu.insert_one({"id": new_id(), "name": n, "category_id": cat_lookup["Drinks"], "price": p, "available": True, "is_thali": False, "thali_groups": [], "thali_extras": ""})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.menu.create_index("id", unique=True)
    await db.categories.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("receipt_no")
    await seed_defaults()

    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    (creds_dir / "test_credentials.md").write_text(
        "# Thali POS Test Credentials\n\n"
        f"- Owner (admin): {os.environ.get('ADMIN_EMAIL', 'admin@pos.com')} / {os.environ.get('ADMIN_PASSWORD', 'admin123')}\n"
        "- Cashier: cashier@pos.com / cashier123\n\n"
        "Auth endpoints: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout\n"
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
