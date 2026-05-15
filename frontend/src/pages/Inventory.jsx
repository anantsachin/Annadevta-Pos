import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", quantity: 0, unit: "kg", low_stock_threshold: 5 });

  const refresh = () => api.get("/inventory").then(r => setItems(r.data));
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!form.name) return toast.error("Name required");
    await api.post("/inventory", { ...form, quantity: Number(form.quantity), low_stock_threshold: Number(form.low_stock_threshold) });
    setForm({ name: "", quantity: 0, unit: "kg", low_stock_threshold: 5 });
    refresh();
  };
  const remove = async (i) => { await api.delete(`/inventory/${i.id}`); refresh(); };
  const update = async (i, field, value) => {
    const next = { ...i, [field]: Number(value) || value };
    await api.put(`/inventory/${i.id}`, { name: next.name, quantity: Number(next.quantity), unit: next.unit, low_stock_threshold: Number(next.low_stock_threshold) });
    refresh();
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Stock</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Inventory</h1>
      </div>

      <Card className="p-4 border-border shadow-none mb-6">
        <div className="text-sm font-semibold mb-3">Add stock item</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="inv-name" className="md:col-span-2" />
          <Input type="number" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} data-testid="inv-qty" />
          <Input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} data-testid="inv-unit" />
          <div className="flex gap-2">
            <Input type="number" placeholder="Low at" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} data-testid="inv-thresh" />
            <Button onClick={add} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="inv-add"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-right px-4 py-3">Quantity</th>
              <th className="text-left px-4 py-3">Unit</th>
              <th className="text-right px-4 py-3">Low at</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-testid="inv-table">
            {items.map(i => {
              const low = i.quantity <= i.low_stock_threshold;
              return (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" defaultValue={i.quantity} onBlur={(e) => update(i, "quantity", e.target.value)}
                      className="w-24 text-right bg-white border border-border rounded-md px-2 py-1 font-mono text-sm"
                      data-testid={`inv-qty-${i.id}`} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.unit}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{i.low_stock_threshold}</td>
                  <td className="px-4 py-3 text-center">
                    {low ? (
                      <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-forest-light text-forest">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(i)} data-testid={`inv-del-${i.id}`} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
