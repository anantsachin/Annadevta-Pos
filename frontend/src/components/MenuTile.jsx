import React from "react";
import { Sparkles, Plus } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

function MenuTileComponent({ item, onClick }) {
  const { t } = useLanguage();

  const stockColor =
    item.current_stock <= 0
      ? "bg-red-100 text-red-600"
      : item.current_stock <= (item.reorder_level || 10)
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <button
      onClick={onClick}
      data-testid={`menu-item-${item.id}`}
      className="
        group
        relative
        overflow-hidden
        h-[250px] flex flex-col
        w-full
        rounded-[26px]
        border
        border-orange-100
        bg-white
        p-6
        text-left
        shadow-sm
        hover:shadow-md
        transition-all
        duration-300
        hover:border-orange-200
      "
    >
      {/* Decorative Glow */}
      {/* <div className="pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-gradient-to-br from-terracota-100 via-terracota-200 to-terracota-400 opacity-[0.08] blur-3xl transition-opacity duration-300 group-hover:opacity-[0.16]" /> */}

      {/* Header */}
      <div className="flex items-start justify-between relative z-10">
        {item.is_thali ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
            <Sparkles className="h-3 w-3" />
            THALI
          </span>
        ) : (
          <span className="rounded-full bg-[#F0F8DC] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-[#6B9A1F]">
            ITEM
          </span>
        )}

        {item.current_stock !== null &&
          item.current_stock !== undefined && (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stockColor}`}
            >
              {item.current_stock % 1 !== 0
                ? Number(item.current_stock).toFixed(3)
                : item.current_stock}
            </span>
          )}
      </div>

      {/* Content */}
      <div className="relative z-10 mt-5 flex-1 flex flex-col">

      <h3 className="line-clamp-2 text-[24px] font-bold leading-tight text-slate-900">
      {t(item.name)}
      </h3>

      <div className="mt-auto border-t border-dashed border-orange-100 pt-4">

      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
      Price
      </div>

    </div>

</div>

      {/* Bottom */}
      <div className="relative z-10 mt-auto flex w-full items-end justify-between">
        <div>
      
          <div className="mt-1 text-[26px] font-black tracking-[-0.04em] text-brand-600">
            ₹{item.price}
          </div>
        </div>

        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            bg-gradient-to-br
            from-brand-400
            to-brand-600
            text-white
            shadow-button
            transition-all
            duration-300
            group-hover:scale-110
          "
        >
          <Plus className="h-5 w-5" />
        </div>
      </div>

      {/* Watermark */}
      <div
        className="
        pointer-events-none
        absolute
        bottom-8
        right-0
        opacity-[0.1]
        text-[80px]
        select-none
        -scale-x-100"
      >
      🌿
      </div>
    </button>
  );
}

export const MenuTile = React.memo(MenuTileComponent);