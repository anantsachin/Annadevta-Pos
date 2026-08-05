import React, { useMemo } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { getCurrentToken } from "../lib/tokenManager";

function getGroupedThaliItems(selections, extras, t) {
  const itemMap = new Map();

  const parseItem = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    const match = trimmed.match(/^(.+?)\s*(?:\((\d+)\))?$/);
    if (!match) return null;
    const name = match[1].trim();
    const qty = match[2] ? parseInt(match[2], 10) : 1;
    return { name, qty };
  };

  // 1. Process selections
  if (selections) {
    let selectionsArray = [];
    if (Array.isArray(selections)) {
      selectionsArray = selections;
    } else if (typeof selections === 'object') {
      selectionsArray = Object.entries(selections)
        .map(([k, v]) => (v && v.length ? v : null))
        .filter(Boolean)
        .flat();
    }

    for (const itemStr of selectionsArray) {
      const parsed = parseItem(itemStr);
      if (parsed && parsed.name) {
        const currentQty = itemMap.get(parsed.name) || 0;
        itemMap.set(parsed.name, currentQty + parsed.qty);
      }
    }
  }

  // 2. Process extras
  if (extras && typeof extras === 'string') {
    const parts = extras.split(',');
    for (const part of parts) {
      const parsed = parseItem(part);
      if (parsed && parsed.name) {
        const currentQty = itemMap.get(parsed.name) || 0;
        itemMap.set(parsed.name, currentQty + parsed.qty);
      }
    }
  }

  // 3. Format into list: "Name (Qty)"
  const result = [];
  for (const [name, qty] of itemMap.entries()) {
    const displayName = t ? t(name) : name;
    result.push(`${displayName} (${qty})`);
  }
  return result;
}

export default function ReceiptPreview({
  order: propOrder,
  settings,
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

  // Formatting styles matching settings
  const previewFontClass =
    settings?.font_size === "small" ? "text-[10px]" :
      settings?.font_size === "large" ? "text-sm" : "text-xs";

  const previewWidthClass =
    Number(settings?.paper_width) === 58 ? "w-[220px]" : "w-[290px]";

  const headerAlignClass = settings?.header_alignment === "left" ? "text-left" : "text-center";

  // Render receipt header template
  const renderHeader = () => {
    if (settings?.header_template === "compact") {
      return (
        <div className={headerAlignClass}>
          <div className="font-bold text-sm tracking-wide mb-1 uppercase">{settings?.name || "Anndevta Thali House"}</div>
          {settings?.phone && <div className="text-[10px] text-[#444] mb-0.5">PH: {settings.phone}</div>}
        </div>
      );
    }

    if (settings?.header_template === "modern") {
      return (
        <div className={headerAlignClass}>
          <div className="flex justify-center mb-1">
            <span className="border border-black px-2 py-0.5 font-bold tracking-wider text-xs bg-black text-[#fdfbf7] rounded-sm">ΨΦ</span>
          </div>
          <div className="font-bold text-sm tracking-wide mb-1 uppercase">{settings?.name || "Anndevta Thali House"}</div>
          {settings?.address && <div className="text-[10px] text-[#444] whitespace-pre-wrap">{settings.address}</div>}
        </div>
      );
    }

    // Classic Template (Default)
    return (
      <div className={headerAlignClass}>
        <div className="font-bold text-sm tracking-wide mb-1 uppercase">{settings?.name || "Anndevta Thali House"}</div>
        {settings?.address && <div className="text-[10px] text-[#444] whitespace-pre-wrap mb-0.5">{settings.address}</div>}
        {settings?.phone && <div className="text-[10px] text-[#444] mb-0.5">PH: {settings.phone}</div>}
        {settings?.gstin && <div className="text-[10px] text-[#444]">GSTIN: {settings.gstin}</div>}
      </div>
    );
  };

  const printSecondToken = (e) => {
    if (e) e.preventDefault();
    const tokenEl = document.getElementById("second-token-print");
    if (!tokenEl) return;

    const clone = tokenEl.cloneNode(true);
    const btn = clone.querySelector(".print-btn");
    if (btn) btn.remove();

    const content = clone.innerHTML;
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Token</title>
          <style>
            body {
              margin: 0;
              padding: 10px;
              font-family: monospace;
              font-size: 12px;
              color: #1a1a1a;
              background: #fff;
            }
            .flex { display: flex; justify-content: space-between; }
            .justify-between { justify-content: space-between; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .font-extrabold { font-weight: 800; }
            .uppercase { text-transform: uppercase; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .border-t { border-top-width: 1px; }
            .border-dashed { border-style: dashed; }
            .border-double { border-style: double; }
            .border-black { border-color: #000; }
            .print-btn { display: none !important; }
            @page { margin: 0; size: auto; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <>
      {/* First Token/Receipt Container */}
      <div className={`bg-[#fdfbf7] p-5 shadow-[0px_4px_10px_rgba(0,0,0,0.15)] border-y border-dashed border-[#e6e4de] font-mono leading-relaxed text-[#1a1a1a] transition-all duration-300 ${previewFontClass} ${previewWidthClass}`}>
        {/* Header */}
        {renderHeader()}

        <div className="my-2 border-t border-double border-black" />

        {/* Metadata */}
        <div className="space-y-0.5 text-[10px] text-[#333]">
          {(order.token_no !== undefined && order.token_no !== null) && (
            <div>Token No: #{order.token_no}</div>
          )}
          <div>{t("bill_no")}: {receiptNoFormatted}</div>
          <div>{t("date")}: {dateStr}</div>
          <div>{t("time")}: {timeStr}</div>
          {order.cashier_name && (
            <div>
              {t("cashier")}: {
                order.cashier_name === "Owner" ? t("owner") :
                  order.cashier_name === "Cashier" ? t("cashier") : order.cashier_name
              }
            </div>
          )}
          {order.customer_name && (
            <div>{t("customer")}: {order.customer_name}</div>
          )}
          {order.customer_phone && (
            <div>{t("phone")}: {order.customer_phone}</div>
          )}
        </div>

        <div className="my-2 border-t border-double border-black" />
        <div className="text-center font-bold tracking-widest text-[10px] mb-1">{t("items_header")}</div>
        <div className="my-1 border-t border-dashed border-black" />

        {/* Items List */}
        <div className="space-y-2">
          {Array.isArray(order?.items) && order.items.map((line, idx) => {
            const key = line._key || `${line.menu_item_id}-${idx}`;
            const selectionsList = getGroupedThaliItems(line.thali_selections, line.thali_extras, t);
            return (
              <div key={key} className="group relative">
                <div className="font-bold text-left">{t(line.name)}</div>
                <div className="flex justify-between text-[11px] text-[#222]">
                  <span>{line.qty} x Rs.{Number(line.price).toFixed(2)}</span>
                  <span className="font-bold">Rs.{(line.price * line.qty).toFixed(2)}</span>
                </div>

                {/* Thali Custom Customizations list */}
                {line.is_thali && Array.isArray(selectionsList) && selectionsList.length > 0 && (
                  <div className="text-[10px] text-[#555] pl-3 mt-0.5 leading-tight" data-testid={`thali-selections-${key}`}>
                    {selectionsList.map((sel, sIdx) => (
                      <div key={sIdx}>• {sel}</div>
                    ))}
                  </div>
                )}

                {/* Editable Counter Controls */}
                {editable && (
                  <div className="mt-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="text-center text-xs text-muted-foreground py-4">{t("no_items_in_cart")}</div>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Summary */}
        <div className="space-y-0.5 text-[#333]">
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
          <div className="font-bold text-[10px] uppercase">
            {t("payment")} : {
              order.payment_mode === "cash" ? t("cash") :
                order.payment_mode === "upi" ? t("upi") :
                  order.payment_mode === "card" ? t("card") : order.payment_mode
            }
          </div>
        )}

        <div className="my-2 border-t border-double border-black" />

        {/* Footer message */}
        <div className="text-center font-bold uppercase text-[10px] space-y-0.5">
          <div>
            {
              (!settings?.footer_msg ||
                settings.footer_msg === "Thank you! Please visit again." ||
                settings.footer_msg === "Thank you for dining with us!")
                ? `${t("thank_you")}! ${t("visit_again")}`
                : settings.footer_msg
            }
          </div>
        </div>

        <div className="my-2 border-t border-double border-black" />
        <div className="text-center text-[9px] text-[#555]">{dateStr} {timeStr}</div>
      </div>

      {/* Spacing element representing a two line gap */}
      <div className="h-8 select-none print:hidden" />

      {/* Second Token/Receipt Container */}
      <div id="second-token-print" className={`bg-[#fdfbf7] p-5 shadow-[0px_4px_10px_rgba(0,0,0,0.15)] border-y border-dashed border-[#e6e4de] font-mono leading-relaxed text-[#1a1a1a] transition-all duration-300 ${previewFontClass} ${previewWidthClass}`}>
        {/* Duplicate receipt block */}
        <div className={headerAlignClass}>
          <div className="font-bold text-sm tracking-wide mb-1 uppercase">Anndevta Thali House</div>
          <div className="text-[10px] text-[#444] whitespace-pre-wrap mb-0.5">12, MG Road, Bengaluru 560001</div>
          <div className="text-[10px] text-[#444] mb-0.5">PH: +91 98765 43210</div>
          <div className="text-[10px] text-[#444]">GSTIN: 29ABCDE1234F1Z5</div>
        </div>

        <div className="my-2 border-t border-double border-black" />

        <div className="space-y-0.5 text-[10px] text-[#333]">
          <div>Token No: #{order.token_no}</div>
          <div>Bill No: ??????</div>
          <div>Date: 03/08/2026</div>
          <div>Time: 06:55 PM</div>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5 text-[10px] text-[#333]">
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

        {/* Print Button */}
        <button
          onClick={printSecondToken}
          className="mt-4 w-full border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold py-1.5 rounded-lg text-xs transition-colors print-btn cursor-pointer select-none"
        >
          Print
        </button>
      </div>
    </>
  );
}
