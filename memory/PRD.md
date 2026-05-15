# Restaurant POS — Swiggy/Zomato + Full Workspace

## Original Problem Statement
> create a restaurant pos system with swiggy and zomato integration with hybrid offline online function

## Iteration History
- **v0.1** (Feb 15, 2026): Initial full build — backend complete, all modules
- **v0.1.1** (Feb 15): User pivot ("show only swiggy/zomato") → stripped to single page
- **v0.2** (Feb 15): User re-expand ("add other part too but keep this as main page") + SLA timer + Print KOT

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) + bcrypt + PyJWT — single `server.py` (~820 lines, refactor candidate)
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Recharts + sonner + lucide-react
- **Theme**: Terracotta (#E06C4C) on warm sand (#FAF9F6) — Manrope + IBM Plex Sans
- **DB**: `restaurant_pos` Mongo · collections: users, categories, menu, tables, orders, online_orders, customers, inventory, discounts

## Routes / Modules (v0.2)
| Route | Page | Roles |
|---|---|---|
| `/` (landing) | **Online Orders** (Swiggy/Zomato inbox) | all |
| `/pos` | POS Terminal (order taking) | all |
| `/kitchen` | KOT Board (3-lane kanban with SLA) | all |
| `/tables` | Table floor plan | all |
| `/dashboard` | Sales dashboard + charts | all |
| `/menu` | Menu CRUD | admin, manager |
| `/inventory` | Stock tracking | admin, manager |
| `/customers` | CRM | all |
| `/discounts` | Coupon codes | admin, manager |
| `/staff` | User management | admin |
| `/reports` | Sales export | admin, manager |

## v0.2 Features Added (Feb 15, 2026)
- ✅ Sidebar restored with all 11 modules; Online Orders pinned with live incoming-count badge
- ✅ **SLA timer** on accepted aggregator orders (20-min target, 15-min warn) with On track / Hurry up / SLA breached visual states + red ring on overdue cards
- ✅ **Print KOT** one-tap button on Online Orders (accepted) and Kitchen tickets — opens 80mm-formatted ticket window and auto-prints
- ✅ Backend `accept` endpoint now stamps `accepted_at` for SLA computation
- ✅ Kitchen page upgraded with SLA dots, "Xm left" / "Overdue +Xm" labels, Print button per ticket

## Testing
- Iteration 1: 17/17 backend, 17/17 E2E
- Iteration 2: 18/18 backend (incl. `test_accept_sets_accepted_at`), all frontend flows verified
- Credentials in `/app/memory/test_credentials.md`

## Prioritized Backlog
**P0**
- Audio chime + browser notification on new incoming orders
- Auto-accept rule engine (by platform, time, value threshold)

**P1**
- Configurable SLA per platform (Swiggy 20m / Zomato 25m)
- Cancel-rate & avg-prep-time analytics on dashboard
- Toast warning when printKOT popup is blocked

**P2**
- Real Swiggy/Zomato partner webhooks (signature verification)
- WebSocket/SSE push instead of polling (currently 6s + 8s polls overlap)
- Split `server.py` into routers (auth/online_orders/orders/catalog/ops)
- Wrap Dashboard recharts in fixed-height containers
- Fix POS `<option>` content to silence dev warning
