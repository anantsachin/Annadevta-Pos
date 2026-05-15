import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { TrendingUp, ShoppingBag, Utensils, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";

const stat = (label, value, icon, sub) => (
  <Card className="p-5 border-border shadow-none">
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      {icon}
    </div>
    <div className="font-display text-3xl font-extrabold tracking-tight mt-2">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </Card>
);

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary").then(r => setData(r.data));
    const t = setInterval(() => api.get("/dashboard/summary").then(r => setData(r.data)), 15000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Overview</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight mt-1">Today at a glance</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="dashboard-stats">
        {stat("Today's Sales", `₹${data.today_sales.toLocaleString('en-IN')}`, <TrendingUp className="w-4 h-4 text-terracotta" />, `${data.today_orders} orders`)}
        {stat("Open Orders", data.open_orders, <ShoppingBag className="w-4 h-4 text-secondary" />, "Awaiting payment")}
        {stat("Tables Occupied", `${data.tables_occupied}/${data.tables_total}`, <Utensils className="w-4 h-4 text-forest" />)}
        {stat("Low Stock Items", data.low_stock_count, <AlertTriangle className="w-4 h-4 text-amber-600" />, "Below threshold")}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 border-border shadow-none lg:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Last 7 days</div>
          <h3 className="font-display text-lg font-semibold mb-4">Sales trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5C5C5C' }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fontSize: 11, fill: '#5C5C5C' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E6E4DE', fontSize: 12 }} />
                <Line type="monotone" dataKey="sales" stroke="#E06C4C" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">All-time</div>
          <h3 className="font-display text-lg font-semibold mb-4">Top items</h3>
          <ul className="space-y-3">
            {data.top_items.length ? data.top_items.map((it, i) => (
              <li key={it.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-terracotta-light text-terracotta flex items-center justify-center text-xs font-bold font-mono">{i + 1}</span>
                  <span className="font-medium">{it.name}</span>
                </div>
                <span className="font-mono text-muted-foreground">{it.qty}</span>
              </li>
            )) : <div className="text-sm text-muted-foreground">No data yet.</div>}
          </ul>
        </Card>

        <Card className="p-6 border-border shadow-none lg:col-span-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Today</div>
          <h3 className="font-display text-lg font-semibold mb-4">Sales by channel</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_type}>
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E6E4DE', fontSize: 12 }} />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {data.by_type.map((d) => (
                    <Cell key={d.type} fill={d.type === 'swiggy' ? '#FC8019' : d.type === 'zomato' ? '#CB202D' : d.type === 'takeaway' ? '#2D6A4F' : '#E06C4C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
