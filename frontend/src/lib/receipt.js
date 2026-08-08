// Customer receipt printer (80mm / 300px thermal POS compatible)
import en from "../translations/en.json";
import gu from "../translations/gu.json";
import bilingual from "../translations/bilingual.json";

const translations = { en, gu, bilingual };

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

function buildReceiptBlock({ order, settings, t, tokenNo, receiptNoFormatted, dateStr, timeStr, safe, menu }) {
  const gstRate = settings?.gst_rate ?? 5.0;
  const taxLabel = settings?.tax_label || 'GST';

  // Center aligned header
  let headerHTML = '';
  if (settings?.header_template === 'compact') {
    headerHTML = `
      <div style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 2px;">${safe(settings?.name || 'ANNDEVTA THALI HOUSE')}</div>
      ${settings?.phone ? `<div style="font-size: 11px; margin: 1px 0;">PH: ${safe(settings.phone)}</div>` : ''}
    `;
  } else if (settings?.header_template === 'modern') {
    headerHTML = `
      <div style="margin-bottom: 4px;">
        <span style="border: 1px solid #000; padding: 1px 5px; font-weight: bold; font-size: 11px; background-color: #000; color: #fff; border-radius: 2px;">ΨΦ</span>
      </div>
      <div style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 2px;">${safe(settings?.name || 'ANNDEVTA THALI HOUSE')}</div>
      ${settings?.address ? `<div style="font-size: 11px; margin: 1px 0;">${safe(settings.address)}</div>` : ''}
    `;
  } else { // classic (default)
    headerHTML = `
      <div style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 2px;">${safe(settings?.name || 'ANNDEVTA THALI HOUSE')}</div>
      ${settings?.address ? `<div style="font-size: 11px; margin: 1px 0;">${safe(settings.address)}</div>` : ''}
      ${settings?.phone ? `<div style="font-size: 11px; margin: 1px 0;">PH: ${safe(settings.phone)}</div>` : ''}
      ${settings?.gstin ? `<div style="font-size: 11px; margin: 1px 0;">GSTIN: ${safe(settings.gstin)}</div>` : ''}
    `;
  }

  const itemsHTML = (order.items || []).map((i) => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    const subItems = getItemSubItems(i, t, menu);
    const subline = subItems.map((sel) => `• ${safe(sel)}`);

    return `
      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>${safe(t(i.name))}</span>
          <span>Rs.${lineTotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333;">
          <span>${i.qty} x Rs.${Number(i.price).toFixed(2)}</span>
        </div>
        ${subline.length > 0 ? `
        <div style="font-size: 10px; color: #555; padding-left: 10px; margin-top: 2px; line-height: 1.3;">
          ${subline.join('<br/>')}
        </div>` : ''}
      </div>
    `;
  }).join('');

  const pm = order.payment_mode || 'cash';
  const pmTranslated = pm === 'cash' ? t('cash') : pm === 'upi' ? t('upi') : pm === 'card' ? t('card') : pm;

  const cashierName = order.cashier_name;
  const cashierTranslated = cashierName === 'Owner' ? t('owner') : cashierName === 'Cashier' ? t('cashier') : cashierName;

  let footerMessage = settings?.footer_msg;
  if (!footerMessage || footerMessage === "Thank you! Please visit again." || footerMessage === "Thank you for dining with us!") {
    footerMessage = `${t("thank_you")}! ${t("visit_again")}`;
  }

  return `
  <div class="receipt-container">
    <!-- Header Section -->
    <div style="text-align: center;">
      ${headerHTML}
    </div>
    
    <!-- Thin Divider -->
    <div class="separator-solid"></div>
    
    <!-- Bill Info Section -->
    <div class="bill-info">
      ${tokenNo !== undefined && tokenNo !== null ? `
      <div class="info-row">
        <span>Token No:</span>
        <span style="font-weight: bold;">#${tokenNo}</span>
      </div>` : ''}
      <div class="info-row">
        <span>${t("bill_no")}:</span>
        <span>${receiptNoFormatted}</span>
      </div>
      <div class="info-row">
        <span>${t("date")}:</span>
        <span>${dateStr}</span>
      </div>
      <div class="info-row">
        <span>${t("time")}:</span>
        <span>${timeStr}</span>
      </div>
      ${order.cashier_name ? `
      <div class="info-row">
        <span>${t("cashier")}:</span>
        <span>${safe(cashierTranslated)}</span>
      </div>` : ''}
      ${order.customer_name ? `
      <div class="info-row">
        <span>${t("customer")}:</span>
        <span>${safe(order.customer_name)}</span>
      </div>` : ''}
    </div>
    
    <!-- Items Title Header -->
    <div class="separator-dashed"></div>
    <div style="text-align: center; font-weight: bold; letter-spacing: 1px; font-size: 11px;">ITEMS</div>
    <div class="separator-dashed"></div>
    
    <!-- Items Section -->
    <div>
      ${itemsHTML}
    </div>
    
    <!-- Pricing Section -->
    <div class="separator-dashed"></div>
    
    <div class="summary-row">
      <span>${t("subtotal")}</span>
      <span>Rs.${Number(order.subtotal || 0).toFixed(2)}</span>
    </div>
    
    ${settings?.show_gst !== false ? `
    <div class="summary-row">
      <span>${safe(taxLabel)} (${gstRate}%)</span>
      <span>Rs.${Number(order.tax || 0).toFixed(2)}</span>
    </div>` : ''}
    
    ${order.discount > 0 ? `
    <div class="summary-row" style="color: #d32f2f;">
      <span>${t("discount")}</span>
      <span>-Rs.${Number(order.discount).toFixed(2)}</span>
    </div>` : ''}
    
    <div class="separator-dashed"></div>
    <div class="summary-row total-row">
      <span>${t("total_uppercase")}</span>
      <span>Rs.${Number(order.total || 0).toFixed(2)}</span>
    </div>
    <div class="separator-dashed"></div>
    
    <!-- Payment Info -->
    ${settings?.show_payment !== false ? `
    <div class="info-row" style="font-weight: bold;">
      <span>${t("payment")}:</span>
      <span>${safe(pmTranslated.toUpperCase())}</span>
    </div>
    <div class="separator-dashed"></div>
    ` : ''}
    
    <!-- Footer Section -->
    <div style="text-align: center; font-weight: bold; text-transform: uppercase; margin-top: 6px; font-size: 11px;">
      ${safe(footerMessage.toUpperCase())}
    </div>
    
    <div style="text-align: center; font-size: 10px; color: #444; margin-top: 4px;">
      ${dateStr} ${timeStr}
    </div>
    
    <div class="separator-dashed" style="margin-top: 8px;"></div>
    
    <div style="text-align: center; font-size: 9px; color: #666; margin-top: 6px;">
      <div style="font-weight: 600;">Powered by Career Craftly</div>
      <div style="margin-top: 1px; font-size: 9px;">Crafting Digital Success, Intelligently</div>
    </div>
    <div class="separator-solid" style="margin-top: 8px;"></div>
  </div>
  `;
}

function buildSecondReceiptBlock({ order, settings, t, tokenNo, receiptNoFormatted, dateStr, timeStr, safe, menu }) {
  const gstRate = settings?.gst_rate ?? 5.0;
  const taxLabel = settings?.tax_label || 'GST';
  const nameUpper = safe((settings?.name || 'ANNDEVTA THALI HOUSE').toUpperCase());

  const itemsHTML = (order.items || []).map((i) => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    const subItems = getItemSubItems(i, t, menu);
    const subline = subItems.map((sel) => `• ${safe(sel)}`);

    return `
      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>${safe(t(i.name))}</span>
          <span>Rs.${lineTotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333;">
          <span>${i.qty} x Rs.${Number(i.price).toFixed(2)}</span>
        </div>
        ${subline.length > 0 ? `
        <div style="font-size: 10px; color: #555; padding-left: 10px; margin-top: 2px; line-height: 1.3;">
          ${subline.join('<br/>')}
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `
  <div class="second-token-container">
    <div style="text-align: center;">
      <div style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 2px;">${nameUpper}</div>
      ${settings?.address ? `<div style="font-size: 11px; margin: 1px 0;">${safe(settings.address)}</div>` : ''}
      ${settings?.phone ? `<div style="font-size: 11px; margin: 1px 0;">PH: ${safe(settings.phone)}</div>` : ''}
      ${settings?.gstin ? `<div style="font-size: 11px; margin: 1px 0;">GSTIN: ${safe(settings.gstin)}</div>` : ''}
    </div>
    
    <div class="separator-solid"></div>
    
    <div class="bill-info">
      ${tokenNo !== undefined && tokenNo !== null ? `
      <div class="info-row">
        <span>Token No:</span>
        <span style="font-weight: bold;">#${tokenNo}</span>
      </div>` : ''}
      <div class="info-row">
        <span>${t("bill_no")}:</span>
        <span>${receiptNoFormatted}</span>
      </div>
      <div class="info-row">
        <span>${t("date")}:</span>
        <span>${dateStr}</span>
      </div>
      <div class="info-row">
        <span>${t("time")}:</span>
        <span>${timeStr}</span>
      </div>
    </div>
    
    <div class="separator-dashed"></div>
    <div style="text-align: center; font-weight: bold; letter-spacing: 1px; font-size: 11px;">ITEMS</div>
    <div class="separator-dashed"></div>
    
    <div>
      ${itemsHTML}
    </div>
    
    <div class="separator-dashed"></div>
    
    <div class="summary-row">
      <span>Subtotal</span>
      <span>Rs.${Number(order.subtotal || 0).toFixed(2)}</span>
    </div>
    
    ${settings?.show_gst !== false ? `
    <div class="summary-row">
      <span>GST (${gstRate}%)</span>
      <span>Rs.${Number(order.tax || 0).toFixed(2)}</span>
    </div>` : ''}
    
    ${order.discount > 0 ? `
    <div class="summary-row" style="color: #d32f2f;">
      <span>Discount</span>
      <span>-Rs.${Number(order.discount).toFixed(2)}</span>
    </div>` : ''}
    
    <div class="separator-dashed"></div>
    
    <div class="summary-row total-row">
      <span>TOTAL</span>
      <span>Rs.${Number(order.total || 0).toFixed(2)}</span>
    </div>
    
    <div class="separator-dashed"></div>
  </div>
  `;
}

export function printReceipt({ order, settings, menu }) {
  if (!order) return;
  const lang = localStorage.getItem("pos_language") || settings?.language || "en";
  const t = (key) => {
    const dict = translations[lang] || translations["en"];
    return dict[key] || translations["en"][key] || key;
  };
  const dt = new Date(order.paid_at || order.created_at || Date.now());
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;

  let hours = dt.getHours();
  const minutes = pad(dt.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${pad(hours)}:${minutes} ${ampm}`;

  // Formatted receipt number based on prefix and padding settings
  const prefix = settings?.receipt_prefix || '';
  const paddingCount = Number(settings?.receipt_padding) || 6;
  const receiptNoFormatted = `${prefix}${String(order.receipt_no ?? '').padStart(paddingCount, '0')}`;

  const is58 = Number(settings?.paper_width) === 58;
  const paperWidth = is58 ? "58mm" : "80mm";
  const receiptWidth = "300px";

  const firstReceiptHTML = buildReceiptBlock({
    order,
    settings,
    t,
    tokenNo: order.token_no,
    receiptNoFormatted,
    dateStr,
    timeStr,
    safe,
    menu
  });

  const secondReceiptHTML = buildSecondReceiptBlock({
    order,
    settings,
    t,
    tokenNo: order.token_no,
    receiptNoFormatted,
    dateStr,
    timeStr,
    safe,
    menu
  });

  const html = `<!doctype html>
<html><head><title>Receipt #${receiptNoFormatted}</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #000;
    background-color: #fff;
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-print-color-adjust: exact;
    page-break-inside: avoid;
  }
  .receipt-container, .second-token-container {
    width: ${receiptWidth};
    max-width: 100%;
    margin: 0 auto;
    padding: 10px;
    box-sizing: border-box;
    page-break-inside: avoid;
    background: #fff;
  }
  @media print {
    body {
      width: 100%;
    }
    .receipt-container, .second-token-container {
      width: 100%;
      max-width: 100%;
      padding: 10px;
    }
  }
  .separator-solid {
    border-top: 1px solid #000;
    margin: 8px 0;
  }
  .separator-dashed {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
  .bill-info {
    margin: 4px 0;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 2px 0;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 3px 0;
  }
  .total-row {
    font-size: 14px;
    font-weight: bold;
    padding: 2px 0;
  }
</style></head>
<body>
  ${firstReceiptHTML}
  <div style="margin-top: 2em; margin-bottom: 2em; border-top: 1px dashed #666; width: 100%;"></div>
  ${secondReceiptHTML}
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    };
  </script>
</body></html>`;

  const isElectron = window.electronAPI && window.electronAPI.printer;

  if (isElectron) {
    const printerName = settings?.default_printer || null;
    const paperWidth = Number(settings?.paper_width) || 80;

    window.electronAPI.printer.print(html, printerName, paperWidth)
      .then(success => {
        if (!success) {
          console.error('Direct print failed');
          fallbackBrowserPrint(html);
        }
      })
      .catch(error => {
        console.error('Print error:', error);
        fallbackBrowserPrint(html);
      });

    return true;
  } else {
    return fallbackBrowserPrint(html);
  }
}

function fallbackBrowserPrint(html) {
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';

  document.body.appendChild(printFrame);

  try {
    const frameDoc = printFrame.contentWindow ? printFrame.contentWindow.document : printFrame.contentDocument;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
  } catch (e) {
    console.error('Iframe print error', e);
  }

  setTimeout(() => {
    if (document.body.contains(printFrame)) {
      document.body.removeChild(printFrame);
    }
  }, 60000);

  return true;
}
