import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [form, setForm] = useState({ name: "", category_id: "", price: "", tax_rate: 5, is_veg: true });
  const [catName, setCatName] = useState("");

  const refresh = async () => {
    const [c, m] = await Promise.all([api.get("/categories"), api.get("/menu")]);
    setCategories(c.data); setMenu(m.data);
    if (!form.category_id && c.data[0]) setForm(f => ({ ...f, category_id: c.data[0].id }));
  };

  useEffect(() => { refresh(); }, []);

  const addCategory = async () => {
    if (!catName) return;
    await api.post("/categories", { name: catName });
    setCatName(""); refresh();
  };

  const addItem = async () => {
    if (!form.name || !form.category_id || !form.price) return toast.error("Fill all fields");
    await api.post("/menu", { ...form, price: Number(form.price), tax_rate: Number(form.tax_rate) });
    setForm({ name: "", category_id: form.category_id, price: "", tax_rate: 5, is_veg: true });
    refresh();
  };

  const toggle = async (m) => { await api.patch(`/menu/${m.id}/toggle`); refresh(); };
  const remove = async (m) => { await api.delete(`/menu/${m.id}`); refresh(); };

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Catalog</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Menu management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 border-border shadow-none">
          <div className="text-sm font-semibold mb-3">Add category</div>
          <div className="flex gap-2">
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Soups" data-testid="cat-name" />
            <Button onClick={addCategory} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="add-cat-btn"><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {categories.map(c => (
              <span key={c.id} className="text-xs px-2 py-1 rounded-md bg-sand-subtle border border-border">{c.name}</span>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border shadow-none lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Add menu item</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
            <Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="item-name" className="md:col-span-2" />
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              data-testid="item-cat" className="bg-white border border-border rounded-md px-3 py-2 text-sm">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input type="number" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="item-price" />
            <Button onClick={addItem} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="add-item-btn">Add</Button>
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={form.is_veg} onCheckedChange={(v) => setForm({ ...form, is_veg: v })} data-testid="item-veg-toggle" />
              Veg
            </label>
            <label className="flex items-center gap-2">
              GST %
              <Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="w-20" data-testid="item-tax" />
            </label>
          </div>
        </Card>
      </div>

      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-center px-4 py-3">GST</th>
              <th className="text-center px-4 py-3">Available</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-testid="menu-table">
            {menu.map(m => (
              <tr key={m.id} className="border-t border-border hover:bg-sand-subtle/40">
                <td className="px-4 py-3 font-medium">
                  <span className={`inline-block w-2 h-2 mr-2 rounded-sm ${m.is_veg ? 'bg-forest' : 'bg-destructive'}`} />
                  {m.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{categories.find(c => c.id === m.category_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">₹{m.price}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{m.tax_rate}%</td>
                <td className="px-4 py-3 text-center">
                  <Switch checked={m.available} onCheckedChange={() => toggle(m)} data-testid={`toggle-${m.id}`} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(m)} data-testid={`del-${m.id}`} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
