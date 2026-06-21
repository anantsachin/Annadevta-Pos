import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Check } from "lucide-react";

export default function ThaliBuilder({ open, onClose, thali, menu, onAdd }) {
  const [picks, setPicks] = useState({});

  useEffect(() => {
    if (open) setPicks({});
  }, [open, thali?.id]);

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
            {thali.thali_extras ? <span>Includes: <span className="text-foreground">{thali.thali_extras}</span></span> : "Pick from today's available items."}
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
                    {chosen.length} / {g.count} picked
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3 px-3 border border-dashed border-border rounded-md">
                    No {g.label?.toLowerCase() || "items"} available today. Activate items in Daily Menu.
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border" data-testid="thali-cancel">Cancel</Button>
          <Button onClick={handleAdd} disabled={!allFilled} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="thali-confirm">
            Add to bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
