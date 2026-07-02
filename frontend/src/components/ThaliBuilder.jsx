import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Check } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function ThaliBuilder({ open, onClose, thali, menu, onAdd }) {
  const [picks, setPicks] = useState({});
  const [breadConsumed, setBreadConsumed] = useState(0);
  const [thaliQty, setThaliQty] = useState(1);
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      setPicks({});
      setThaliQty(1);
      // Set initial bread consumed to included count
      setBreadConsumed(thali?.included_bread_count || 0);
    }
  }, [open, thali?.id, thali?.included_bread_count]);

  if (!thali) return null;
  const groups = thali.thali_groups || [];

  const handleQtyChange = (delta) => {
    setThaliQty((prev) => {
      const next = Math.max(1, prev + delta);
      // Scale bread
      if (thali?.included_bread_count) {
         setBreadConsumed(thali.included_bread_count * next);
      }
      // Trim picks if needed
      setPicks(p => {
         const np = { ...p };
         let changed = false;
         (thali.thali_groups || []).forEach(g => {
            const max = g.count * next;
            if ((np[g.category_id] || []).length > max) {
               np[g.category_id] = np[g.category_id].slice(-max);
               changed = true;
            }
         });
         return changed ? np : p;
      });
      return next;
    });
  };

  const addPick = (catId, itemName, max) => {
    setPicks((p) => {
      const cur = p[catId] || [];
      if (cur.length >= max) {
        return { ...p, [catId]: [...cur.slice(1), itemName] };
      }
      return { ...p, [catId]: [...cur, itemName] };
    });
  };

  const removePick = (catId, itemName) => {
    setPicks((p) => {
      const cur = p[catId] || [];
      const idx = cur.lastIndexOf(itemName);
      if (idx === -1) return p;
      const nextArr = [...cur];
      nextArr.splice(idx, 1);
      return { ...p, [catId]: nextArr };
    });
  };

  const allFilled = groups.every((g) => (picks[g.category_id] || []).length === g.count * thaliQty);

  const includedBread = (thali.included_bread_count || 0) * thaliQty;
  const extraBreadPrice = thali.extra_bread_price || 10;
  const breadMode = thali.bread_mode || "fixed";
  const isUnlimited = breadMode === "unlimited";
  
  const extraBread = isUnlimited ? 0 : Math.max(0, breadConsumed - includedBread);
  const extraBreadCharge = extraBread * extraBreadPrice;

  const handleAdd = () => {
    const selections = {};
    groups.forEach((g) => {
      selections[g.label || g.category_id] = picks[g.category_id] || [];
    });
    onAdd({
      menu_item_id: thali.id,
      name: thali.name,
      price: thali.price,
      qty: thaliQty,
      tax_rate: 5.0,
      is_thali: true,
      thali_selections: selections,
      thali_extras: thali.thali_extras || "",
      bread_consumed: breadConsumed,
      extra_bread: extraBread,
      extra_bread_charge: extraBreadCharge,
      current_stock: thali.current_stock,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="thali-builder">
        <DialogHeader className="mb-2">
          <div className="flex items-start justify-between pr-8">
            <div>
              <DialogTitle className="font-display text-2xl tracking-tight">
                {thali.name} <span className="text-terracotta font-mono text-lg ml-2">₹{thali.price * thaliQty}</span>
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {thali.thali_extras ? <span>{t("includes")}: <span className="text-foreground">{thali.thali_extras}</span></span> : t("pick_todays_items")}
              </DialogDescription>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Quantity</span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded bg-white shadow-sm border border-slate-200" onClick={() => handleQtyChange(-1)} disabled={thaliQty <= 1}>−</Button>
                <span className="font-mono font-bold text-base w-6 text-center">{thaliQty}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded bg-white shadow-sm border border-slate-200" onClick={() => handleQtyChange(1)}>+</Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto py-2">
          {groups.map((g) => {
            const items = menu.filter((m) => m.category_id === g.category_id && m.available && !m.is_thali);
            const chosen = picks[g.category_id] || [];
            return (
              <div key={g.category_id} data-testid={`thali-group-${g.category_id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                    {g.label || "Group"}
                  </div>
                  <div className={`text-xs font-mono font-semibold ${chosen.length === g.count * thaliQty ? "text-forest" : "text-amber-600"}`}>
                    {chosen.length} / {g.count * thaliQty} {t("picked")}
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3 px-3 border border-dashed border-border rounded-md">
                    {t("no_items_available_today")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map((it) => {
                      const countInChosen = chosen.filter(x => x === it.name).length;
                      const maxQty = g.count * thaliQty;
                      return (
                        <div key={it.id}
                          onClick={() => addPick(g.category_id, it.name, maxQty)}
                          data-testid={`thali-pick-${it.id}`}
                          className={`cursor-pointer tap-scale text-left p-3 rounded-md border transition-all ${
                            countInChosen > 0
                              ? "border-terracotta bg-terracotta-light text-foreground"
                              : "border-border bg-white hover:border-terracotta/50"
                          }`}>
                          <div className="flex items-start justify-between gap-1.5 min-h-[24px]">
                            <span className="text-sm font-semibold flex items-center gap-1.5 flex-wrap flex-1">
                              <span>{it.name}</span>
                              {it.current_stock !== undefined && it.current_stock !== null && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  it.current_stock <= 0 
                                    ? "bg-red-50 text-red-600 border border-red-200" 
                                    : it.current_stock <= (it.reorder_level || 5) 
                                    ? "bg-amber-50 text-amber-700 border border-amber-200" 
                                    : "bg-slate-50 text-slate-600 border border-slate-200"
                                }`}>
                                  {it.current_stock % 1 !== 0 ? it.current_stock.toFixed(3) : it.current_stock} kg
                                </span>
                              )}
                            </span>
                            {countInChosen > 0 && (
                              <div className="flex items-center gap-2 bg-white rounded-md border border-terracotta/30 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={() => removePick(g.category_id, it.name)} className="w-6 h-6 flex items-center justify-center text-terracotta hover:bg-terracotta/10 rounded">
                                  −
                                </button>
                                <span className="font-bold text-sm text-terracotta w-3 text-center">{countInChosen}</span>
                                <button type="button" onClick={() => addPick(g.category_id, it.name, maxQty)} className="w-6 h-6 flex items-center justify-center text-terracotta hover:bg-terracotta/10 rounded">
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bread Consumption Section */}
        {includedBread > 0 && (
          <div className="border-t border-border pt-4 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-amber-900 mb-3">
                🍞 Bread Consumption
              </div>
              
              {isUnlimited ? (
                <div className="text-center py-2">
                  <div className="text-lg font-bold text-forest">
                    ∞ Unlimited Bread Included
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    No extra charges for bread
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Included:</span>
                    <span className="font-mono font-semibold">{includedBread}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consumed:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBreadConsumed(Math.max(0, breadConsumed - 1))}
                        className="h-8 w-8 p-0"
                      >
                        −
                      </Button>
                      <span className="font-mono font-bold text-lg w-12 text-center">
                        {breadConsumed}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBreadConsumed(breadConsumed + 1)}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {extraBread > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm border-t border-amber-300 pt-2">
                        <span className="text-amber-800 font-medium">Extra Bread:</span>
                        <span className="font-mono font-semibold text-amber-900">{extraBread}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-amber-800 font-medium">Extra Charge:</span>
                        <span className="font-mono font-bold text-lg text-terracotta">
                          ₹{extraBreadCharge.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border" data-testid="thali-cancel">{t("cancel")}</Button>
          <Button onClick={handleAdd} disabled={!allFilled} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="thali-confirm">
            {t("add_to_bill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
