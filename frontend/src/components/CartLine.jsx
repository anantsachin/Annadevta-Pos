import React, { useMemo } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";

function formatThaliSelections(selections) {
  if (!selections) return "";
  return Object.entries(selections)
    .map(([k, v]) => (v && v.length ? `${k}: ${v.join(", ")}` : null))
    .filter(Boolean)
    .join(" · ");
}

function CartLineComponent({ line, onInc, onDec, onRemove }) {
  const selectionsText = useMemo(() => formatThaliSelections(line.thali_selections), [line.thali_selections]);
  return (
    <div className="border-b border-border pb-3" data-testid={`cart-line-${line._key}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {line.is_thali && <span className="text-[9px] uppercase tracking-[0.18em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">Thali</span>}
            <span className="text-sm font-semibold truncate">{line.name}</span>
          </div>
          {line.is_thali && selectionsText && (
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {selectionsText}
              {line.thali_extras && <span> · <i>{line.thali_extras}</i></span>}
            </div>
          )}
          {line.extra_bread > 0 && (
            <div className="text-[11px] text-amber-700 mt-1 font-medium">
              🍞 Extra Roti ({line.extra_bread}) · ₹{line.extra_bread_charge.toFixed(2)}
            </div>
          )}
          <div className="text-xs text-muted-foreground font-mono mt-1">
            ₹{line.price} × {line.qty} = ₹{(line.price * line.qty).toFixed(2)}
            {line.extra_bread_charge > 0 && <span className="text-amber-700"> + ₹{line.extra_bread_charge.toFixed(2)}</span>}
          </div>
          {line.current_stock !== undefined && line.current_stock !== null && (
            <div className="text-[11px] text-forest font-medium mt-1">
              Available Stock: {line.current_stock % 1 !== 0 ? line.current_stock.toFixed(3) + ' kg' : line.current_stock}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onDec} data-testid={`dec-${line._key}`}
            className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Minus className="w-3 h-3" /></button>
          <span className="w-6 text-center text-sm font-mono">{line.qty}</span>
          <button onClick={onInc} data-testid={`inc-${line._key}`}
            className="w-7 h-7 border border-border rounded-md flex items-center justify-center hover:bg-sand-subtle"><Plus className="w-3 h-3" /></button>
          <button onClick={onRemove} data-testid={`rm-${line._key}`}
            className="w-7 h-7 text-destructive hover:bg-destructive/10 rounded-md flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}

export const CartLine = React.memo(CartLineComponent);
