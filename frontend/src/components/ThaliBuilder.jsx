import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Check } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function ThaliBuilder({ open, onClose, thali, menu, onAdd }) {
  const [picks, setPicks] = useState({});
  const [breadConsumed, setBreadConsumed] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      setPicks({});
      // Set initial bread consumed to included count
      setBreadConsumed(thali?.included_bread_count || 0);
    }
  }, [open, thali?.id, thali?.included_bread_count]);

  if (!thali) return null;
  const groups = thali.thali_groups || [];

  const toggle = (catId, itemName, max) => {
    setPicks((p) => {
      const cur = p[catId] || [];
      if (cur.includes(itemName)) return { ...p, [catId]: cur.filter((x) => x !== itemName) };
      if (cur.length >= max) {
        // replace oldest
        return { ...p, [catId]: [...cur.slice(1), itemName] };
      }
      return { ...p, [catId]: [...cur, itemName] };
    });
  };

  const allFilled = groups.every((g) => (picks[g.category_id] || []).length === g.count);

  const includedBread = thali.included_bread_count || 0;
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
      qty: 1,
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
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {thali.name} <span className="text-terracotta font-mono text-lg">₹{thali.price}</span>
          </DialogTitle>
          <DialogDescription>
            {thali.thali_extras ? <span>{t("includes")}: <span className="text-foreground">{thali.thali_extras}</span></span> : t("pick_todays_items")}
          </DialogDescription>
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
                  <div className={`text-xs font-mono font-semibold ${chosen.length === g.count ? "text-forest" : "text-amber-600"}`}>
                    {chosen.length} / {g.count} {t("picked")}
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3 px-3 border border-dashed border-border rounded-md">
                    {t("no_items_available_today")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map((it) => {
                      const selected = chosen.includes(it.name);
                      return (
                        <button key={it.id} type="button"
                          onClick={() => toggle(g.category_id, it.name, g.count)}
                          data-testid={`thali-pick-${it.id}`}
                          className={`tap-scale text-left p-3 rounded-md border transition-all ${
                            selected
                              ? "border-terracotta bg-terracotta-light text-foreground"
                              : "border-border bg-white hover:border-terracotta/50"
                          }`}>
                          <div className="flex items-start justify-between">
                            <span className="text-sm font-semibold">{it.name}</span>
                            {selected && <Check className="w-4 h-4 text-terracotta" />}
                          </div>
                        </button>
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
