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

  const receiptNoPadded = String(order.receipt_no ?? '').padStart(6, '0');
  const gstRate = settings?.gst_rate ?? 5.0;

  const lineRows = order.items.map((i) => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    return `
      <tr>
        <td style="text-align: left; padding: 4px 0; vertical-align: top;">${safe(i.name)}</td>
        <td style="text-align: center; padding: 4px 0; vertical-align: top;">${i.qty}</td>
        <td style="text-align: right; padding: 4px 0; vertical-align: top;">Rs.${lineTotal}</td>
      </tr>
    `;
  }).join('');

  const html = `<!doctype html>
<html><head><title>Receipt #${receiptNoPadded}</title>
<style>
  @page {
    size: auto;
    margin: 0;
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background-color: #fff;
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-print-color-adjust: exact;
  }
  .receipt-container {
    width: 72mm;
    margin: 0 auto;
    padding: 4mm;
    box-sizing: border-box;
  }
  @media print {
    body {
      width: 100%;
    }
    .receipt-container {
      width: 100%;
      max-width: 100%;
      padding: 2mm;
    }
  }
  .center {
    text-align: center;
  }
  .bold {
    font-weight: bold;
  }
  .header-title {
    font-size: 15px;
    font-weight: bold;
    margin: 0 0 4px 0;
    text-transform: uppercase;
  }
  .header-detail {
    font-size: 11px;
    margin: 1px 0;
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
  .items-table th {
    padding: 6px 0;
    font-weight: bold;
  }
  .items-table td {
    padding: 4px 0;
    vertical-align: top;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
  }
  .total-row {
    font-size: 14px;
    font-weight: bold;
    padding: 8px 0;
  }
  .payment-method {
    margin: 12px 0 6px 0;
    font-weight: bold;
  }
  .date-time {
    margin-top: 8px;
    font-size: 11px;
  }
</style></head>
<body>
  <div class="receipt-container">
    <div class="center header-title">${safe(settings?.name || 'Annapurna Thali House')}</div>
    ${settings?.address ? `<div class="center header-detail">${safe(settings.address)}</div>` : ''}
    ${settings?.phone ? `<div class="center header-detail">Ph: ${safe(settings.phone)}</div>` : ''}
    ${settings?.gstin ? `<div class="center header-detail">GSTIN: ${safe(settings.gstin)}</div>` : ''}
    
    <div class="separator-double"></div>
    
    <div class="meta-row">
      <span class="meta-label">Receipt No :</span>
      <span class="meta-value">${receiptNoPadded}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date       :</span>
      <span class="meta-value">${dateStr}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Time       :</span>
      <span class="meta-value">${timeStr}</span>
    </div>
    ${order.cashier_name ? `
    <div class="meta-row">
      <span class="meta-label">Cashier    :</span>
      <span class="meta-value">${safe(order.cashier_name)}</span>
    </div>` : ''}
    
    <div class="separator-dashed"></div>
    <div class="center bold">ITEMS</div>
    <div class="separator-dashed"></div>
    
    <table class="items-table">
      <thead>
        <tr style="border-bottom: 1px dashed #000;">
          <th style="text-align: left; padding-bottom: 6px;">ITEM</th>
          <th style="text-align: center; width: 6ch; padding-bottom: 6px;">QTY</th>
          <th style="text-align: right; width: 12ch; padding-bottom: 6px;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>
    
    <div class="separator-dashed"></div>
    
    <div class="summary-row">
      <span>Subtotal</span>
      <span>Rs.${Number(order.subtotal).toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>GST (${gstRate}%)</span>
      <span>Rs.${Number(order.tax).toFixed(2)}</span>
    </div>
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
    
    <div class="payment-method">
      Payment Method : ${safe((order.payment_mode || 'cash').toUpperCase())}
    </div>
    
    <div class="separator-double"></div>
    <div class="center bold">THANK YOU FOR VISITING</div>
    <div class="center bold">${safe(settings?.name || 'Annapurna Thali House').toUpperCase()}</div>
    <div class="separator-double"></div>
    
    <div class="center date-time">${dateStr} ${timeStr}</div>
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

