import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const LANES = [
  { key: "pending", title: "Received", next: "preparing", color: "border-l-amber-500" },
  { key: "preparing", title: "Preparing", next: "ready", color: "border-l-terracotta" },
  { key: "ready", title: "Ready", next: "served", color: "border-l-forest" },
];

export default function Kitchen() {
  const [orders, setOrders] = useState([]);

  const refresh = () => api.get("/kot").then(r => setOrders(r.data));

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  const advance = async (o, next) => {
    await api.patch(`/orders/${o.id}/kot`, { kot_status: next });
    toast.success(`Order #${o.id.slice(0, 6)} → ${next}`);
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Kitchen</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">KOT Board</h1>
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
                {lane_orders.map(o => (
                  <Card key={o.id} className="p-3 border-border shadow-none" data-testid={`kot-order-${o.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-mono text-muted-foreground">#{o.id.slice(0, 6)}</div>
                      <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-medium ${
                        o.type === 'swiggy' ? 'bg-swiggy/10 text-swiggy' :
                        o.type === 'zomato' ? 'bg-zomato/10 text-zomato' :
                        o.type === 'takeaway' ? 'bg-forest/10 text-forest' :
                        'bg-terracotta/10 text-terracotta'
                      }`}>{o.type.replace('_', ' ')}</div>
                    </div>
                    {o.table_id && <div className="text-xs text-muted-foreground mb-2">Table order</div>}
                    <ul className="space-y-1 mb-3">
                      {o.items.map((it, i) => (
                        <li key={i} className="text-sm flex justify-between">
                          <span>{it.name}</span>
                          <span className="font-mono text-muted-foreground">×{it.qty}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-mono">₹{o.total}</span>
                    </div>
                    {lane.next && (
                      <Button onClick={() => advance(o, lane.next)} data-testid={`advance-${o.id}`}
                        className="w-full bg-foreground hover:bg-foreground/90 text-white text-xs">
                        {lane.next === 'served' ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Mark Served</> : <>Move to {lane.next} <ChevronRight className="w-3.5 h-3.5 ml-1" /></>}
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
