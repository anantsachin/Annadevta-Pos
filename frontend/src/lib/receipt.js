// Customer receipt printer (80mm / 300px thermal POS compatible)
import en from "../translations/en.json";
import gu from "../translations/gu.json";
import bilingual from "../translations/bilingual.json";

const translations = { en, gu, bilingual };

function getItemSubItems(item, t, menuList = []) {
  if (!item) return [];

  const tr = (key) => (t && typeof t === 'function' ? t(key) : key);
  const result = [];

  const parseItemStr = (str) => {
    if (!str) return null;
    const trimmed = String(str).trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(.+?)\s*(?:\((\d+)\))?$/);
    if (!match) return null;
    const name = match[1].trim();
    const qty = match[2] ? parseInt(match[2], 10) : 1;
    return { name, qty };
  };

  // 1. Check explicit item.rules array:
  const rules = item.rules || (typeof item.rules === 'string' ? (() => { try { return JSON.parse(item.rules); } catch (e) { return null; } })() : null);
  if (Array.isArray(rules) && rules.length > 0) {
    rules.forEach((r) => {
      if (!r || typeof r !== 'object') return;
      const name = r.name || r.item_name || r.title || r.label || "";
      const qty = Number(r.qty || r.quantity || r.count || 1);
      if (name) {
        result.push(`${tr(name)} (${qty})`);
      }
    });
  }

  // 2. Process thali_selections / selections if rules array was not present or empty
  if (result.length === 0) {
    const selObj = item.thali_selections || item.selections;
    if (selObj) {
      let parsedObj = selObj;
      if (typeof selObj === 'string') {
        try {
          if (selObj.startsWith('{') || selObj.startsWith('[')) {
            parsedObj = JSON.parse(selObj);
          }
        } catch (e) { }
      }

      if (typeof parsedObj === 'object' && parsedObj !== null && !Array.isArray(parsedObj)) {
        Object.entries(parsedObj).forEach(([ruleLabel, items]) => {
          if (!items) return;
          const itemArr = Array.isArray(items) ? items : [items];
          const counts = new Map();
          itemArr.forEach((it) => {
            if (!it) return;
            if (typeof it === 'string') {
              const p = parseItemStr(it);
              if (p && p.name) counts.set(p.name, (counts.get(p.name) || 0) + p.qty);
            } else if (typeof it === 'object' && (it.name || it.label)) {
              const n = it.name || it.label;
              const q = Number(it.qty || it.count || 1);
              counts.set(n, (counts.get(n) || 0) + q);
            }
          });
          for (const [itemName, q] of counts.entries()) {
            result.push(`${tr(itemName)} (${q})`);
          }
        });
      } else if (Array.isArray(parsedObj)) {
        parsedObj.forEach((it) => {
          if (typeof it === 'string') {
            const p = parseItemStr(it);
            if (p) result.push(`${tr(p.name)} (${p.qty})`);
          }
        });
      }
    }
  }

  // 3. Process thali_groups fallback if still empty
  if (result.length === 0) {
    const groups = item.thali_groups || item.thali_rules || (item.menu_item && item.menu_item.thali_groups);
    if (Array.isArray(groups) && groups.length > 0) {
      groups.forEach((g) => {
        if (!g) return;
        const name = g.name || g.label || g.category_name;
        const count = Number(g.count || g.qty || 1);
        if (name && typeof name === 'string' && !name.match(/^[0-9a-fA-F-]{16,}$/)) {
          result.push(`${tr(name)} (${count})`);
        }
      });
    }
  }

  // 4. Menu list fallback if still empty
  if (result.length === 0 && Array.isArray(menuList) && menuList.length > 0) {
    const mId = item.menu_item_id || item.id;
    const foundMenu = menuList.find(m => m.id === mId || (m.name && m.name.toLowerCase() === (item.name || '').toLowerCase()));
    if (foundMenu && Array.isArray(foundMenu.thali_groups)) {
      foundMenu.thali_groups.forEach((g) => {
        if (!g) return;
        const name = g.name || g.label || g.category_name;
        const count = Number(g.count || g.qty || 1);
        if (name && typeof name === 'string' && !name.match(/^[0-9a-fA-F-]{16,}$/)) {
          result.push(`${tr(name)} (${count})`);
        }
      });
    }
  }

  // 5. Process fixedInclusions / thali_extras (e.g. "salad" or "Roti (4), Rice, Salad")
  const fixedInclusions = item.fixedInclusions || item.thali_extras || item.extras || (item.menu_item && item.menu_item.thali_extras);
  if (fixedInclusions && typeof fixedInclusions === 'string' && fixedInclusions.trim()) {
    const trimmed = fixedInclusions.trim();
    const formattedStr = trimmed.split(',').map(s => {
      const p = parseItemStr(s);
      if (!p) return tr(s.trim());
      return p.qty > 1 ? `${tr(p.name)} (${p.qty})` : tr(p.name);
    }).join(', ');
    if (formattedStr && !result.includes(formattedStr)) {
      result.push(formattedStr);
    }
  }

  // 6. Extra bread
  if (item.extra_bread && Number(item.extra_bread) > 0) {
    const breadName = tr("Extra Roti");
    const breadQty = Number(item.extra_bread);
    result.push(`${breadName} (${breadQty})`);
  }

  return result;
}

function getGroupedThaliItems(selections, extras, t) {
  return getItemSubItems({ thali_selections: selections, thali_extras: extras }, t);
}

function buildReceiptBlock({ order, settings, t, tokenNo, receiptNoFormatted, dateStr, timeStr, safe, menu }) {
  const cgstRate = order.cgst_rate ?? settings?.cgst_rate ?? ((settings?.gst_rate ?? 5.0) / 2);
  const sgstRate = order.sgst_rate ?? settings?.sgst_rate ?? ((settings?.gst_rate ?? 5.0) / 2);
  const cgstVal = order.cgst ?? (Number(order.subtotal || 0) * (cgstRate / 100));
  const sgstVal = order.sgst ?? (Number(order.subtotal || 0) * (sgstRate / 100));
  const taxLabel = settings?.tax_label || 'CGST & SGST';

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
      <span>CGST (${cgstRate}%)</span>
      <span>Rs.${Number(cgstVal).toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>SGST (${sgstRate}%)</span>
      <span>Rs.${Number(sgstVal).toFixed(2)}</span>
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

function buildKitchenReceiptBlock({ order, settings, t, tokenNo, receiptNoFormatted, dateStr, timeStr, safe, menu }) {
  const nameUpper = safe((settings?.name || 'ANNDEVTA THALI HOUSE').toUpperCase());

  const itemsHTML = (order.items || []).map((i) => {
    const subItems = getItemSubItems(i, t, menu);
    const subline = subItems.map((sel) => `• ${safe(sel)}`);

    return `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px;">
          ${safe(t(i.name))}
        </div>
        <div style="font-weight: bold; font-size: 11px; color: #111;">
          Qty: ${i.qty}
        </div>
        ${subline.length > 0 ? `
        <div style="font-size: 11px; color: #333; padding-left: 8px; margin-top: 3px; line-height: 1.4;">
          ${subline.join('<br/>')}
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `
  <div class="kitchen-receipt-container">
    <div style="text-align: center;">
      <div style="font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 2px;">${nameUpper}</div>
    </div>

    <div class="separator-solid" style="border-top: 1px solid #000; margin: 6px 0;"></div>

    <div class="bill-info" style="font-size: 11px;">
      ${tokenNo !== undefined && tokenNo !== null ? `
      <div class="info-row">
        <span>TOKEN NO:</span>
        <span style="font-weight: bold; font-size: 13px;">#${tokenNo}</span>
      </div>` : ''}
      <div class="info-row">
        <span>BILL NO:</span>
        <span style="font-weight: bold;">${receiptNoFormatted}</span>
      </div>
      <div class="info-row">
        <span>DATE:</span>
        <span>${dateStr}</span>
      </div>
      <div class="info-row">
        <span>TIME:</span>
        <span>${timeStr}</span>
      </div>
      ${order.notes ? `
      <div class="info-row" style="margin-top: 3px; font-weight: bold; color: #d32f2f;">
        <span>NOTES:</span>
        <span>${safe(order.notes)}</span>
      </div>` : ''}
    </div>

    <div class="separator-dashed" style="margin: 6px 0;"></div>
    <div style="text-align: center; font-weight: bold; letter-spacing: 1.5px; font-size: 12px;">KITCHEN ORDER</div>
    <div class="separator-dashed" style="margin: 6px 0;"></div>

    <div style="margin: 8px 0;">
      ${itemsHTML}
    </div>

    <div class="separator-solid" style="border-top: 1px solid #000; margin-top: 10px; margin-bottom: 4px;"></div>
    <div style="text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">
      KITCHEN COPY
    </div>
    <div class="separator-solid" style="border-top: 1px solid #000; margin-top: 4px; margin-bottom: 6px;"></div>
  </div>
  `;
}

export function printReceipt({ order, settings, menu, menuMode }) {
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

  const customerReceiptHTML = buildReceiptBlock({
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

  const kitchenReceiptHTML = buildKitchenReceiptBlock({
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

  const isParcel = menuMode === "parcel";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/><title>Receipt #${receiptNoFormatted}</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: 'JetBrains Mono', 'Courier New', Courier, monospace, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background-color: #fff;
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-print-color-adjust: exact;
    page-break-inside: avoid;
  }
  .receipt-container, .kitchen-receipt-container {
    width: ${receiptWidth};
    max-width: 100%;
    margin: 0 auto;
    padding: 8px 10px;
    box-sizing: border-box;
    page-break-inside: avoid;
    background: #fff;
  }
  @media print {
    body {
      width: 100%;
    }
    .receipt-container, .kitchen-receipt-container {
      width: 100%;
      max-width: 100%;
      padding: 5px 10px;
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
  .receipt-cut-separator {
  width: 100%;
  margin: 14px 0;
  padding: 8px 0;
  border-top: 2px dashed #000;
  border-bottom: 2px dashed #000;
  text-align: center;
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 1px;
}

.paper-feed-end {
  height: 35px;
}
  }
  
</style>
</head>
<body>
${
  isParcel
    ? `
      <!-- PARCEL: KITCHEN COPY -->
      ${kitchenReceiptHTML}

      <!-- CUT / TEAR SEPARATOR -->
      <div class="receipt-cut-separator">
        <span>✂ CUT HERE</span>
      </div>

      <!-- PARCEL: CUSTOMER COPY -->
      ${customerReceiptHTML}

      <!-- Final paper feed -->
      <div class="paper-feed-end"></div>
    `
    : `
      <!-- DINING: CUSTOMER COPY ONLY -->
      ${customerReceiptHTML}

      <!-- Final paper feed -->
      <div class="paper-feed-end"></div>
    `
}

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
