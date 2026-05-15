import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Download } from "lucide-react";
import { Button } from "../components/ui/button";

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const refresh = () => api.get("/orders", { params: { status: "paid" } }).then(r => setOrders(r.data));
  useEffect(() => { refresh(); }, []);

  const total = orders.reduce((s, o) => s + (o.total || 0), 0);

  const exportCSV = () => {
    const rows = [["Order ID", "Date", "Type", "Items", "Subtotal", "Tax", "Discount", "Total", "Payment"]];
    orders.forEach(o => rows.push([
      o.id.slice(0, 8), o.paid_at || o.created_at, o.type,
      o.items.map(i => `${i.name} x${i.qty}`).join("; "),
      o.subtotal, o.tax, o.discount, o.total, o.payment_mode || ""
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Analytics</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Sales reports</h1>
        </div>
        <Button onClick={exportCSV} variant="outline" className="border-border" data-testid="export-csv"><Download className="w-4 h-4 mr-2" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Total revenue</div>
          <div className="font-display text-3xl font-extrabold tracking-tight mt-2">₹{total.toLocaleString('en-IN')}</div>
        </Card>
        <Card className="p-5 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Total orders</div>
          <div className="font-display text-3xl font-extrabold tracking-tight mt-2">{orders.length}</div>
        </Card>
        <Card className="p-5 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Avg ticket</div>
          <div className="font-display text-3xl font-extrabold tracking-tight mt-2">₹{orders.length ? (total / orders.length).toFixed(0) : 0}</div>
        </Card>
      </div>

      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Channel</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody data-testid="reports-table">
            {orders.map(o => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(o.paid_at || o.created_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 capitalize">{o.type.replace('_', ' ')}</td>
                <td className="px-4 py-3 uppercase text-xs font-mono">{o.payment_mode || "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">₹{o.total}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="5" className="text-center text-muted-foreground py-8">No paid orders yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
