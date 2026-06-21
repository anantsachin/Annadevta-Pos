import React, { useCallback, useEffect, useState } from "react";
import api, { API } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Download, FileSpreadsheet, FileText, BarChart3, Sparkles, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const REPORT_TABS = [
  { key: "sales", label: "Daily Sales", icon: ShoppingBag },
  { key: "products", label: "Products", icon: BarChart3 },
  { key: "thalis", label: "Thalis", icon: Sparkles },
];

const PERIODS = [
  { key: "today", label: "Today", days: 0 },
  { key: "week", label: "Last 7 days", days: 7 },
  { key: "month", label: "Last 30 days", days: 30 },
  { key: "custom", label: "Custom" },
];

const toIso = (dt, endOfDay = false) => {
  const d = new Date(dt);
  if (endOfDay) d.setHours(23, 59, 59, 999); else d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [periodKey, setPeriodKey] = useState("week");
  const [customFrom, setCustomFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [thaliPicks, setThaliPicks] = useState([]);

  const fromIso = periodKey === "custom" ? toIso(customFrom) : toIso(new Date(Date.now() - PERIODS.find(p => p.key === periodKey).days * 86400000));
  const toIsoStr = periodKey === "custom" ? toIso(customTo, true) : toIso(new Date(), true);

  const fetch = useCallback(async () => {
    try {
      const params = { from_date: fromIso, to_date: toIsoStr };
      if (tab === "sales") {
        const { data } = await api.get("/reports/sales", { params });
        setRows(data); setThaliPicks([]);
      } else if (tab === "products") {
        const { data } = await api.get("/reports/products", { params });
        setRows(data); setThaliPicks([]);
      } else {
        const { data } = await api.get("/reports/thalis", { params });
        setRows(data.thalis); setThaliPicks(data.selection_picks || []);
      }
    } catch (e) {
      console.error("Report load failed", e);
      toast.error("Failed to load report");
    }
  }, [tab, fromIso, toIsoStr]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = async (fmt) => {
    try {
      const token = localStorage.getItem("pos_token");
      const url = `${API}/reports/export/${tab}.${fmt}?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIsoStr)}`;
      const res = await window.fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${tab}_${fromIso.slice(0, 10)}_${toIsoStr.slice(0, 10)}.${fmt}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Exported ${fmt.toUpperCase()}`);
    } catch (e) {
      toast.error(e.message || "Export failed");
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Analytics</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Reports</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => download("csv")} variant="outline" className="border-border" data-testid="export-csv">
            <FileText className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={() => download("xlsx")} className="bg-forest hover:bg-forest-hover text-white" data-testid="export-xlsx">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-md" data-testid="report-tabs">
          {REPORT_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} data-testid={`report-${t.key}`}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                tab === t.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-md" data-testid="period-tabs">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriodKey(p.key)} data-testid={`rperiod-${p.key}`}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                periodKey === p.key ? "bg-terracotta text-white" : "text-muted-foreground hover:text-foreground"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {periodKey === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" data-testid="custom-from" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" data-testid="custom-to" />
          </div>
        )}
      </div>

      <Card className="border-border shadow-none overflow-hidden">
        {tab === "sales" && (
          <table className="w-full text-sm">
            <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Receipt #</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-right px-4 py-3">Subtotal</th>
                <th className="text-right px-4 py-3">GST</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody data-testid="sales-table">
              {rows.map(o => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono font-semibold">#{o.receipt_no}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.paid_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 uppercase text-xs font-mono">{o.payment_mode}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{o.subtotal}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{o.tax}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₹{o.total}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="text-center text-muted-foreground py-10">No sales in this period.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === "products" && (
          <table className="w-full text-sm">
            <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-right px-4 py-3">Qty Sold</th>
                <th className="text-right px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody data-testid="products-table">
              {rows.map((it, i) => (
                <tr key={it.name} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{it.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{it.qty}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₹{it.revenue}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="4" className="text-center text-muted-foreground py-10">No data.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === "thalis" && (
          <div>
            <table className="w-full text-sm">
              <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Thali</th>
                  <th className="text-right px-4 py-3">Qty Sold</th>
                  <th className="text-right px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody data-testid="thalis-table">
                {rows.map((it, i) => (
                  <tr key={it.name} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{it.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{it.qty}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">₹{it.revenue}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="4" className="text-center text-muted-foreground py-10">No thalis sold.</td></tr>}
              </tbody>
            </table>
            {thaliPicks.length > 0 && (
              <div className="p-4 border-t border-border bg-sand-subtle">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-semibold">Most-picked items inside thalis</div>
                <div className="flex flex-wrap gap-2">
                  {thaliPicks.slice(0, 20).map((p) => (
                    <span key={p.name} className="text-xs px-2.5 py-1 rounded-md bg-white border border-border">
                      {p.name} <span className="font-mono text-muted-foreground">×{p.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
