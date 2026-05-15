# Restaurant POS — Swiggy/Zomato Command Center (Demo)

## Original Problem Statement
> create a restaurant pos system with swiggy and zomato integration with hybrid offline online function

## User Clarifications
- Swiggy/Zomato: **mock/simulated** (real partner APIs require merchant onboarding)
- Core POS modules: all (admin/manager/cashier/kitchen roles)
- Offline-first: **IndexedDB/localStorage queue** + reconnection handling
- Auth: **JWT custom auth + Emergent Google social login**
- Payments: **recording only** (no real gateway)
- **MAJOR PIVOT** (user message): "mostly show only swiggy/zomato part with demo data of it" → **Option b: Hide other modules entirely**

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) + bcrypt + PyJWT, single `server.py`
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Recharts + sonner + lucide-react
- **Theme**: Terracotta (#E06C4C) on warm sand (#FAF9F6) — Manrope + IBM Plex Sans
- **DB**: `restaurant_pos` Mongo with collections: users, categories, menu, tables, orders, online_orders, customers, inventory, discounts

## Personas
- Restaurant **operator** (admin) — monitors aggregator inbox, accepts/rejects/dispatches orders
- **Cashier** (read-only POS persona, currently hidden from UI)

## What's Implemented (2026-02-15)
- ✅ JWT auth with httpOnly cookie + Bearer token fallback, admin seeding
- ✅ Emergent-managed Google session exchange endpoint (`GET /api/auth/session`)
- ✅ Swiggy/Zomato command center UI as the **only** protected route at `/`
- ✅ 8 pre-seeded demo orders (Aarav, Ishita, Rohit, Priya, Vikram, Neha, Karan, Sneha) across incoming/accepted/dispatched/rejected
- ✅ Stats strip: Swiggy revenue, Zomato revenue, incoming count, in-kitchen count
- ✅ Filters: status tabs (All/Incoming/Accepted/Dispatched/Rejected), platform toggle (Both/Swiggy/Zomato), name+id search
- ✅ Simulate buttons: +1 Swiggy, +1 Zomato, +5 random burst
- ✅ Accept → converts to internal POS order, Reject, Dispatch flows
- ✅ Online/Offline pulse indicator + offline action queue with auto-sync
- ✅ Hidden but functional backend for menu, tables, KOT, dashboard, inventory, customers, discounts, staff, reports
- ✅ 17/17 backend tests + 17/17 frontend E2E steps passing

## Prioritized Backlog
**P0 (immediate-value enhancements)**
- Audio chime + browser notification when new incoming order arrives
- One-tap "print KOT" PDF from accepted orders

**P1 (operator workflow)**
- Auto-accept rules (by platform / hour-of-day)
- SLA timer per order (target prep time + visual warning when overdue)
- Per-platform commission settings & net-revenue stat

**P2 (deferred)**
- Re-enable hidden modules (POS terminal, KOT board, Tables, Menu, Inventory, Customers, Discounts, Staff, Reports) — backend already in place
- Real Swiggy/Zomato partner webhook endpoints (auth handshake + signature verification)
- WebSocket/SSE push instead of 6s polling
- Split server.py into modules (auth.py, online_orders.py, seed.py)

## Next Tasks
1. Audio + browser-push alerts on incoming orders
2. SLA prep-time timer
3. Re-expose POS/KOT/Tables on user request (one-line route change)
