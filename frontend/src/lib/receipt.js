// Customer receipt printer (80mm / 58mm thermal compatible)
export function printReceipt({ order, settings }) {
  if (!order) return;
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

  const gstRate = settings?.gst_rate ?? 5.0;
  const taxLabel = settings?.tax_label || 'GST';

  // Format properties dynamically based on receipt settings
  const is58 = Number(settings?.paper_width) === 58;
  const paperWidth = is58 ? "58mm" : "80mm";
  const containerWidth = is58 ? "48mm" : "72mm";
  const containerPadding = is58 ? "2mm" : "4mm";

  const fontSize = 
    settings?.font_size === "small" ? "10px" :
    settings?.font_size === "large" ? "14px" : "12px";

  const headerAlign = settings?.header_alignment === "left" ? "left" : "center";

  // Build header HTML dynamically based on template selection
  let headerHTML = '';
  if (settings?.header_template === 'compact') {
    headerHTML = `
      <div class="header-title">${safe(settings?.name || 'Annapurna Thali House')}</div>
      ${settings?.phone ? `<div class="header-detail">PH: ${safe(settings.phone)}</div>` : ''}
    `;
  } else if (settings?.header_template === 'modern') {
    headerHTML = `
      <div class="center" style="margin-bottom: 6px;">
        <span style="border: 1px solid #000; padding: 2px 6px; font-weight: bold; font-size: 13px; background-color: #000; color: #fff; border-radius: 2px;">ΨΦ</span>
      </div>
      <div class="header-title">${safe(settings?.name || 'Annapurna Thali House')}</div>
      ${settings?.address ? `<div class="header-detail">${safe(settings.address)}</div>` : ''}
    `;
  } else { // classic (default)
    headerHTML = `
      <div class="header-title">${safe(settings?.name || 'Annapurna Thali House')}</div>
      ${settings?.address ? `<div class="header-detail">${safe(settings.address)}</div>` : ''}
      ${settings?.phone ? `<div class="header-detail">PH: ${safe(settings.phone)}</div>` : ''}
      ${settings?.gstin ? `<div class="header-detail">GSTIN: ${safe(settings.gstin)}</div>` : ''}
    `;
  }

  const lineRows = order.items.map((i) => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    
    // Extract customizations/selections only if enabled
    const subline = [];
    if (settings?.show_thali_selections && i.thali_selections) {
      for (const cat of Object.keys(i.thali_selections)) {
        const names = i.thali_selections[cat];
        if (names && names.length) {
          subline.push(`+ ${safe(names.join(', '))}`);
        }
      }
    }
    if (settings?.show_thali_selections && i.thali_extras) {
      subline.push(`incl. ${safe(i.thali_extras)}`);
    }

    return `
      <tr>
        <td colspan="2" style="text-align: left; font-weight: bold; padding-top: 4px;">${safe(i.name)}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding-bottom: 4px;">${i.qty} x Rs.${Number(i.price).toFixed(2)}</td>
        <td style="text-align: right; padding-bottom: 4px; font-weight: bold;">Rs.${lineTotal}</td>
      </tr>
      ${subline.length > 0 ? `
      <tr>
        <td colspan="2" style="font-size: 10px; color: #444; padding-left: 12px; padding-bottom: 4px; line-height: 1.2;">
          ${subline.join('<br/>')}
        </td>
      </tr>` : ''}
    `;
  }).join('');

  const html = `<!doctype html>
<html><head><title>Receipt #${receiptNoFormatted}</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 0;
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontSize};
    line-height: 1.4;
    color: #000;
    background-color: #fff;
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-print-color-adjust: exact;
  }
  .receipt-container {
    width: ${containerWidth};
    margin: 0 auto;
    padding: ${containerPadding};
    box-sizing: border-box;
  }
  @media print {
    body {
      width: 100%;
    }
    .receipt-container {
      width: 100%;
      max-width: 100%;
      padding: ${containerPadding};
    }
  }
  .center {
    text-align: center;
  }
  .bold {
    font-weight: bold;
  }
  .header-title {
    font-size: 1.25em;
    font-weight: bold;
    margin: 0 0 4px 0;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .header-detail {
    font-size: 0.9em;
    margin: 2px 0;
    line-height: 1.3;
  }
  .separator-double {
    border-top: 3px double #000;
    margin: 8px 0;
  }
  .separator-dashed {
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  .meta-row {
    display: flex;
    justify-content: flex-start;
    margin: 2px 0;
  }
  .meta-label {
    width: 13ch;
    display: inline-block;
    white-space: pre;
  }
  .meta-value {
    flex-grow: 1;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
  }
  .total-row {
    font-size: 1.15em;
    font-weight: bold;
    padding: 6px 0;
  }
  .payment-method {
    margin: 12px 0 6px 0;
    font-weight: bold;
  }
  .date-time {
    margin-top: 8px;
    font-size: 0.95em;
  }
</style></head>
<body>
  <div class="receipt-container">
    <div style="text-align: ${headerAlign};">
      ${headerHTML}
    </div>
    
    <div class="separator-double"></div>
    
    <div class="meta-row">
      <span class="meta-label">Receipt #:</span>
      <span class="meta-value">${receiptNoFormatted}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date:</span>
      <span class="meta-value">${dateStr}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Time:</span>
      <span class="meta-value">${timeStr}</span>
    </div>
    ${order.cashier_name ? `
    <div class="meta-row">
      <span class="meta-label">Cashier:</span>
      <span class="meta-value">${safe(order.cashier_name)}</span>
    </div>` : ''}
    
    <div class="separator-dashed"></div>
    
    <table class="items-table">
      <tbody>
        ${lineRows}
      </tbody>
    </table>
    
    <div class="separator-dashed"></div>
    
    <div class="summary-row">
      <span>Subtotal</span>
      <span>Rs.${Number(order.subtotal).toFixed(2)}</span>
    </div>
    
    ${settings?.show_gst !== false ? `
    <div class="summary-row">
      <span>${safe(taxLabel)} (${gstRate}%)</span>
      <span>Rs.${Number(order.tax).toFixed(2)}</span>
    </div>` : ''}
    
    ${order.discount > 0 ? `
    <div class="summary-row">
      <span>Discount</span>
      <span>-Rs.${Number(order.discount).toFixed(2)}</span>
    </div>` : ''}
    
    <div class="separator-dashed"></div>
    <div class="summary-row total-row">
      <span>TOTAL</span>
      <span>Rs.${Number(order.total).toFixed(2)}</span>
    </div>
    <div class="separator-dashed"></div>
    
    ${settings?.show_payment !== false ? `
    <div class="payment-method">
      Payment: ${safe((order.payment_mode || 'cash').toUpperCase())}
    </div>
    <div class="separator-dashed"></div>
    ` : ''}
    
    <div class="center bold uppercase" style="margin-top: 10px;">
      ${safe(settings?.footer_msg || 'THANK YOU VISIT AGAIN')}
    </div>
    
    <div class="center date-time" style="margin-top: 8px; font-size: 0.9em; color: #444;">
      ${dateStr} ${timeStr}
    </div>
  </div>
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    };
  </script>
</body></html>`;

  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) return false;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  w.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}



