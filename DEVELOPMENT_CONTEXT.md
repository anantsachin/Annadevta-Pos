# Annapurna POS System — Development Context

**Branch:** `integration/offline-pos-merge`  
**Last Updated:** June 22, 2026

---

## Project Overview

**Annapurna** is an offline-first, desktop POS system designed for high-volume Thali restaurants. Unlike cloud-based SaaS solutions, it runs entirely on-premise as a packaged Electron application with embedded MongoDB and FastAPI backend. The system focuses on rapid billing, daily menu management, and customizable Thali assembly.

**Primary Use Case:** Single-cashier billing counter for restaurants serving daily-changing Thali menus with à-la-carte items.

**Key Differentiator:** Interactive Thali Builder that allows cashiers to assemble custom Thali combinations on-the-fly based on configurable rules (e.g., "pick 2 Sabjis + 1 Dal").

---

## System Architecture

### Technology Stack

**Frontend:**
- React 19 + React Router v7
- Tailwind CSS + Shadcn/UI components
- Recharts (analytics visualization)
- Sonner (toast notifications)
- Lucide Icons
- Axios (API client)

**Backend:**
- FastAPI (Python async web framework)
- Motor (async MongoDB driver)
- PyJWT (authentication)
- bcrypt (password hashing)
- openpyxl (Excel export)
- Uvicorn (ASGI server)

**Database:**
- MongoDB (local instance bundled with app)
- Collections: users, settings, categories, menu, templates, orders, counters

**Desktop Packaging:**
- Electron 29 (main process orchestration)
- PyInstaller (backend.exe compilation)
- electron-builder (Windows installer generation)

### Architecture Pattern

**Offline Desktop Application:**
1. Electron main process spawns `mongod.exe` (local MongoDB)
2. Electron spawns `backend.exe` (PyInstaller-packaged FastAPI)
3. React app (production build) loads in BrowserWindow
4. Frontend communicates with backend via `http://127.0.0.1:8000/api`
5. All data persists locally in MongoDB data directory

**Authentication Flow:**
- JWT tokens stored in localStorage + httpOnly cookies
- Role-based access control (admin/cashier)
- Axios interceptor attaches Bearer token to requests

**State Management:**
- React Context for auth (`AuthContext`)
- Custom hooks for cart logic (`useCart`)
- Local component state (no Redux/Zustand)

**Receipt Printing:**
- HTML/CSS-based thermal receipt generation
- 80mm/58mm paper width support
- Browser print API (`window.print()`)
- Customizable templates, fonts, headers

---

## Implemented Features

### ✅ Authentication & Authorization
- JWT-based login/logout
- Role-based routing (admin/cashier)
- Persistent sessions via localStorage + cookies
- Default users: admin@pos.com / cashier@pos.com

### ✅ Billing Counter (Primary Module)
- Category-based item grid
- Real-time search filtering
- Cart management (add/update/remove)
- Interactive Thali Builder dialog
- Discount application
- Multi-payment modes (Cash/Card/UPI)
- Auto-print receipts on checkout
- GST calculation from settings

### ✅ Thali System
- Rule-based Thali definitions (thali_groups)
- Category-specific item picking (e.g., "choose 2 Sabjis")
- Dynamic validation (must fill all groups)
- Thali selections stored per order line
- Optional extras display (e.g., "includes Roti (4), Rice")

### ✅ Daily Menu Management
- Toggle item availability (available: true/false)
- Bulk category enable/disable
- Named template snapshots (e.g., "Monday Menu")
- One-click template activation
- Template CRUD operations

### ✅ Menu Database (Admin)
- Category management (create/delete)
- Menu item CRUD (à-la-carte + Thali)
- Thali group configuration UI
- Price/availability editing
- Thali extras text field

### ✅ Dashboard (Admin Analytics)
- KPI cards: Revenue, Orders, Avg Bill (Today/Week/Month)
- 7-day revenue trend line chart
- Top products & top Thalis (by quantity sold)
- Payment mode breakdown (Cash/UPI/Card)
- Auto-refresh every 20 seconds

### ✅ Reports (Admin)
- Sales report (all transactions)
- Products report (aggregated by item)
- Thalis report (with selection picks analysis)
- Date range filtering + custom periods
- CSV/Excel export (openpyxl)

### ✅ Order History
- Date range filtering
- Receipt number search
- Order detail preview
- Receipt reprint functionality
- Cashier-scoped view (cashiers see only their orders)

### ✅ Settings (Admin)
- Restaurant profile (name, address, GSTIN, phone)
- GST rate configuration (applies to all items)
- Receipt customization:
  - Paper width (58mm/80mm)
  - Font size (small/medium/large)
  - Header template (classic/compact/modern)
  - Header alignment (left/center)
  - Receipt prefix & padding
  - Tax label customization
  - Show/hide GST, payment mode, Thali selections
  - Auto-print toggle
  - Footer message
- Live receipt preview

### ✅ Receipt System
- Thermal-optimized HTML/CSS templates
- Dynamic formatting based on settings
- Itemized breakdown with quantities
- Thali selections display (optional)
- GST calculation display
- Payment mode indicator
- Cashier name tracking
- Sequential receipt numbering (atomic counter)

---

## Database Schema

### Collections

**users**
```
{
  id: string (UUID),
  email: string (unique),
  name: string,
  role: "admin" | "cashier",
  password_hash: string (bcrypt),
  created_at: ISO datetime
}
```

**settings**
```
{
  id: "restaurant" (singleton),
  name: string,
  address: string,
  gstin: string,
  phone: string,
  gst_rate: float (default 5.0),
  footer_msg: string,
  show_gst: bool,
  show_payment: bool,
  show_thali_selections: bool,
  paper_width: int (58 or 80),
  font_size: "small" | "medium" | "large",
  header_alignment: "left" | "center",
  header_template: "classic" | "compact" | "modern",
  auto_print: bool,
  receipt_prefix: string,
  receipt_padding: int,
  tax_label: string
}
```

**categories**
```
{
  id: string (UUID),
  name: string,
  sort_order: int
}
```

**menu**
```
{
  id: string (UUID),
  name: string,
  category_id: string (FK to categories),
  price: float,
  available: bool,
  is_thali: bool,
  thali_groups: [
    {
      category_id: string,
      label: string,
      count: int (how many to pick)
    }
  ],
  thali_extras: string (descriptive text)
}
```

**templates**
```
{
  id: string (UUID),
  name: string,
  item_ids: [string] (array of menu IDs),
  created_at: ISO datetime
}
```

**orders**
```
{
  id: string (UUID),
  receipt_no: int (auto-increment),
  items: [
    {
      menu_item_id: string,
      name: string,
      price: float,
      qty: int,
      tax_rate: float,
      is_thali: bool,
      thali_selections: { category_label: [item_names] },
      thali_extras: string
    }
  ],
  subtotal: float,
  tax: float,
  discount: float,
  total: float,
  payment_mode: "cash" | "card" | "upi",
  notes: string,
  created_at: ISO datetime,
  paid_at: ISO datetime,
  cashier_email: string,
  cashier_name: string
}
```

**counters**
```
{
  id: "receipt" (singleton),
  value: int (atomic increment)
}
```

### Indexes
- `users.email` (unique)
- `menu.id` (unique)
- `categories.id` (unique)
- `orders.id` (unique)
- `orders.receipt_no`

---

## Module Analysis

### Billing (`Billing.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Primary cashier interface for order creation  
**Features:**
- Category filtering + search
- Menu item grid with availability filtering
- Cart with quantity controls
- Thali Builder integration
- Discount input
- Multi-payment checkout
- Auto-print integration
- Receipt preview tab

**Key Logic:**
- `useCart` hook manages cart state
- `ThaliBuilder` dialog handles custom Thali assembly
- Checkout creates order via `POST /api/orders`
- Receipt auto-prints if `settings.auto_print === true`

### Dashboard (`Dashboard.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Admin analytics overview  
**Features:**
- Period tabs (Today/Week/Month)
- KPI cards with revenue/orders/avg
- 7-day trend line chart
- Top items/Thalis ranking
- Payment mode distribution

**Data Source:** `GET /api/dashboard/summary` (aggregates orders in-memory)

### Daily Menu (`DailyMenu.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Toggle daily item availability  
**Features:**
- Category-grouped item toggles
- Bulk enable/disable per category
- Template save/load/delete
- Active item counter

**Key Endpoints:**
- `PATCH /api/menu/{id}/toggle`
- `POST /api/templates`
- `POST /api/templates/{id}/activate`

### Menu Page (`MenuPage.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Menu database CRUD  
**Features:**
- Category management
- Item creation/editing dialog
- Thali group builder UI
- Price/availability editing
- Delete confirmation

**Complex UI:** Thali group editor with dynamic category selection

### Reports (`Reports.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Transaction reporting & export  
**Features:**
- Tab switching (Sales/Products/Thalis)
- Period presets + custom date range
- CSV/Excel download
- Thali selection picks analysis

**Export Endpoints:** `GET /api/reports/export/{type}.{format}`

### Order History (`OrderHistory.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** View/reprint past orders  
**Features:**
- Date range filtering
- Receipt number search
- Order detail modal
- Reprint button
- Cashier-scoped for non-admins

### Settings (`Settings.jsx`)
**Status:** ✅ Fully functional  
**Purpose:** Restaurant & receipt configuration  
**Features:**
- Profile editing
- GST rate configuration
- Receipt customization (14+ settings)
- Live receipt preview
- Mock order for preview

**Critical:** Changes to `gst_rate` apply to future orders only

---

## Current Development Status

### ✅ Completed
- Full authentication & RBAC
- Core billing workflow
- Thali Builder system
- Daily menu management
- Menu database CRUD
- Dashboard analytics
- Reports with export
- Order history
- Settings with receipt customization
- Receipt printing system
- Electron packaging pipeline
- MongoDB integration
- JWT authentication
- Role-based routing

### ⚠️ Partially Completed / Known Gaps
- **No automated tests** (frontend or backend)
- **No input validation** on frontend forms (relies on backend validation)
- **No offline queue** for failed API calls (assumes backend always available)
- **No backup/restore** functionality
- **No multi-user concurrency** handling (single-cashier assumption)
- **No audit logs** for admin actions
- **No inventory tracking** (menu items don't have stock levels)
- **No customer management** (no customer names/phone on receipts)
- **No table management** (no dine-in table tracking)

### 🔄 Not Implemented
- Multi-location support
- Cloud sync
- Mobile app
- Kitchen display system (KDS)
- Online ordering integration
- Loyalty programs
- Advanced reporting (profit margins, COGS)
- Employee time tracking
- Cash drawer integration
- Barcode scanning

---

## Technical Debt & Issues

### Code Quality
- **No TypeScript** (pure JavaScript, prone to runtime errors)
- **Minimal error handling** in frontend (some try/catch missing)
- **No loading states** on some API calls
- **Inconsistent date formatting** (mix of ISO strings and Date objects)
- **No PropTypes or type checking** on components
- **Large component files** (Billing.jsx, Settings.jsx > 200 lines)

### Architecture Concerns
- **Tight coupling** between frontend and backend (no API versioning)
- **No API rate limiting** or request throttling
- **No database migrations** (schema changes require manual updates)
- **Hardcoded localhost URLs** (not configurable for network access)
- **No health checks** beyond `/api/health` endpoint
- **No graceful degradation** if MongoDB fails

### Security
- **JWT secret in .env** (not rotated)
- **No password complexity requirements**
- **No session timeout** enforcement on frontend
- **No CSRF protection** (relies on httpOnly cookies)
- **No input sanitization** on receipt HTML (XSS risk if malicious item names)

### Performance
- **No pagination** on orders list (loads all in memory)
- **No query optimization** (MongoDB queries not indexed beyond basics)
- **Large bundle size** (React 19 + all Shadcn components)
- **No code splitting** (single bundle.js)
- **No image optimization** (icon files are large)

### Scalability
- **Single MongoDB instance** (no replication)
- **No horizontal scaling** (desktop app limitation)
- **Receipt counter race condition** (if multiple instances run)
- **No data archival** (orders accumulate indefinitely)

---

## Context For Future Development

### How The System Currently Works

**Startup Flow:**
1. Electron main process starts
2. Spawns `mongod.exe` with data directory in `%APPDATA%/Annapurna POS/data/db`
3. Spawns `backend.exe` (FastAPI) on port 8000
4. Polls `/api/health` until backend ready
5. Opens BrowserWindow loading React build from `resources/build/index.html`
6. React app authenticates via `/api/auth/me` (checks for existing session)
7. Redirects to `/login` if unauthenticated, else loads billing counter

**Billing Workflow:**
1. Cashier selects category or searches items
2. Taps item → adds to cart (or opens Thali Builder if `is_thali`)
3. Thali Builder enforces group selection rules
4. Cart displays subtotal + GST (from settings)
5. Optional discount applied
6. Cashier selects payment mode (Cash/Card/UPI)
7. Checkout → `POST /api/orders` → receipt number assigned
8. Auto-print receipt if enabled
9. Cart clears, ready for next order

**Daily Menu Workflow:**
1. Admin opens Daily Menu page
2. Toggles items available/unavailable
3. Optionally saves current state as template
4. Template can be activated later to restore menu state

**Receipt Printing:**
- Frontend generates HTML receipt with inline CSS
- Opens print dialog via `window.print()`
- CSS `@page` rules set paper width (58mm/80mm)
- Receipt includes: header, items, totals, footer, cashier name

### Important Architecture Decisions

**Why Offline-First:**
- Target users are small restaurants with unreliable internet
- No subscription fees (one-time purchase model)
- Data privacy (no cloud storage)

**Why Electron:**
- Cross-platform desktop app (Windows primary, Mac/Linux possible)
- Bundles MongoDB + Python backend
- Native print dialog access
- File system access for logs

**Why FastAPI + Motor:**
- Async I/O for concurrent requests (future-proofing)
- Pydantic validation for API contracts
- Easy PyInstaller compilation

**Why MongoDB:**
- Flexible schema (menu items have varying structures)
- Embedded arrays (order items, thali groups)
- No migrations needed for schema evolution
- Portable (single data directory)

**Why React 19:**
- Modern hooks API (useCallback, useMemo)
- Fast rendering for item grids
- Shadcn/UI provides polished components

### Constraints

**Technical:**
- Windows-only (mongod.exe, PyInstaller .exe)
- Single-instance app (no multi-user concurrency)
- Local network only (no remote access)
- Requires admin rights for MongoDB port binding

**Business:**
- Single-location only
- No cloud backup
- No remote monitoring
- Manual updates (no auto-update mechanism)

### Areas Likely To Be Modified Next

**High Priority:**
1. **Input validation** on frontend forms (prevent invalid data submission)
2. **Error boundaries** in React (graceful error handling)
3. **Loading states** on all async operations
4. **Pagination** on orders list (performance issue with large datasets)
5. **Backup/restore** functionality (data loss risk)

**Medium Priority:**
6. **Automated tests** (Playwright for E2E, pytest for backend)
7. **TypeScript migration** (reduce runtime errors)
8. **Audit logs** for admin actions (compliance requirement)
9. **Customer name field** on orders (receipt personalization)
10. **Inventory tracking** (stock levels, low-stock alerts)

**Low Priority:**
11. Multi-language support (Hindi/regional languages)
12. Dark mode UI
13. Keyboard shortcuts for billing
14. Advanced analytics (profit margins, item costs)
15. Cloud backup integration (optional)

### Common Development Patterns

**Adding a new API endpoint:**
1. Define Pydantic model in `server.py`
2. Create route handler with `@api.get/post/put/delete`
3. Add authentication dependency: `Depends(get_current_user)` or `Depends(require_roles("admin"))`
4. Update frontend API call in relevant page component
5. Handle response in try/catch with toast notification

**Adding a new page:**
1. Create component in `frontend/src/pages/`
2. Add route in `App.js` with `<Route path="..." element={<Page />} />`
3. Wrap in `<ProtectedRoute roles={["admin"]}>` if admin-only
4. Add navigation link in `Layout.jsx`

**Modifying receipt template:**
1. Edit `frontend/src/lib/receipt.js`
2. Update HTML template string
3. Test with Settings page preview
4. Ensure CSS works for both 58mm and 80mm widths

**Database schema changes:**
1. Update Pydantic model in `server.py`
2. Add backward-compatible defaults in `RestaurantSettings` or model
3. Update seed data in `_seed_*` functions
4. No migration needed (MongoDB schemaless)

### Critical Files

**Backend:**
- `backend/server.py` (774 lines, entire API)
- `backend/requirements.txt` (dependencies)
- `backend/.env` (config: MONGO_URL, JWT_SECRET, DB_NAME)

**Frontend:**
- `frontend/src/App.js` (routing)
- `frontend/src/context/AuthContext.js` (auth state)
- `frontend/src/lib/api.js` (Axios instance)
- `frontend/src/lib/useCart.js` (cart logic)
- `frontend/src/lib/receipt.js` (receipt generation)
- `frontend/src/pages/Billing.jsx` (main cashier UI)
- `frontend/src/components/ThaliBuilder.jsx` (Thali assembly)

**Electron:**
- `electron/main.js` (process orchestration)
- `electron/preload.js` (context bridge)

**Build:**
- `build_all.bat` (production build script)
- `backend/build_backend.bat` (PyInstaller)
- `frontend/package.json` (electron-builder config)

### Environment Variables

**Backend (.env):**
```
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=annapurna_pos
JWT_SECRET=<random-secret>
ADMIN_EMAIL=admin@pos.com
ADMIN_PASSWORD=admin123
PORT=8000
```

**Frontend (.env):**
```
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

### Testing Strategy (Future)

**Backend:**
- pytest for API endpoint tests
- Mock MongoDB with mongomock
- Test authentication, RBAC, order creation, reports

**Frontend:**
- Playwright for E2E tests
- Test billing workflow, Thali Builder, receipt generation
- Visual regression tests for receipt templates

**Integration:**
- Test full flow: login → add items → checkout → verify order in DB
- Test receipt printing (screenshot comparison)

### Deployment

**Development:**
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py

# Frontend
cd frontend
npm install --legacy-peer-deps
npm start
```

**Production Build:**
```bash
build_all.bat
# Output: dist/Annapurna POS Setup.exe
```

**Installation:**
1. Run installer
2. Installer extracts to `C:\Program Files\Annapurna POS\`
3. MongoDB data stored in `%APPDATA%\Annapurna POS\data\db\`
4. Logs in `%APPDATA%\Annapurna POS\logs\`

---

## Summary

Annapurna POS is a **production-ready, offline-first desktop application** for Thali restaurant billing. The system is **fully functional** with all core features implemented:

- ✅ Billing with Thali Builder
- ✅ Daily menu management
- ✅ Admin dashboard & reports
- ✅ Receipt customization & printing
- ✅ Role-based access control

**Primary gaps:** Testing, input validation, backup/restore, scalability optimizations.

**Recommended next steps:** Add frontend validation, implement automated tests, add backup functionality, optimize large order lists with pagination.

The codebase is **well-structured** but lacks TypeScript and comprehensive error handling. MongoDB schema is flexible but has no migration strategy. Electron packaging works but is Windows-only.

**This document provides sufficient context for:**
- Onboarding new developers
- Planning feature additions
- Debugging production issues
- Understanding system constraints
- Making architectural decisions

---

*Generated: June 22, 2026*
