import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Plus, Minus, Trash2, Send, CreditCard, Search, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { offlineQueue } from "../lib/offlineQueue";

export default function POS() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState("");
  const [orderType, setOrderType] = useState("dine_in");
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setOn = () => setOnline(true);
    const setOff = () => setOnline(false);
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    return () => { window.removeEventListener("online", setOn); window.removeEventListener("offline", setOff); };
  }, []);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data));
    api.get("/menu").then(r => setMenu(r.data));
    api.get("/tables").then(r => setTables(r.data));
  }, []);

  const filteredMenu = useMemo(() => {
    return menu.filter(m =>
      (activeCat === "all" || m.category_id === activeCat) &&
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      m.available
    );
  }, [menu, activeCat, search]);

  const addToCart = (item) => {
    setCart((c) => {
      const existing = c.find((x) => x.menu_item_id === item.id);
      if (existing) return c.map((x) => x.menu_item_id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { menu_item_id: item.id, name: item.name, price: item.price, qty: 1, tax_rate: item.tax_rate || 5.0, notes: "" }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((c) => c.map(x => x.menu_item_id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x));
  };
  const removeItem = (id) => setCart((c) => c.filter(x => x.menu_item_id !== id));

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const tax = cart.reduce((s, x) => s + x.price * x.qty * (x.tax_rate / 100), 0);
  const total = Math.max(0, subtotal + tax - discount);

  const payload = () => ({
    type: orderType,
    table_id: orderType === "dine_in" ? tableId || null : null,
    items: cart,
    customer_name: customerName,
    customer_phone: customerPhone,
    discount: Number(discount) || 0,
  });

  const sendKOT = async () => {
    if (!cart.length) return toast.error("Cart is empty");
    if (orderType === "dine_in" && !tableId) return toast.error("Select a table");
    try {
      if (!navigator.onLine) {
        offlineQueue.add(payload());
        toast.success("Saved offline. Will sync when online.");
        resetCart();
        return;
      }
      const { data } = await api.post("/orders", payload());
      await api.patch(`/orders/${data.id}/kot`, { kot_status: "preparing" });
      toast.success(`Order sent to kitchen (₹${data.total})`);
      resetCart();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const checkout = async (mode) => {
    if (!cart.length) return toast.error("Cart is empty");
    try {
      const { data } = await api.post("/orders", payload());
      await api.post(`/orders/${data.id}/pay`, { payment_mode: mode, amount: data.total });
      toast.success(`Paid ₹${data.total} via ${mode.toUpperCase()}`);
      resetCart();
      api.get("/tables").then(r => setTables(r.data));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const resetCart = () => {
    setCart([]); setDiscount(0); setCustomerName(""); setCustomerPhone(""); setTableId("");
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-12 gap-0">
      {/* Categories */}
      <div className="col-span-2 border-r border-border bg-white p-3 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground px-2 mb-2">Categories</div>
        <button onClick={() => setActiveCat("all")} data-testid="cat-all"
          className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-all ${activeCat === "all" ? "bg-terracotta text-white" : "hover:bg-sand-subtle"}`}>
          All
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} data-testid={`cat-${c.id}`}
            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-all ${activeCat === c.id ? "bg-terracotta text-white" : "hover:bg-sand-subtle"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="col-span-6 p-4 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="menu-search" placeholder="Search menu…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            {online ? <Wifi className="w-3.5 h-3.5 text-forest" /> : <WifiOff className="w-3.5 h-3.5 text-destructive" />}
            <span className="text-muted-foreground">{online ? "Live" : "Offline mode"}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="menu-grid">
          {filteredMenu.map(item => (
            <button key={item.id} onClick={() => addToCart(item)} data-testid={`menu-item-${item.id}`}
              className="tap-scale group text-left bg-white border border-border rounded-md p-3 hover:border-terracotta hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between">
                <span className={`w-3 h-3 border ${item.is_veg ? 'border-forest' : 'border-destructive'} rounded-sm flex items-center justify-center`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-forest' : 'bg-destructive'}`} />
                </span>
                <div className="text-[10px] font-mono text-muted-foreground">{item.tax_rate}% GST</div>
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground leading-tight">{item.name}</div>
              <div className="mt-2 font-mono text-base font-bold text-terracotta">₹{item.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="col-span-4 border-l border-border bg-white flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex gap-2 mb-3" data-testid="order-type-tabs">
            {["dine_in", "takeaway"].map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                data-testid={`type-${t}`}
                className={`flex-1 text-xs font-semibold uppercase tracking-wider py-2 rounded-md transition-all ${orderType === t ? "bg-terracotta text-white" : "bg-sand-subtle text-foreground"}`}>
                {t === "dine_in" ? "Dine-in" : "Takeaway"}
              </button>
            ))}
          </div>
          {orderType === "dine_in" && (
            <select value={tableId} onChange={(e) => setTableId(e.target.value)}
              data-testid="table-select"
              className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm">
              <option value="">Select table…</option>
              {tables.filter(t => t.status !== "occupied" || t.id === tableId).map(t => (
                <option key={t.id} value={t.id}>{t.number} • Seats {t.capacity}</option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Input data-testid="cust-name" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input data-testid="cust-phone" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2" data-testid="cart-items">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground p-8">
              Tap menu items to start an order.
            </div>
          ) : cart.map((it) => (
            <div key={it.menu_item_id} className="flex items-center gap-2 border-b border-border pb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground font-mono">₹{it.price} × {it.qty} = ₹{(it.price * it.qty).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(it.menu_item_id, -1)} data-testid={`cart-dec-${it.menu_item_id}`} className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Minus className="w-3 h-3" /></button>
                <span className="w-7 text-center text-sm font-mono">{it.qty}</span>
                <button onClick={() => updateQty(it.menu_item_id, 1)} data-testid={`cart-inc-${it.menu_item_id}`} className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Plus className="w-3 h-3" /></button>
                <button onClick={() => removeItem(it.menu_item_id)} data-testid={`cart-rm-${it.menu_item_id}`} className="w-7 h-7 text-destructive hover:bg-destructive/10 rounded-md flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-sand-subtle">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Subtotal</span><span className="font-mono">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Tax</span><span className="font-mono">₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Discount</span>
            <input data-testid="discount-input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 text-right bg-white border border-border rounded-md px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 mb-3">
            <span className="font-display font-bold">Total</span>
            <span className="font-mono text-xl font-extrabold text-terracotta" data-testid="cart-total">₹{total.toFixed(2)}</span>
          </div>
          <Button onClick={sendKOT} data-testid="send-kot-btn" className="w-full bg-secondary hover:bg-forest-hover text-white mb-2">
            <Send className="w-4 h-4 mr-2" /> Send to Kitchen
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => checkout("cash")} data-testid="pay-cash-btn" className="border-border">Cash</Button>
            <Button variant="outline" onClick={() => checkout("card")} data-testid="pay-card-btn" className="border-border">Card</Button>
            <Button onClick={() => checkout("upi")} data-testid="pay-upi-btn" className="bg-terracotta hover:bg-terracotta-hover text-white">
              <CreditCard className="w-4 h-4 mr-1" />UPI
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
