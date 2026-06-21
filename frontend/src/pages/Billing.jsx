import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Banknote, CreditCard, Smartphone, Printer, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { printReceipt } from "../lib/receipt";
import ThaliBuilder from "../components/ThaliBuilder";
import { useCart } from "../lib/useCart";
import { CartLine } from "../components/CartLine";
import { MenuTile } from "../components/MenuTile";

export default function Billing() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [thaliFor, setThaliFor] = useState(null);

  const { cart, discount, setDiscount, addLine, updateQty, removeLine, clear, totals } = useCart();

  const refresh = useCallback(async () => {
    const [c, m, s] = await Promise.all([
      api.get("/categories"),
      api.get("/menu"),
      api.get("/settings"),
    ]);
    setCategories(c.data);
    setMenu(m.data);
    setSettings(s.data);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) =>
      (activeCat === "all" || m.category_id === activeCat) &&
      (!q || m.name.toLowerCase().includes(q)) &&
      m.available
    );
  }, [menu, activeCat, search]);

  const handleItemClick = useCallback((item) => {
    if (item.is_thali) {
      setThaliFor(item);
      return;
    }
    addLine({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      tax_rate: settings?.gst_rate ?? 5.0,
      is_thali: false,
    });
  }, [addLine, settings]);

  const checkout = useCallback(async (mode) => {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }
    try {
      const payload = {
        items: cart.map(({ _key, ...rest }) => rest),
        discount: totals.discount,
        payment_mode: mode,
      };
      const { data } = await api.post("/orders", payload);
      toast.success(`Receipt #${data.receipt_no} · ₹${data.total} (${mode.toUpperCase()})`);
      if (settings?.auto_print !== false) {
        printReceipt({ order: data, settings });
      }
      clear();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Payment failed");
    }
  }, [cart, totals.discount, settings, clear]);

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
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-md bg-white/60">
              No items match. Activate items in <b>Daily Menu</b>.
            </div>
          ) : filtered.map((item) => (
            <MenuTile key={item.id} item={item} onClick={() => handleItemClick(item)} />
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
            <button onClick={clear} data-testid="clear-cart"
              className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="cart-items">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground p-6">
              <ChefHat className="w-10 h-10 mb-3 text-muted-foreground/60" />
              Tap menu items to start a bill.
            </div>
          ) : cart.map((line) => (
            <CartLine
              key={line._key}
              line={line}
              onInc={() => updateQty(line._key, 1)}
              onDec={() => updateQty(line._key, -1)}
              onRemove={() => removeLine(line._key)}
            />
          ))}
        </div>

        <div className="p-4 border-t border-border bg-sand-subtle">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono" data-testid="subtotal">₹{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">GST</span>
            <span className="font-mono">₹{totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Discount (₹)</span>
            <input data-testid="discount-input" type="number" value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-24 text-right bg-white border border-border rounded-md px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 mb-3">
            <span className="font-display font-bold">Total</span>
            <span className="font-mono text-2xl font-extrabold text-terracotta" data-testid="cart-total">
              ₹{totals.total.toFixed(2)}
            </span>
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
        onAdd={addLine}
      />
    </div>
  );
}
