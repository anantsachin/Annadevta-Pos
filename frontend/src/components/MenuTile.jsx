import React from "react";
import { Sparkles, Plus } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

function MenuTileComponent({ item, onClick }) {
  const { t } = useLanguage();

  const stockColor =
    item.current_stock <= 0
      ? "bg-red-100 text-red-600"
      : item.current_stock <= (item.reorder_level || 10)
      ? "bg-orange-100 text-orange-700"
      : "bg-green-100 text-green-700";

  return (
    <button
      onClick={onClick}
      data-testid={`menu-item-${item.id}`}
      className="group relative bg-white border border-slate-200 rounded-3xl p-5 text-left hover:border-terracotta/40 hover:shadow-lg transition-all duration-200"
    >
      {/* Category Badge */}
      <div className="flex items-center justify-between">
        {item.is_thali ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            THALI
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold px-3 py-1 uppercase tracking-wider">
            ITEM
          </span>
        )}

        {item.current_stock !== null &&
          item.current_stock !== undefined && (
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full ${stockColor}`}
            >
              {item.current_stock % 1 !== 0
                ? Number(item.current_stock).toFixed(3)
                : item.current_stock}
            </span>
          )}
      </div>

      {/* Name */}
      <div className="mt-6">
        <h3 className="text-xl font-bold text-slate-800 leading-tight">
          {t(item.name)}
        </h3>

        <p className="text-sm text-slate-400 mt-2">
          Ready to serve
        </p>
      </div>

      {/* Bottom */}
      <div className="mt-10 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Price
          </div>

          <div className="text-3xl font-extrabold text-terracotta">
            ₹{item.price}
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-terracotta text-white flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6" />
        </div>
      </div>
    </button>
  );
}

export const MenuTile = React.memo(MenuTileComponent);