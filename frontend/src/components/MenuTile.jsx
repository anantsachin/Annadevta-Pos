import React from "react";
import { Sparkles } from "lucide-react";

function MenuTileComponent({ item, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`menu-item-${item.id}`}
      className={`tap-scale group text-left bg-white border rounded-md p-3 hover:-translate-y-0.5 transition-all ${
        item.is_thali
          ? "border-terracotta/40 hover:border-terracotta ring-1 ring-terracotta/10"
          : "border-border hover:border-terracotta"
      }`}>
      <div className="flex items-start justify-between min-h-[18px]">
        {item.is_thali && (
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">
            Thali
          </span>
        )}
        {item.is_thali && <Sparkles className="w-3.5 h-3.5 text-terracotta" />}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground leading-tight">{item.name}</div>
      <div className="mt-2 font-mono text-base font-bold text-terracotta">₹{item.price}</div>
    </button>
  );
}

export const MenuTile = React.memo(MenuTileComponent);
