import React, { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Printer, Eye, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { printReceipt } from "../lib/receipt";
import ReceiptPreview from "../components/ReceiptPreview";
import { useLanguage } from "../context/LanguageContext";
import { safeArray } from "../lib/safeArray";

export default function OrderHistory() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const getLocalDateString = (rawDate) => {
    if (!rawDate) return "";
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFilterDateRange = (filterKey) => {
    const now = new Date();
    const todayStr = getLocalDateString(now);

    if (filterKey === "all") {
      return { fromStr: "", toStr: "" };
    } else if (filterKey === "today") {
      return { fromStr: todayStr, toStr: todayStr };
    } else if (filterKey === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { fromStr: getLocalDateString(d), toStr: todayStr };
    } else if (filterKey === "month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromStr: getLocalDateString(d), toStr: todayStr };
    }

    return { fromStr: "", toStr: "" };
  };

  const [from, setFrom] = useState(() => getFilterDateRange("all").fromStr);
  const [to, setTo] = useState(() => getFilterDateRange("all").toStr);
  const [q, setQ] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [appliedSearchDate, setAppliedSearchDate] = useState("");
  const [view, setView] = useState(null);

  const handleFilterChange = (filterKey) => {
    setActiveFilter(filterKey);
    const { fromStr, toStr } = getFilterDateRange(filterKey);
    setFrom(fromStr);
    setTo(toStr);
    setSearchDate("");
    setAppliedSearchDate("");
  };

  const handleSearchDate = () => {
    setAppliedSearchDate(searchDate);
  };

  const fetchOrders = useCallback(async () => {
    const params = {};
    if (q) params.q = q;
    try {
      const [{ data }, s] = await Promise.all([
        api.get("/orders", { params }),
        api.get("/settings"),
      ]);
      setOrders(safeArray(data)); setSettings(s.data);
    } catch (err) {
      console.error("Failed to load orders", err);
      setOrders([]);
    }
  }, [q]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = React.useMemo(() => {
    if (!Array.isArray(orders)) return [];
    let list = orders;

    // Filter by exact single Search Order Date if applied
    if (appliedSearchDate) {
      list = list.filter((o) => {
        const rawDate = o.paid_at || o.created_at || o.date;
        return getLocalDateString(rawDate) === appliedSearchDate;
      });
    }

    // Filter by custom From / To date pickers if selected
    if (from || to) {
      list = list.filter((o) => {
        const rawDate = o.paid_at || o.created_at || o.date;
        if (!rawDate) return false;
        const dStr = getLocalDateString(rawDate);
        if (from && dStr < from) return false;
        if (to && dStr > to) return false;
        return true;
      });
    }

    if (activeFilter === "all") return list;

    const todayStr = getLocalDateString(new Date());

    return list.filter((o) => {
      const rawDate = o.paid_at || o.created_at || o.date;
      if (!rawDate) return false;
      const dStr = getLocalDateString(rawDate);

      if (activeFilter === "today") {
        return dStr === todayStr;
      }
      if (activeFilter === "week") {
        const now = new Date();
        const weekStartStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
        return dStr >= weekStartStr && dStr <= todayStr;
      }
      if (activeFilter === "month") {
        const now = new Date();
        const monthStartStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
        return dStr >= monthStartStr && dStr <= todayStr;
      }
      return true;
    });
  }, [orders, activeFilter, appliedSearchDate, from, to]);

  const reprint = (o) => printReceipt({ order: o, settings });

  return (
    <div className="
      h-full
      bg-[#FFFDF9]
      rounded-[32px]
      border
      border-[#F4E6D7]
      shadow-lg
      p-8
      flex
      flex-col
      overflow-hidden
    ">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[15px] uppercase tracking-[0.1em] font-bold bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] bg-clip-text text-transparent">History</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("order_history")}</h1>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-[#FFF8F2] border border-[#F4E6D7] rounded-full self-start sm:self-auto" data-testid="date-filter-buttons">
          <button
            type="button"
            onClick={() => handleFilterChange("all")}
            data-testid="filter-btn-all"
            className={`px-4 py-1.5 text-xs font-bold tracking-wider rounded-full transition-all duration-200 ${
              activeFilter === "all"
                ? "bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] text-white shadow-sm"
                : "bg-white text-slate-600 hover:text-slate-900 border border-[#F4E6D7]"
            }`}
          >
            ALL
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("today")}
            data-testid="filter-btn-today"
            className={`px-4 py-1.5 text-xs font-bold tracking-wider rounded-full transition-all duration-200 ${
              activeFilter === "today"
                ? "bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] text-white shadow-sm"
                : "bg-white text-slate-600 hover:text-slate-900 border border-[#F4E6D7]"
            }`}
          >
            TODAY
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("week")}
            data-testid="filter-btn-week"
            className={`px-4 py-1.5 text-xs font-bold tracking-wider rounded-full transition-all duration-200 ${
              activeFilter === "week"
                ? "bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] text-white shadow-sm"
                : "bg-white text-slate-600 hover:text-slate-900 border border-[#F4E6D7]"
            }`}
          >
            THIS WEEK
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("month")}
            data-testid="filter-btn-month"
            className={`px-4 py-1.5 text-xs font-bold tracking-wider rounded-full transition-all duration-200 ${
              activeFilter === "month"
                ? "bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] text-white shadow-sm"
                : "bg-white text-slate-600 hover:text-slate-900 border border-[#F4E6D7]"
            }`}
          >
            THIS MONTH
          </button>
        </div>
      </div>

      <Card className="p-4 border-border shadow-none mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider font-semibold block mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full text-xs" data-testid="filter-from" />
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider font-semibold block mb-1">{t("to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full text-xs" data-testid="filter-to" />
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider font-semibold block mb-1 truncate">{t("search_receipt_placeholder")}</label>
            <div className="flex gap-1.5">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 42" className="min-w-0 flex-1 text-xs" data-testid="filter-q" />
              <Button onClick={fetchOrders} variant="outline" className="border-border shrink-0 px-3" data-testid="filter-go"><Search className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider font-semibold block mb-1 truncate">Search Order Date</label>
            <div className="flex gap-1.5">
              <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="min-w-0 flex-1 text-xs" data-testid="filter-search-date" />
              <Button onClick={handleSearchDate} variant="outline" className="border-border shrink-0 px-3" data-testid="filter-date-go"><Search className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex-1
      border-[#F4E6D7]
      bg-white
      rounded-[26px]
      shadow-sm
      overflow-hidden
      flex
      flex-col
      min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-sm">
          <thead className="sticky
          top-0
          z-10
          bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00]
          text-white
          text-[13px] uppercase
          tracking-[0.2em]
          font-semibold">
            <tr>
              <th className="text-left px-4 py-3 ">{t("receipt_no_col")}</th>
              <th className="text-left px-4 py-3">{t("date")} / {t("time")}</th>
              <th className="text-left px-4 py-3">{t("items_col")}</th>
              <th className="text-left px-4 py-3">{t("payment_col")}</th>
              <th className="text-right px-4 py-3">{t("total")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-testid="orders-table">
            {Array.isArray(filteredOrders) && filteredOrders.map(o => {
              let pm = o.payment_mode;
              if (o.payment_mode === "cash") pm = t("cash");
              if (o.payment_mode === "upi") pm = t("upi");
              if (o.payment_mode === "card") pm = t("card");
              const orderItems = Array.isArray(o.items) ? o.items : [];
              return (
                <tr key={o.id} className="border-t border-border hover:bg-[#FFF8F2]" data-testid={`order-row-${o.id}`}>
                  <td className="px-4 py-3 font-mono font-semibold">#{o.receipt_no}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.paid_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs">{orderItems.map(i => `${t(i.name)} ×${i.qty}`).join(", ")}</td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-md bg-sand-subtle border border-border">{pm}</span></td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₹{o.total}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setView(o)} className="p-1.5 hover:bg-sand-subtle rounded-md mr-1" data-testid={`view-${o.id}`}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => reprint(o)} className="p-1.5 hover:bg-sand-subtle rounded-md text-terracota" data-testid={`reprint-${o.id}`}><Printer className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && <tr><td colSpan="6" className="text-center text-muted-foreground py-12">{t("no_bills_yet")}</td></tr>}
          </tbody>
        </table>
        </div>
      </Card>

      {view && (
        <Dialog open={true} onOpenChange={(o) => !o && setView(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto flex flex-col items-center bg-neutral-50 p-6 border border-border">
            <DialogHeader className="w-full text-center mb-1">
              <DialogTitle className="font-display text-lg text-neutral-700">{t("order_details")}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <ReceiptPreview order={view} settings={settings} />
            </div>
            <Button onClick={() => reprint(view)} className="w-full mt-4 bg-terracota hover:bg-terracota-hover text-white" data-testid="dialog-reprint">
              <Printer className="w-4 h-4 mr-2" /> {t("reprint")}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
