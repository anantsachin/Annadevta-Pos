// Open a new window and print a KOT ticket
export function printKOT({ id, external_id, platform, type, table_id, table_number, customer_name, customer_phone, items, total, notes, created_at }) {
  const title = `KOT — ${external_id || id?.slice(0, 6) || ''}`;
  const dt = new Date(created_at || Date.now());
  const platformLabel = platform || type || 'dine-in';
  const accent = platform === 'swiggy' ? '#FC8019' : platform === 'zomato' ? '#CB202D' : '#E06C4C';

  const rows = items.map((i) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px dashed #999;">
        <div style="font-weight:700;font-size:14px;">${escapeHtml(i.name)}</div>
        ${i.notes ? `<div style="font-size:11px;color:#555;">${escapeHtml(i.notes)}</div>` : ''}
      </td>
      <td style="padding:6px 0;border-bottom:1px dashed #999;text-align:right;font-family:monospace;font-weight:700;font-size:16px;">×${i.qty}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html><head><title>${title}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; width: 72mm; margin: 0; color: #000; }
  .accent { color: ${accent}; }
  h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 1px; }
  .small { font-size: 11px; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .hr { border-top: 2px solid #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
</style></head>
<body>
  <h1 class="accent">${platformLabel.toUpperCase()} KOT</h1>
  <div class="small">${dt.toLocaleString('en-IN')}</div>
  <div class="hr"></div>
  <div class="row"><span>Order #</span><b style="font-family:monospace">${escapeHtml(external_id || id?.slice(0,8) || '')}</b></div>
  ${table_number ? `<div class="row"><span>Table</span><b>${escapeHtml(table_number)}</b></div>` : ''}
  ${customer_name ? `<div class="row"><span>Guest</span><b>${escapeHtml(customer_name)}</b></div>` : ''}
  ${customer_phone ? `<div class="row"><span>Phone</span><b style="font-family:monospace">${escapeHtml(customer_phone)}</b></div>` : ''}
  <div class="hr"></div>
  <table>${rows}</table>
  ${notes ? `<div class="hr"></div><div class="small"><b>Notes:</b> ${escapeHtml(notes)}</div>` : ''}
  <div class="hr"></div>
  ${total != null ? `<div class="row" style="font-size:14px;"><b>Total</b><b>₹${total}</b></div>` : ''}
  <div style="text-align:center;margin-top:14px;font-size:10px;color:#666;">FORK&FIRE POS</div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// SLA helpers
const SLA_TARGET_MIN = 20;
const SLA_WARN_MIN = 15;

export function slaStatus(referenceIso) {
  const m = Math.floor((Date.now() - new Date(referenceIso).getTime()) / 60000);
  if (m >= SLA_TARGET_MIN) return { level: 'overdue', mins: m, label: `Overdue +${m - SLA_TARGET_MIN}m` };
  if (m >= SLA_WARN_MIN) return { level: 'warn', mins: m, label: `${SLA_TARGET_MIN - m}m left` };
  return { level: 'ok', mins: m, label: `${SLA_TARGET_MIN - m}m left` };
}

export const SLA_TARGETS = { target: SLA_TARGET_MIN, warn: SLA_WARN_MIN };
