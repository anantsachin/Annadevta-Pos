// Customer receipt printer (80mm thermal)
export function printReceipt({ order, settings }) {
  if (!order) return;
  const dt = new Date(order.paid_at || order.created_at || Date.now());
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const lineRows = order.items.map((i) => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    const subline = [];
    if (i.thali_selections) {
      for (const cat of Object.keys(i.thali_selections)) {
        const names = i.thali_selections[cat];
        if (names && names.length) subline.push(`+ ${safe(names.join(', '))}`);
      }
    }
    if (i.thali_extras) subline.push(`incl. ${safe(i.thali_extras)}`);
    return `
      <tr>
        <td colspan="3" style="padding-top:4px;font-weight:700;">${safe(i.name)}</td>
      </tr>
      <tr>
        <td style="font-family:monospace;width:18mm;">${i.qty} × ${i.price.toFixed(2)}</td>
        <td></td>
        <td style="text-align:right;font-family:monospace;font-weight:700;">₹${lineTotal}</td>
      </tr>
      ${subline.map((s) => `<tr><td colspan="3" style="font-size:10px;color:#444;padding-left:4px;">${s}</td></tr>`).join('')}
    `;
  }).join('');

  const html = `<!doctype html>
<html><head><title>Receipt #${order.receipt_no}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; width: 72mm; margin: 0; color: #000; font-size: 12px; }
  h1 { font-size: 14px; margin: 0; letter-spacing: 0.5px; text-align: center; }
  .center { text-align: center; }
  .small { font-size: 10px; color: #444; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .hr2 { border-top: 2px solid #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  .total-row { font-size: 14px; font-weight: 800; }
</style></head>
<body>
  <h1>${safe(settings?.name || 'Thali House')}</h1>
  <div class="center small">${safe(settings?.address || '')}</div>
  ${settings?.phone ? `<div class="center small">Ph: ${safe(settings.phone)}</div>` : ''}
  ${settings?.gstin ? `<div class="center small">GSTIN: ${safe(settings.gstin)}</div>` : ''}
  <div class="hr2"></div>
  <div class="row"><span>Receipt #</span><b style="font-family:monospace">${order.receipt_no}</b></div>
  <div class="row"><span>${dt.toLocaleDateString('en-IN')}</span><span>${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
  ${order.cashier_name ? `<div class="row"><span>Cashier</span><span>${safe(order.cashier_name)}</span></div>` : ''}
  <div class="hr"></div>
  <table>${lineRows}</table>
  <div class="hr"></div>
  <div class="row"><span>Subtotal</span><span style="font-family:monospace">₹${Number(order.subtotal).toFixed(2)}</span></div>
  <div class="row"><span>GST</span><span style="font-family:monospace">₹${Number(order.tax).toFixed(2)}</span></div>
  ${order.discount > 0 ? `<div class="row"><span>Discount</span><span style="font-family:monospace">- ₹${Number(order.discount).toFixed(2)}</span></div>` : ''}
  <div class="hr"></div>
  <div class="row total-row"><span>TOTAL</span><span style="font-family:monospace">₹${Number(order.total).toFixed(2)}</span></div>
  <div class="row small"><span>Paid via</span><b>${safe((order.payment_mode || 'cash').toUpperCase())}</b></div>
  <div class="hr2"></div>
  <div class="center small">${safe(settings?.footer_msg || 'Thank you!')}</div>
  <div class="center small">${dt.toLocaleString('en-IN')}</div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) return false;
  // Render via Blob URL instead of document.write (CSP/XSS-safer).
  // All dynamic interpolations are passed through safe() above.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  w.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
