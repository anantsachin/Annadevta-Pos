# Annapurna — Thali Billing Counter POS

## Problem Statement
Small restaurant. Single cashier. Daily-changing Thali menu. Fast billing counter — NOT enterprise SaaS.

## Iteration History
- **v0.1 / v0.2** (Feb 2026): Initial broad-scope POS with Swiggy/Zomato + KOT + Tables + 11 modules
- **v0.3** (Feb 2026): **Major pivot to billing-counter only.** Removed Swiggy/Zomato, KOT, Tables, Inventory, CRM, Loyalty, Coupons, Staff, SLA. Added Thali Builder + Daily Menu templates + GST receipt printing + Excel exports.

## Architecture
- **Backend**: FastAPI + Motor + bcrypt + PyJWT + openpyxl — single `server.py` (~700 lines, focused)
- **Frontend**: React 19 + Tailwind + Shadcn/UI (Dialog, Switch, Card, Button, Input) + Recharts + sonner + lucide-react
- **DB collections**: users, settings, categories, menu, templates, orders, counters

## Routes / Modules (v0.3)
| Route | Page | Roles |
|---|---|---|
| `/` (landing) | **Billing Counter** | admin, cashier |
| `/orders` | Order History (search + reprint) | admin, cashier |
| `/daily-menu` | Daily Menu (toggle + templates) | admin |
| `/menu` | Menu CRUD + Thali rules | admin |
| `/dashboard` | Revenue Dashboard (today/week/month) | admin |
| `/reports` | Sales/Products/Thali reports (CSV + Excel) | admin |
| `/settings` | Restaurant profile (name, GSTIN, GST%, footer) | admin |

## Core Features (v0.3)
- ✅ JWT auth (admin + cashier only)
- ✅ Billing counter with Categories → Items → Cart layout
- ✅ **Thali Builder dialog** — pick N items per group from today's available menu; selections stored on the order line
- ✅ **Daily Menu management** — per-category toggle, save current as named template, one-click activate any template
- ✅ Menu CRUD with thali rules editor (groups: category + label + count, plus fixed inclusions text)
- ✅ **Atomic receipt numbering** (counters collection with `$inc`)
- ✅ Receipt printing (80mm thermal HTML, auto-print, includes restaurant header + GSTIN + footer + thali selections)
- ✅ Order history (date filter + receipt# search + view dialog + reprint)
- ✅ Revenue Dashboard: Today/Week/Month KPIs + 7-day trend + top items + top thalis + payment mix
- ✅ Reports: Sales/Products/Thali tabs · period (Today/Week/Month/Custom) · **CSV + Excel export**
- ✅ Restaurant Settings (name, address, GSTIN, phone, GST%, footer message)
- ✅ Role-gating: cashier sees only Billing + Orders; admin sees everything

## Removed in v0.3 (was in v0.1/0.2)
- Swiggy/Zomato Online Orders + simulators
- Kitchen KOT Board + KOT printing + SLA timer
- Tables / floor plan / reservations
- Inventory tracking + low-stock alerts
- Customer CRM + loyalty points
- Discounts/Coupons module
- Staff management + multi-role hierarchy
- Hybrid offline queue + sync indicator
- Google sign-in option

## Testing
- v0.1: 17/17 backend, 17/17 E2E
- v0.2: 18/18 backend, all flows
- **v0.3: 32/32 backend pytest, all frontend flows verified** (new test file `/app/backend/tests/test_thali_pos.py`)
- Credentials in `/app/memory/test_credentials.md`

## Open Items
**P0**
- (Cosmetic) Wrap Dashboard ResponsiveContainer parents in fixed-height containers to silence recharts warnings

**P1**
- GST rate from Settings should drive cart tax_rate instead of hardcoded 5%
- Cashier view of /orders could filter to own orders only

**P2 (Nice to have)**
- WhatsApp share receipt
- Recipe-based stock deduction (only if inventory comes back)
- Multi-outlet support
- Refund/void flow
- Audio click on tap-to-bill
