import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Banknote, CreditCard, Smartphone, Printer, ChefHat, ShoppingCart, X, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { printReceipt } from "../lib/receipt";
import ThaliBuilder from "../components/ThaliBuilder";
import { useCart } from "../lib/useCart";
import { CartLine } from "../components/CartLine";
import { MenuTile } from "../components/MenuTile";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import ReceiptPreview from "../components/ReceiptPreview";
import { offlineStorage } from "../lib/offlineStorage";
import { syncQueue } from "../lib/syncQueue";
import { useOnlineStatus } from "../lib/offlineManager";

export default function Billing() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [thaliFor, setThaliFor] = useState(null);
  const [activeTab, setActiveTab] = useState("cart"); // "cart" or "receipt"
  const [showCartMobile, setShowCartMobile] = useState(false);

  const { user } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const { cart, discount, setDiscount, addLine, updateQty, removeLine, clear, totals } = useCart();
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    try {
      const [c, m, s] = await Promise.all([
        api.get("/categories"),
        api.get("/menu"),
        api.get("/settings"),
      ]);
      
      if (!Array.isArray(c.data) || !Array.isArray(m.data)) {
        throw new Error("Invalid format received from server (expected arrays)");
      }

      setCategories(c.data);
      setMenu(m.data);
      setSettings(s.data);
      // Cache data for offline use
      offlineStorage.saveCategories(c.data);
      offlineStorage.saveMenu(m.data);
      offlineStorage.saveSettings(s.data);
      if (s.data && s.data.language && !localStorage.getItem("pos_language")) {
        changeLanguage(s.data.language);
      }
    } catch (e) {
      // Network error or format error — load from cache
      const cachedCats = offlineStorage.loadCategories();
      const cachedMenu = offlineStorage.loadMenu();
      const cachedSettings = offlineStorage.loadSettings();
      if (cachedMenu && cachedMenu.length) {
        setCategories(cachedCats);
        setMenu(cachedMenu);
        setSettings(cachedSettings);
      } else {
        console.error("No cached data and server unreachable:", e);
      }
    }
  }, [changeLanguage]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const menuList = Array.isArray(menu) ? menu : [];
    return menuList.filter((m) =>
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
      current_stock: item.current_stock,
    });
  }, [addLine, settings]);

  const checkout = useCallback(async (mode) => {
    if (!cart.length) {
      toast.error(t("no_items_in_cart"));
      return;
    }
    const payload = {
      items: cart.map(({ _key, ...rest }) => rest),
      discount: totals.discount,
      payment_mode: mode,
    };

    if (!isOnline) {
      // Offline: save to sync queue and show local receipt
      const queued = syncQueue.enqueue(payload);
      const offlineOrder = {
        receipt_no: queued.id,
        items: payload.items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        payment_mode: mode,
        created_at: new Date().toISOString(),
        _offline: true,
      };
      toast.warning(`📵 Offline — order saved locally. Will sync when online.`);
      if (settings?.auto_print !== false) {
        printReceipt({ order: offlineOrder, settings });
      }
      clear();
      setShowCartMobile(false);
      return;
    }

    try {
      const { data } = await api.post("/orders", payload);
      toast.success(`${t("checkout_success")} · #${data.receipt_no} · ₹${data.total} (${mode.toUpperCase()})`);
      if (settings?.auto_print !== false) {
        printReceipt({ order: data, settings });
      }
      clear();
      setShowCartMobile(false);
      refresh(); // Reload menu with updated stock
    } catch (e) {
      // Network error mid-checkout — queue the order
      if (!e.response) {
        const queued = syncQueue.enqueue(payload);
        toast.warning(`📵 Server unreachable — order queued for sync.`);
        clear();
        setShowCartMobile(false);
      } else {
        toast.error(e?.response?.data?.detail || t("checkout_failed"));
      }
    }
  }, [cart, totals, isOnline, settings, clear, refresh, t]);

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen grid grid-cols-12 gap-0 overflow-hidden relative">
      {/* Items grid */}
      <div className="col-span-12 lg:col-span-8 p-4 overflow-y-auto bg-sand-app h-full">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{t("thali_billing_counter")}</div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("tap_to_bill")}</h1>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input data-testid="menu-search" placeholder={t("search_menu")}
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white" />
            </div>
          </div>

          {/* Horizontal Categories Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            <button onClick={() => setActiveCat("all")} data-testid="cat-all"
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                activeCat === "all" 
                  ? "bg-terracotta text-white border-terracotta shadow-sm" 
                  : "bg-white hover:bg-sand-subtle border-border text-muted-foreground hover:text-foreground"
              }`}>
              {t("all_items")}
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} data-testid={`cat-${c.id}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                  activeCat === c.id 
                    ? "bg-terracotta text-white border-terracotta shadow-sm" 
                    : "bg-white hover:bg-sand-subtle border-border text-muted-foreground hover:text-foreground"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20 lg:pb-0" data-testid="menu-grid">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-md bg-white/60">
              {t("no_items_match")}
            </div>
          ) : filtered.map((item) => (
            <MenuTile key={item.id} item={item} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      </div>

      {/* Mobile Cart Backdrop */}
      {showCartMobile && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setShowCartMobile(false)}
        />
      )}

      {/* Cart Panel - Slide-in on mobile, Sidebar column on desktop */}
      <div className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] border-l border-border bg-white flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-auto lg:col-span-4 ${
        showCartMobile ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{t("current_bill")}</div>
            <div className="font-display text-lg font-bold">{cart.length} {cart.length === 1 ? t("line") : t("lines")}</div>
          </div>
          <div className="flex items-center gap-4">
            {cart.length > 0 && (
              <button onClick={() => {
                if (window.confirm(t("confirm_clear_cart"))) {
                  clear();
                }
              }} data-testid="clear-cart"
                className="text-xs text-muted-foreground hover:text-destructive">{t("clear")}</button>
            )}
            <button 
              onClick={() => setShowCartMobile(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-sand-subtle text-foreground transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-border text-xs">
          <button
            onClick={() => setActiveTab("cart")}
            className={`flex-1 py-2.5 font-bold uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === "cart"
                ? "border-terracotta text-terracotta bg-sand-subtle/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("cart_list")}
          </button>
          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex-1 py-2.5 font-bold uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === "receipt"
                ? "border-terracotta text-terracotta bg-sand-subtle/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("receipt_preview")}
          </button>
        </div>

        {activeTab === "cart" ? (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="cart-items">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground p-6">
                <ChefHat className="w-10 h-10 mb-3 text-muted-foreground/60" />
                {t("thali_builder_start_bill")}
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
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center bg-neutral-50" data-testid="receipt-preview-pane">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground p-6">
                <ChefHat className="w-10 h-10 mb-3 text-muted-foreground/60" />
                {t("cart_empty_preview")}
              </div>
            ) : (
              <ReceiptPreview
                order={{
                  items: cart,
                  subtotal: totals.subtotal,
                  tax: totals.tax,
                  discount: totals.discount,
                  total: totals.total,
                  cashier_name: user?.name || "Owner",
                }}
                settings={settings}
                editable={false}
              />
            )}
          </div>
        )}

        <div className="p-4 border-t border-border bg-sand-subtle">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span className="font-mono" data-testid="subtotal">₹{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">{settings?.tax_label || "GST"}</span>
            <span className="font-mono">₹{totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t("discount_rs")}</span>
            <input data-testid="discount-input" type="number" value={discount}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                const maxDiscount = totals.subtotal + totals.tax;
                if (val < 0) {
                  toast.error(t("discount_cannot_be_negative"));
                  setDiscount(0);
                } else if (val > maxDiscount) {
                  toast.error(`Discount cannot exceed ₹${maxDiscount.toFixed(2)}`);
                  setDiscount(maxDiscount);
                } else {
                  setDiscount(e.target.value);
                }
              }}
              className="w-24 text-right bg-white border border-border rounded-md px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 mb-3">
            <span className="font-display font-bold">{t("total")}</span>
            <span className="font-mono text-2xl font-extrabold text-terracotta" data-testid="cart-total">
              ₹{totals.total.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => checkout("cash")} disabled={!cart.length} data-testid="pay-cash"
              className="bg-foreground hover:bg-foreground/90 text-white">
              <Banknote className="w-4 h-4 mr-1.5" />{t("cash")}
            </Button>
            <Button onClick={() => checkout("upi")} disabled={!cart.length} data-testid="pay-upi"
              className="bg-terracotta hover:bg-terracotta-hover text-white">
              <Smartphone className="w-4 h-4 mr-1.5" />{t("upi")}
            </Button>
            <Button onClick={() => checkout("card")} disabled={!cart.length} data-testid="pay-card"
              variant="outline" className="border-border">
              <CreditCard className="w-4 h-4 mr-1.5" />{t("card")}
            </Button>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Printer className="w-3 h-3" /> {t("receipt_autoprints")}
          </div>
        </div>
      </div>

      {/* Floating Cart Button for Mobile */}
      <button
        onClick={() => setShowCartMobile(true)}
        className="lg:hidden fixed bottom-6 right-6 bg-terracotta text-white p-4 rounded-full shadow-lg z-30 flex items-center gap-2 hover:bg-terracotta/90 transition-all active:scale-95 duration-150"
      >
        <ShoppingCart className="w-6 h-6" />
        {cart.length > 0 && (
          <span className="bg-white text-terracotta text-xs font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
            {cart.length}
          </span>
        )}
      </button>

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
