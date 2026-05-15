import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Clock, ChevronRight, CheckCircle2, Printer, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { printKOT, slaStatus } from "../lib/kot";

const LANES = [
  { key: "pending", title: "Received", next: "preparing", color: "border-l-amber-500" },
  { key: "preparing", title: "Preparing", next: "ready", color: "border-l-terracotta" },
  { key: "ready", title: "Ready", next: "served", color: "border-l-forest" },
];

const SLA_DOT = { ok: "bg-forest", warn: "bg-amber-500", overdue: "bg-destructive" };

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState({});
  const [now, setNow] = useState(Date.now());

  const refresh = async () => {
    const [o, t] = await Promise.all([
      api.get("/kot"),
      api.get("/tables"),
    ]);
    setOrders(o.data);
    setTables(Object.fromEntries(t.data.map((x) => [x.id, x.number])));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, []);

  const advance = async (o, next) => {
    await api.patch(`/orders/${o.id}/kot`, { kot_status: next });
    toast.success(`Order #${o.id.slice(0, 6)} → ${next}`);
    refresh();
  };

  const handlePrint = (o) => {
    printKOT({
      ...o,
      table_number: o.table_id ? tables[o.table_id] : null,
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Kitchen</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">KOT Board</h1>
          <p className="text-xs text-muted-foreground mt-1">20-min prep SLA · auto-flagged when overdue · last updated {new Date(now).toLocaleTimeString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-forest" /> On track</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Hurry</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Overdue</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {LANES.map(lane => {
          const lane_orders = orders.filter(o => (o.kot_status || "pending") === lane.key);
          return (
            <div key={lane.key} className="bg-white border border-border rounded-md flex flex-col min-h-[60vh]">
              <div className={`px-4 py-3 border-b border-border border-l-4 ${lane.color}`}>
                <div className="flex items-center justify-between">
                  <div className="font-display font-semibold">{lane.title}</div>
                  <div className="text-xs font-mono text-muted-foreground">{lane_orders.length}</div>
                </div>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto" data-testid={`kot-lane-${lane.key}`}>
                {lane_orders.length === 0 && <div className="text-xs text-muted-foreground text-center p-6">No orders.</div>}
                {lane_orders.map(o => {
                  const sla = slaStatus(o.created_at);
                  const isOverdue = sla.level === 'overdue';
                  return (
                    <Card key={o.id} className={`p-3 border-border shadow-none ${isOverdue ? 'ring-2 ring-red-300' : ''}`} data-testid={`kot-order-${o.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${SLA_DOT[sla.level]} ${sla.level === 'overdue' ? 'pulse-dot-offline' : ''}`} />
                          <span className="text-xs font-mono text-muted-foreground">#{o.id.slice(0, 6)}</span>
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-medium ${
                          o.type === 'swiggy' ? 'bg-swiggy/10 text-swiggy' :
                          o.type === 'zomato' ? 'bg-zomato/10 text-zomato' :
                          o.type === 'takeaway' ? 'bg-forest/10 text-forest' :
                          'bg-terracotta/10 text-terracotta'
                        }`}>{o.type.replace('_', ' ')}</div>
                      </div>
                      {o.table_id && <div className="text-xs text-muted-foreground mb-2">Table {tables[o.table_id] || ''}</div>}
                      <ul className="space-y-1 mb-3">
                        {o.items.map((it, i) => (
                          <li key={i} className="text-sm flex justify-between">
                            <span>{it.name}</span>
                            <span className="font-mono text-muted-foreground">×{it.qty}</span>
                          </li>
                        ))}
                      </ul>
                      <div className={`flex items-center justify-between text-xs mb-2 ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        <span className="flex items-center gap-1">
                          {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {sla.label}
                        </span>
                        <span className="font-mono text-muted-foreground">₹{o.total}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => handlePrint(o)} variant="outline" data-testid={`kot-print-${o.id}`} className="border-border text-xs">
                          <Printer className="w-3.5 h-3.5 mr-1" /> Print
                        </Button>
                        {lane.next && (
                          <Button onClick={() => advance(o, lane.next)} data-testid={`advance-${o.id}`}
                            className="bg-foreground hover:bg-foreground/90 text-white text-xs">
                            {lane.next === 'served' ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Served</> : <>{lane.next} <ChevronRight className="w-3.5 h-3.5 ml-1" /></>}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
