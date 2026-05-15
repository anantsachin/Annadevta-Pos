import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Discounts() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, active: true });
  const refresh = () => api.get("/discounts").then(r => setList(r.data));
  useEffect(() => { refresh(); }, []);
  const add = async () => {
    if (!form.code) return toast.error("Code required");
    await api.post("/discounts", { ...form, value: Number(form.value) });
    setForm({ code: "", type: "percent", value: 10, active: true }); refresh();
  };
  const remove = async (d) => { await api.delete(`/discounts/${d.id}`); refresh(); };
  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Promotions</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Discounts & Coupons</h1>
      </div>
      <Card className="p-4 border-border shadow-none mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} data-testid="disc-code" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-white border border-border rounded-md px-3 py-2 text-sm" data-testid="disc-type">
            <option value="percent">Percent (%)</option>
            <option value="flat">Flat (₹)</option>
          </select>
          <Input type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="disc-value" />
          <Button onClick={add} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="disc-add">Add</Button>
        </div>
      </Card>
      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Code</th><th className="text-left px-4 py-3">Type</th><th className="text-right px-4 py-3">Value</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody data-testid="disc-table">
            {list.map(d => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-semibold">{d.code}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{d.type}</td>
                <td className="px-4 py-3 text-right font-mono">{d.type === "percent" ? `${d.value}%` : `₹${d.value}`}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(d)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md" data-testid={`disc-del-${d.id}`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="4" className="text-center text-muted-foreground py-8">No discounts yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
