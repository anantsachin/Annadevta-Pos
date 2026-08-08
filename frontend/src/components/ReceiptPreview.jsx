import React, { useMemo } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { getCurrentToken } from "../lib/tokenManager";

function getItemSubItems(item, t, menuList = []) {
  if (!item) return [];

  const itemMap = new Map();

  const parseItem = (str) => {
    if (!str) return null;
    const trimmed = String(str).trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(.+?)\s*(?:\((\d+)\))?$/);
    if (!match) return null;
    const name = match[1].trim();
    const qty = match[2] ? parseInt(match[2], 10) : 1;
    return { name, qty };
  };

  const processSingle = (val) => {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return;

      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsedJSON = JSON.parse(trimmed);
          if (parsedJSON) {
            processSingle(parsedJSON);
            return;
          }
        } catch (e) {
          // Fallback to comma split
        }
      }

      const parts = trimmed.split(',');
      for (const part of parts) {
        const parsed = parseItem(part);
        if (parsed && parsed.name) {
          const currentQty = itemMap.get(parsed.name) || 0;
          itemMap.set(parsed.name, currentQty + parsed.qty);
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        val.forEach(processSingle);
      } else if (val.by_category && typeof val.by_category === 'object') {
        processSingle(val.by_category);
      } else if (val.name || val.item_name || val.label || val.title) {
        const name = val.name || val.item_name || val.label || val.title;
        const qty = Number(val.qty || val.quantity || val.count || 1);
        if (typeof name === 'string') {
          const parsed = parseItem(name);
          if (parsed && parsed.name) {
            const currentQty = itemMap.get(parsed.name) || 0;
            itemMap.set(parsed.name, currentQty + (parsed.qty * qty));
          }
        }
      } else {
        Object.values(val).forEach((v) => {
          if (Array.isArray(v) || typeof v === 'string' || (typeof v === 'object' && v !== null)) {
            processSingle(v);
          }
        });
      }
    }
  };

  const processGroup = (group) => {
    if (!group || typeof group !== 'object') return;
    let name = group.label || group.name || group.category_name;
    if (!name || (typeof name === 'string' && name.match(/^[0-9a-fA-F-]{16,}$/))) {
      name = group.category_id;
    }
    const count = Number(group.count || group.qty || group.quantity || 1);
    if (name && typeof name === 'string' && !name.match(/^[0-9a-fA-F-]{16,}$/)) {
      const parsed = parseItem(name);
      if (parsed && parsed.name) {
        const currentQty = itemMap.get(parsed.name) || 0;
        itemMap.set(parsed.name, currentQty + (parsed.qty * count));
      }
    }
  };

  const sources = [
    item.thali_selections,
    item.selections,
    item.sub_items,
    item.subItems,
    item.addons,
    item.add_ons,
    item.addOns,
    item.included_items,
    item.includedItems,
    item.thali_extras,
    item.extras,
  ];

  for (const src of sources) {
    if (src) processSingle(src);
  }

  if (itemMap.size === 0 && Array.isArray(item.thali_groups) && item.thali_groups.length > 0) {
    item.thali_groups.forEach(processGroup);
  }

  if (itemMap.size === 0 && item.menu_item && typeof item.menu_item === 'object') {
    const fallbackSources = [
      item.menu_item.thali_extras,
      item.menu_item.thali_selections,
      item.menu_item.sub_items,
      item.menu_item.addons,
      item.menu_item.included_items,
    ];
    for (const src of fallbackSources) {
      if (src) processSingle(src);
    }
    if (itemMap.size === 0 && Array.isArray(item.menu_item.thali_groups)) {
      item.menu_item.thali_groups.forEach(processGroup);
    }
  }

  if (itemMap.size === 0 && Array.isArray(menuList) && menuList.length > 0) {
    const mId = item.menu_item_id || item.id;
    const foundMenu = menuList.find(m => m.id === mId || (m.name && m.name.toLowerCase() === (item.name || '').toLowerCase()));
    if (foundMenu) {
      const fallbackSources = [
        foundMenu.thali_extras,
        foundMenu.thali_selections,
        foundMenu.sub_items,
        foundMenu.addons,
        foundMenu.included_items,
      ];
      for (const src of fallbackSources) {
        if (src) processSingle(src);
      }
      if (itemMap.size === 0 && Array.isArray(foundMenu.thali_groups)) {
        foundMenu.thali_groups.forEach(processGroup);
      }
    }
  }

  if (item.extra_bread && Number(item.extra_bread) > 0) {
    const breadName = "Extra Roti";
    const breadQty = Number(item.extra_bread);
    const currentQty = itemMap.get(breadName) || 0;
    itemMap.set(breadName, currentQty + breadQty);
  }

  const result = [];
  for (const [name, qty] of itemMap.entries()) {
    const displayName = (t && typeof t === 'function') ? t(name) : name;
    result.push(`${displayName} (${qty})`);
  }
  return result;
}

function getGroupedThaliItems(selections, extras, t) {
  return getItemSubItems({ thali_selections: selections, thali_extras: extras }, t);
}

export default function ReceiptPreview({
  order: propOrder,
  settings,
  menu,
  editable = false,
  onInc = null,
  onDec = null,
  onRemove = null,
  cart,
  totals,
  customerName,
  tokenNo,
}) {
  const { t } = useLanguage();

  const order = useMemo(() => {
    if (propOrder) {
      if (propOrder.receipt_no === undefined && (propOrder.token_no === undefined || propOrder.token_no === null)) {
        return {
          ...propOrder,
          token_no: tokenNo !== undefined ? tokenNo : getCurrentToken(),
        };
      }
      return propOrder;
    }
    if (cart) {
      return {
        items: cart.map(item => ({
          ...item,
          qty: item.qty || item.quantity,
          menu_item_id: item.id
        })),
        subtotal: totals?.subtotal || 0,
        tax: totals?.tax || 0,
        total: totals?.total || 0,
        discount: totals?.discount || 0,
        customer_name: customerName,
        token_no: tokenNo !== undefined ? tokenNo : getCurrentToken(),
      };
    }
    return null;
  }, [propOrder, cart, totals, customerName, tokenNo]);

  const calculatedTotal = useMemo(() => {
    if (!order || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 0)), 0);
  }, [order]);

  if (!order) return null;

  const dt = new Date(order.paid_at || order.created_at || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;

  let hours = dt.getHours();
  const minutes = pad(dt.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${pad(hours)}:${minutes} ${ampm}`;

  // Read configurations
  const prefix = settings?.receipt_prefix || '';
  const paddingCount = Number(settings?.receipt_padding) || 6;

  // Format receipt number: if order is being billed (no receipt_no yet), show PENDING
  const receiptNoFormatted = order.receipt_no !== undefined
    ? `${prefix}${String(order.receipt_no).padStart(paddingCount, '0')}`
    : `${prefix}${"?".repeat(paddingCount)}`;

  const taxLabel = settings?.tax_label || 'GST';
  const gstRate = settings?.gst_rate ?? 5.0;

  const subtotalVal = calculatedTotal;
  const gstVal = subtotalVal * (gstRate / 100);
  const totalWithGst = subtotalVal + gstVal;

  // Render receipt header template
  const renderHeader = () => {
    if (settings?.header_template === "compact") {
      return (
        <div className="text-center">
          <div className="font-bold text-sm tracking-wide uppercase mb-0.5">{settings?.name || "ANNDEVTA THALI HOUSE"}</div>
          {settings?.phone && <div className="text-[11px] text-[#333]">PH: {settings.phone}</div>}
        </div>
      );
    }

    if (settings?.header_template === "modern") {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-1">
            <span className="border border-black px-1.5 py-0.5 font-bold tracking-wider text-[11px] bg-black text-[#fdfbf7] rounded-sm">ΨΦ</span>
          </div>
          <div className="font-bold text-sm tracking-wide uppercase mb-0.5">{settings?.name || "ANNDEVTA THALI HOUSE"}</div>
          {settings?.address && <div className="text-[11px] text-[#333] whitespace-pre-wrap">{settings.address}</div>}
        </div>
      );
    }

    // Classic Template (Default)
    return (
      <div className="text-center">
        <div className="font-bold text-sm tracking-wide uppercase mb-0.5">{settings?.name || "ANNDEVTA THALI HOUSE"}</div>
        {settings?.address && <div className="text-[11px] text-[#333] whitespace-pre-wrap mb-0.5">{settings.address}</div>}
        {settings?.phone && <div className="text-[11px] text-[#333] mb-0.5">PH: {settings.phone}</div>}
        {settings?.gstin && <div className="text-[11px] text-[#333]">GSTIN: {settings.gstin}</div>}
      </div>
    );
  };

  return (
    <>
      {/* First Token/Receipt Container - 300px symmetrical thermal layout */}
      <div className="w-[300px] mx-auto bg-[#fdfbf7] p-[10px] shadow-md border border-[#e6e4de] font-mono leading-normal text-[#000] text-[12px] box-border">
        {/* Header */}
        {renderHeader()}

        <div className="my-2 border-t border-black" />

        {/* Bill Info Metadata */}
        <div className="space-y-0.5 text-[11px]">
          {(order.token_no !== undefined && order.token_no !== null) && (
            <div className="flex justify-between items-center">
              <span>Token No:</span>
              <span className="font-bold">#{order.token_no}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span>{t("bill_no")}:</span>
            <span>{receiptNoFormatted}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>{t("date")}:</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>{t("time")}:</span>
            <span>{timeStr}</span>
          </div>
          {order.cashier_name && (
            <div className="flex justify-between items-center">
              <span>{t("cashier")}:</span>
              <span>
                {
                  order.cashier_name === "Owner" ? t("owner") :
                    order.cashier_name === "Cashier" ? t("cashier") : order.cashier_name
                }
              </span>
            </div>
          )}
          {order.customer_name && (
            <div className="flex justify-between items-center">
              <span>{t("customer")}:</span>
              <span>{order.customer_name}</span>
            </div>
          )}
          {order.customer_phone && (
            <div className="flex justify-between items-center">
              <span>{t("phone")}:</span>
              <span>{order.customer_phone}</span>
            </div>
          )}
        </div>

        {/* Items Title */}
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center font-bold tracking-wider text-[11px]">ITEMS</div>
        <div className="my-1.5 border-t border-dashed border-black" />

        {/* Items List */}
        <div className="space-y-1.5">
          {Array.isArray(order?.items) && order.items.map((line, idx) => {
            const key = line._key || `${line.menu_item_id}-${idx}`;
            const subItems = getItemSubItems(line, t, menu);
            return (
              <div key={key} className="group relative">
                <div className="flex justify-between font-bold">
                  <span>{t(line.name)}</span>
                  <span>Rs.{(line.price * line.qty).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#333]">
                  <span>{line.qty} x Rs.{Number(line.price).toFixed(2)}</span>
                </div>

                {/* Sub-items / Addons list */}
                {Array.isArray(subItems) && subItems.length > 0 && (
                  <div className="text-[10px] text-[#555] pl-2.5 mt-0.5 leading-tight" data-testid={`thali-selections-${key}`}>
                    {subItems.map((sel, sIdx) => (
                      <div key={sIdx}>• {sel}</div>
                    ))}
                  </div>
                )}

                {/* Editable Counter Controls */}
                {editable && (
                  <div className="mt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onDec && onDec(key)} data-testid={`dec-${key}`}
                      className="w-5 h-5 border border-border rounded flex items-center justify-center bg-white hover:bg-sand-subtle"><Minus className="w-3 h-3 text-neutral-600" /></button>
                    <span className="w-6 text-center text-xs font-mono font-bold">{line.qty}</span>
                    <button onClick={() => onInc && onInc(key)} data-testid={`inc-${key}`}
                      className="w-5 h-5 border border-border rounded flex items-center justify-center bg-white hover:bg-sand-subtle"><Plus className="w-3 h-3 text-neutral-600" /></button>
                    <button onClick={() => onRemove && onRemove(key)} data-testid={`rm-${key}`}
                      className="w-5 h-5 text-destructive hover:bg-destructive/10 rounded flex items-center justify-center ml-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            );
          })}
          {order.items.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-3">{t("no_items_in_cart")}</div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Pricing Summary */}
        <div className="space-y-1 text-[#000]">
          <div className="flex justify-between">
            <span>{t("subtotal")}</span>
            <span>Rs.{Number(order.subtotal || 0).toFixed(2)}</span>
          </div>
          {settings?.show_gst !== false && (
            <div className="flex justify-between">
              <span>{taxLabel} ({gstRate}%)</span>
              <span>Rs.{Number(order.tax || 0).toFixed(2)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between text-[#d32f2f]">
              <span>{t("discount")}</span>
              <span>-Rs.{Number(order.discount).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="flex justify-between font-extrabold text-sm py-0.5">
          <span>{t("total_uppercase")}</span>
          <span>Rs.{Number(order.total || 0).toFixed(2)}</span>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Payment details */}
        {settings?.show_payment !== false && order.payment_mode && (
          <div className="flex justify-between items-center font-bold text-[11px] uppercase mb-1">
            <span>{t("payment")}:</span>
            <span>
              {
                order.payment_mode === "cash" ? t("cash") :
                  order.payment_mode === "upi" ? t("upi") :
                    order.payment_mode === "card" ? t("card") : order.payment_mode
              }
            </span>
          </div>
        )}

        {/* Footer message */}
        <div className="text-center font-bold uppercase text-[11px] mt-2">
          {
            (!settings?.footer_msg ||
              settings.footer_msg === "Thank you! Please visit again." ||
              settings.footer_msg === "Thank you for dining with us!")
              ? `${t("thank_you")}! ${t("visit_again")}`
              : settings.footer_msg
          }
        </div>

        <div className="text-center text-[10px] text-[#444] mt-1">{dateStr} {timeStr}</div>

        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center text-[9px] text-[#666]">
          <div className="font-semibold">Powered by Career Craftly</div>
          <div className="text-[8.5px] mt-0.5">Crafting Digital Success, Intelligently</div>
        </div>
        <div className="mt-2 border-t border-black" />
      </div>

      {/* Vertical spacing for receipt preview gap */}
      <div className="h-6 select-none print:hidden" />

      {/* Second Token/Receipt Container - 300px symmetrical thermal layout */}
      <div id="second-token-print" className="w-[300px] mx-auto bg-[#fdfbf7] p-[10px] shadow-md border border-[#e6e4de] font-mono leading-normal text-[#000] text-[12px] box-border">
        {/* Header */}
        <div className="text-center">
          <div className="font-bold text-sm tracking-wide uppercase mb-0.5">{(settings?.name || "ANNDEVTA THALI HOUSE").toUpperCase()}</div>
          {settings?.address && <div className="text-[11px] text-[#333] whitespace-pre-wrap mb-0.5">{settings.address}</div>}
          {settings?.phone && <div className="text-[11px] text-[#333] mb-0.5">PH: {settings.phone}</div>}
          {settings?.gstin && <div className="text-[11px] text-[#333]">GSTIN: {settings.gstin}</div>}
        </div>

        <div className="my-2 border-t border-black" />

        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span>Token No:</span>
            <span className="font-bold">#{order.token_no}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Bill No:</span>
            <span>{receiptNoFormatted}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Date:</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Time:</span>
            <span>{timeStr}</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center font-bold tracking-wider text-[11px]">ITEMS</div>
        <div className="my-1.5 border-t border-dashed border-black" />

        {/* Items List */}
        <div className="space-y-1.5">
          {Array.isArray(order?.items) && order.items.map((line, idx) => {
            const key = line._key || `${line.menu_item_id}-${idx}`;
            const subItems = getItemSubItems(line, t, menu);
            return (
              <div key={key}>
                <div className="flex justify-between font-bold">
                  <span>{t(line.name)}</span>
                  <span>Rs.{(line.price * line.qty).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#333]">
                  <span>{line.qty} x Rs.{Number(line.price).toFixed(2)}</span>
                </div>
                {Array.isArray(subItems) && subItems.length > 0 && (
                  <div className="text-[10px] text-[#555] pl-2.5 mt-0.5 leading-tight">
                    {subItems.map((sel, sIdx) => (
                      <div key={sIdx}>• {sel}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-1 text-[#000]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rs.{subtotalVal.toFixed(2)}</span>
          </div>
          {settings?.show_gst !== false && (
            <div className="flex justify-between">
              <span>GST ({gstRate}%)</span>
              <span>Rs.{gstVal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="flex justify-between font-extrabold text-sm py-0.5">
          <span>TOTAL</span>
          <span>Rs.{totalWithGst.toFixed(2)}</span>
        </div>

        <div className="my-2 border-t border-dashed border-black" />
      </div>
    </>
  );
}
