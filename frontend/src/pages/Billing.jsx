import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus, Minus, Trash2, Search, Banknote, CreditCard, Smartphone, Printer, Sparkles, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { printReceipt } from "../lib/receipt";
import ThaliBuilder from "../components/ThaliBuilder";

export default function Billing() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [thaliFor, setThaliFor] = useState(null);

  const refresh = async () => {
    const [c, m, s] = await Promise.all([
      api.get("/categories"),
      api.get("/menu"),
      api.get("/settings"),
    ]);
    setCategories(c.data);
    setMenu(m.data);
    setSettings(s.data);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    return menu.filter((m) =>
      (activeCat === "all" || m.category_id === activeCat) &&
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      m.available
    );
  }, [menu, activeCat, search]);

  const handleItemClick = (item) => {
    if (item.is_thali) {
      setThaliFor(item);
    } else {
      addToCart({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        tax_rate: 5.0,
        is_thali: false,
      });
    }
  };

  const addToCart = (line) => {
    setCart((c) => {
      // group same non-thali items
      if (!line.is_thali) {
        const idx = c.findIndex((x) => x.menu_item_id === line.menu_item_id && !x.is_thali);
        if (idx >= 0) {
          const next = [...c];
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
          return next;
        }
      }
      // thalis are always added as separate lines (different selections possible)
      return [...c, { ...line, _key: Math.random().toString(36).slice(2) }];
    });
  };

  const updateQty = (key, delta) => {
    setCart((c) => c.map((x) => x._key === key ? { ...x, qty: Math.max(1, x.qty + delta) } : x));
  };

  const removeLine = (key) => setCart((c) => c.filter((x) => x._key !== key));
  const clearCart = () => { setCart([]); setDiscount(0); };

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const tax = cart.reduce((s, x) => s + x.price * x.qty * (x.tax_rate / 100), 0);
  const total = Math.max(0, subtotal + tax - (Number(discount) || 0));

  const checkout = async (mode) => {
    if (!cart.length) return toast.error("Cart is empty");
    try {
      const payload = {
        items: cart.map(({ _key, ...rest }) => rest),
        discount: Number(discount) || 0,
        payment_mode: mode,
      };
      const { data } = await api.post("/orders", payload);
      toast.success(`Receipt #${data.receipt_no} · ₹${data.total} (${mode.toUpperCase()})`);
      printReceipt({ order: data, settings });
      clearCart();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Payment failed");
    }
  };

  return (
    <div className="h-screen grid grid-cols-12 gap-0 overflow-hidden">
      {/* Categories */}
      <div className="col-span-2 border-r border-border bg-white p-3 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground px-2 mb-2 mt-1">Categories</div>
        <button onClick={() => setActiveCat("all")} data-testid="cat-all"
          className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium mb-1 transition-all ${
            activeCat === "all" ? "bg-terracotta text-white" : "hover:bg-sand-subtle"
          }`}>
          All items
        </button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} data-testid={`cat-${c.id}`}
            className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium mb-1 transition-all ${
              activeCat === c.id ? "bg-terracotta text-white" : "hover:bg-sand-subtle"
            }`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="col-span-6 p-4 overflow-y-auto bg-sand-app">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Counter</div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Tap to bill</h1>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="menu-search" placeholder="Search menu…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="menu-grid">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-md bg-white/60">
              No items match. Activate items in <b>Daily Menu</b>.
            </div>
          )}
          {filtered.map((item) => (
            <button key={item.id} onClick={() => handleItemClick(item)}
              data-testid={`menu-item-${item.id}`}
              className={`tap-scale group text-left bg-white border rounded-md p-3 hover:-translate-y-0.5 transition-all ${
                item.is_thali ? "border-terracotta/40 hover:border-terracotta ring-1 ring-terracotta/10" : "border-border hover:border-terracotta"
              }`}>
              <div className="flex items-start justify-between min-h-[18px]">
                {item.is_thali && (
                  <span className="text-[9px] uppercase tracking-[0.2em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">Thali</span>
                )}
                {item.is_thali && <Sparkles className="w-3.5 h-3.5 text-terracotta" />}
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground leading-tight">{item.name}</div>
              <div className="mt-2 font-mono text-base font-bold text-terracotta">₹{item.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="col-span-4 border-l border-border bg-white flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Current bill</div>
            <div className="font-display text-lg font-bold">{cart.length} {cart.length === 1 ? "line" : "lines"}</div>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} data-testid="clear-cart"
              className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="cart-items">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground p-6">
              <ChefHat className="w-10 h-10 mb-3 text-muted-foreground/60" />
              Tap menu items to start a bill.
            </div>
          ) : cart.map((it) => (
            <div key={it._key} className="border-b border-border pb-3" data-testid={`cart-line-${it._key}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {it.is_thali && <span className="text-[9px] uppercase tracking-[0.18em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">Thali</span>}
                    <span className="text-sm font-semibold truncate">{it.name}</span>
                  </div>
                  {it.is_thali && it.thali_selections && (
                    <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      {Object.entries(it.thali_selections).map(([k, v]) => v.length ? `${k}: ${v.join(', ')}` : null).filter(Boolean).join(' · ')}
                      {it.thali_extras && <span> · <i>{it.thali_extras}</i></span>}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground font-mono mt-1">₹{it.price} × {it.qty} = ₹{(it.price * it.qty).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQty(it._key, -1)} data-testid={`dec-${it._key}`} className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center text-sm font-mono">{it.qty}</span>
                  <button onClick={() => updateQty(it._key, 1)} data-testid={`inc-${it._key}`} className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Plus className="w-3 h-3" /></button>
                  <button onClick={() => removeLine(it._key)} data-testid={`rm-${it._key}`} className="w-7 h-7 text-destructive hover:bg-destructive/10 rounded-md flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-sand-subtle">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono" data-testid="subtotal">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">GST</span>
            <span className="font-mono">₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Discount (₹)</span>
            <input data-testid="discount-input" type="number" value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-24 text-right bg-white border border-border rounded-md px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 mb-3">
            <span className="font-display font-bold">Total</span>
            <span className="font-mono text-2xl font-extrabold text-terracotta" data-testid="cart-total">₹{total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => checkout("cash")} disabled={!cart.length} data-testid="pay-cash"
              className="bg-foreground hover:bg-foreground/90 text-white">
              <Banknote className="w-4 h-4 mr-1.5" />Cash
            </Button>
            <Button onClick={() => checkout("upi")} disabled={!cart.length} data-testid="pay-upi"
              className="bg-terracotta hover:bg-terracotta-hover text-white">
              <Smartphone className="w-4 h-4 mr-1.5" />UPI
            </Button>
            <Button onClick={() => checkout("card")} disabled={!cart.length} data-testid="pay-card"
              variant="outline" className="border-border">
              <CreditCard className="w-4 h-4 mr-1.5" />Card
            </Button>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Printer className="w-3 h-3" /> Receipt auto-prints after payment
          </div>
        </div>
      </div>

      <ThaliBuilder
        open={!!thaliFor}
        onClose={() => setThaliFor(null)}
        thali={thaliFor}
        menu={menu}
        onAdd={addToCart}
      />
    </div>
  );
}
