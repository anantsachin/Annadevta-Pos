import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Printer, Eye, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { printReceipt } from "../lib/receipt";

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [view, setView] = useState(null);

  const fetch = async () => {
    const params = {};
    if (from) params.from_date = `${from}T00:00:00+00:00`;
    if (to) params.to_date = `${to}T23:59:59+00:00`;
    if (q) params.q = q;
    const [{ data }, s] = await Promise.all([
      api.get("/orders", { params }),
      api.get("/settings"),
    ]);
    setOrders(data); setSettings(s.data);
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line */ }, [from, to]);

  const reprint = (o) => printReceipt({ order: o, settings });

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">History</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Past bills</h1>
      </div>

      <Card className="p-4 border-border shadow-none mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Search (receipt #)</label>
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 42" data-testid="filter-q" />
              <Button onClick={fetch} variant="outline" className="border-border" data-testid="filter-go"><Search className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Receipt #</th>
              <th className="text-left px-4 py-3">Date / Time</th>
              <th className="text-left px-4 py-3">Items</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-testid="orders-table">
            {orders.map(o => (
              <tr key={o.id} className="border-t border-border hover:bg-sand-subtle/40" data-testid={`order-row-${o.id}`}>
                <td className="px-4 py-3 font-mono font-semibold">#{o.receipt_no}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.paid_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-xs">{o.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</td>
                <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-md bg-sand-subtle border border-border">{o.payment_mode}</span></td>
                <td className="px-4 py-3 text-right font-mono font-bold">₹{o.total}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setView(o)} className="p-1.5 hover:bg-sand-subtle rounded-md mr-1" data-testid={`view-${o.id}`}><Eye className="w-4 h-4" /></button>
                  <button onClick={() => reprint(o)} className="p-1.5 hover:bg-sand-subtle rounded-md text-terracotta" data-testid={`reprint-${o.id}`}><Printer className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="6" className="text-center text-muted-foreground py-12">No bills in this range.</td></tr>}
          </tbody>
        </table>
      </Card>

      {view && (
        <Dialog open={true} onOpenChange={(o) => !o && setView(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Receipt #{view.receipt_no}</DialogTitle>
            </DialogHeader>
            <div className="text-sm">
              <div className="text-xs text-muted-foreground mb-3">{new Date(view.paid_at).toLocaleString('en-IN')} · {view.payment_mode.toUpperCase()}</div>
              <div className="border-t border-b border-border py-3 space-y-2">
                {view.items.map((it, i) => (
                  <div key={i}>
                    <div className="flex justify-between font-semibold">
                      <span>{it.name} <span className="text-muted-foreground font-mono text-xs">×{it.qty}</span></span>
                      <span className="font-mono">₹{(it.price * it.qty).toFixed(2)}</span>
                    </div>
                    {it.thali_selections && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {Object.entries(it.thali_selections).map(([k, v]) => v.length ? `${k}: ${v.join(', ')}` : null).filter(Boolean).join(" · ")}
                        {it.thali_extras && <span> · <i>{it.thali_extras}</i></span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-3 space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">₹{view.subtotal}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>GST</span><span className="font-mono">₹{view.tax}</span></div>
                {view.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="font-mono">- ₹{view.discount}</span></div>}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-border mt-2"><span>Total</span><span className="font-mono text-terracotta">₹{view.total}</span></div>
              </div>
              <Button onClick={() => reprint(view)} className="w-full mt-4 bg-terracotta hover:bg-terracotta-hover text-white" data-testid="dialog-reprint">
                <Printer className="w-4 h-4 mr-2" /> Reprint receipt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
