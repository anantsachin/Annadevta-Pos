import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { TrendingUp, ShoppingBag, IndianRupee, Banknote, Smartphone, CreditCard, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const PAY_COLORS = { cash: "#2D6A4F", upi: "#E06C4C", card: "#457B9D" };
const PAY_ICONS = { cash: Banknote, upi: Smartphone, card: CreditCard };

const Stat = ({ label, value, sub, accent }) => (
  <Card className="p-5 border-border shadow-none">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
    <div className={`font-display text-3xl font-extrabold tracking-tight mt-2 flex items-center ${accent || ""}`}>
      <IndianRupee className="w-5 h-5 mr-0.5 text-muted-foreground" />
      {value}
    </div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </Card>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("today");

  useEffect(() => {
    const fetchSummary = () => api.get("/dashboard/summary").then((r) => setData(r.data));
    fetchSummary();
    const t = setInterval(fetchSummary, 20000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const k = data[period];
  const topItems = data[`top_items_${period}`] || [];
  const topThalis = data[`top_thalis_${period}`] || [];
  const pay = data[`payment_${period}`] || { cash: 0, upi: 0, card: 0 };
  const payTotal = pay.cash + pay.upi + pay.card;

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Business pulse</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-md" data-testid="period-tabs">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} data-testid={`period-${p.key}`}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                period === p.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" data-testid="kpi-cards">
        <Stat label="Revenue" value={k.revenue.toLocaleString('en-IN')} accent="text-terracotta" />
        <Stat label="Orders" value={k.orders} sub={k.orders > 0 ? `${k.orders} bills` : "No bills yet"} />
        <Stat label="Avg Bill Value" value={k.avg.toLocaleString('en-IN')} sub="Per receipt" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-6 border-border shadow-none lg:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Last 7 days</div>
          <h3 className="font-display text-lg font-semibold mb-4">Revenue trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5C5C5C' }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fontSize: 11, fill: '#5C5C5C' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E6E4DE', fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#E06C4C" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{PERIODS.find(p => p.key === period).label}</div>
          <h3 className="font-display text-lg font-semibold mb-4">Payment mix</h3>
          {payTotal === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No payments yet.</div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { mode: "Cash", amount: pay.cash },
                    { mode: "UPI", amount: pay.upi },
                    { mode: "Card", amount: pay.card },
                  ]} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="mode" tick={{ fontSize: 12 }} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E6E4DE', fontSize: 12 }} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      <Cell fill={PAY_COLORS.cash} />
                      <Cell fill={PAY_COLORS.upi} />
                      <Cell fill={PAY_COLORS.card} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {Object.entries(pay).map(([mode, amt]) => {
                  const Icon = PAY_ICONS[mode];
                  const pct = payTotal > 0 ? Math.round((amt / payTotal) * 100) : 0;
                  return (
                    <div key={mode} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" style={{ color: PAY_COLORS[mode] }} /> {mode}
                      </span>
                      <span className="font-mono">₹{amt.toLocaleString('en-IN')} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 border-border shadow-none">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-terracotta" />
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Top thalis · {PERIODS.find(p => p.key === period).label.toLowerCase()}</div>
          </div>
          <h3 className="font-display text-lg font-semibold mb-4">Best-selling thali</h3>
          <ul className="space-y-2" data-testid="top-thalis">
            {topThalis.length === 0 ? <li className="text-sm text-muted-foreground">No thalis sold yet.</li> : topThalis.map((it, i) => (
              <li key={it.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-terracotta-light text-terracotta flex items-center justify-center text-xs font-bold font-mono">{i + 1}</span>
                  <span className="font-medium text-sm">{it.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{it.qty}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">₹{it.revenue}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 border-border shadow-none">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-secondary" />
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Top items · {PERIODS.find(p => p.key === period).label.toLowerCase()}</div>
          </div>
          <h3 className="font-display text-lg font-semibold mb-4">Most ordered (non-thali)</h3>
          <ul className="space-y-2" data-testid="top-items">
            {topItems.length === 0 ? <li className="text-sm text-muted-foreground">No items sold yet.</li> : topItems.map((it, i) => (
              <li key={it.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-forest-light text-forest flex items-center justify-center text-xs font-bold font-mono">{i + 1}</span>
                  <span className="font-medium text-sm">{it.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{it.qty}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">₹{it.revenue}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
