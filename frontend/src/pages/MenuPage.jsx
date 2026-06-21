import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { Plus, Trash2, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [editing, setEditing] = useState(null); // editing item or null
  const [catName, setCatName] = useState("");

  const refresh = async () => {
    const [c, m] = await Promise.all([api.get("/categories"), api.get("/menu")]);
    setCategories(c.data); setMenu(m.data);
  };
  useEffect(() => { refresh(); }, []);

  const addCategory = async () => {
    if (!catName.trim()) return;
    await api.post("/categories", { name: catName });
    setCatName(""); refresh();
  };

  const startNew = () => {
    setEditing({
      id: null,
      name: "",
      category_id: categories[0]?.id || "",
      price: 0,
      available: true,
      is_thali: false,
      thali_groups: [],
      thali_extras: "",
    });
  };

  const startEdit = (item) => {
    const groups = (item.thali_groups || []).map((g, i) => ({
      ...g,
      _key: g._key || `${g.category_id || 'k'}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    setEditing({ ...item, thali_groups: groups });
  };

  const save = async () => {
    if (!editing.name || !editing.category_id) return toast.error("Name and category required");
    const payload = {
      name: editing.name,
      category_id: editing.category_id,
      price: Number(editing.price),
      available: editing.available,
      is_thali: editing.is_thali,
      thali_groups: editing.is_thali ? editing.thali_groups.filter(g => g.category_id) : [],
      thali_extras: editing.thali_extras || "",
    };
    try {
      if (editing.id) await api.put(`/menu/${editing.id}`, payload);
      else await api.post("/menu", payload);
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Are you sure?\n\nDelete "${m.name}"?\n\nThis action cannot be undone.`)) return;
    await api.delete(`/menu/${m.id}`);
    refresh();
  };
  const toggle = async (m) => { await api.patch(`/menu/${m.id}/toggle`); refresh(); };

  const removeCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    await api.delete(`/categories/${c.id}`); refresh();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Catalog</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Menu</h1>
        </div>
        <Button onClick={startNew} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="add-item-btn">
          <Plus className="w-4 h-4 mr-2" /> Add item
        </Button>
      </div>

      <Card className="p-4 border-border shadow-none mb-6">
        <div className="text-sm font-semibold mb-3">Categories</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-sand-subtle border border-border">
              {c.name}
              <button onClick={() => removeCat(c)} data-testid={`del-cat-${c.id}`} className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-md">
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category (e.g. Sweets)" data-testid="cat-name" />
          <Button onClick={addCategory} variant="outline" className="border-border" data-testid="add-cat-btn"><Plus className="w-4 h-4" /></Button>
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-center px-4 py-3">Available</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-testid="menu-table">
            {menu.map(m => (
              <tr key={m.id} className="border-t border-border hover:bg-sand-subtle/40">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    {m.is_thali && <span className="text-[9px] uppercase tracking-[0.18em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">Thali</span>}
                    {m.name}
                  </div>
                  {m.is_thali && m.thali_groups?.length > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {m.thali_groups.map(g => `${g.count} ${g.label}`).join(' + ')}
                      {m.thali_extras ? ` + ${m.thali_extras}` : ''}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{categories.find(c => c.id === m.category_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">₹{m.price}</td>
                <td className="px-4 py-3 text-center">
                  <Switch checked={m.available} onCheckedChange={() => toggle(m)} data-testid={`toggle-${m.id}`} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(m)} data-testid={`edit-${m.id}`} className="text-foreground hover:bg-sand-subtle p-1.5 rounded-md mr-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(m)} data-testid={`del-${m.id}`} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {menu.length === 0 && <tr><td colSpan="5" className="text-center text-muted-foreground py-8">No items yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Dialog open={true} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{editing.id ? "Edit item" : "New item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Name</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="edit-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
                  <select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                    className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1" data-testid="edit-cat">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Price (₹)</label>
                  <Input type="number" value={editing.price} onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val < 0) {
                      toast.error("Price cannot be negative");
                      setEditing({ ...editing, price: 0 });
                    } else {
                      setEditing({ ...editing, price: e.target.value });
                    }
                  }} data-testid="edit-price" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_thali} onCheckedChange={(v) => setEditing({ ...editing, is_thali: v })} data-testid="edit-thali" />
                  <Sparkles className="w-4 h-4 text-terracotta" /> This is a Thali
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.available} onCheckedChange={(v) => setEditing({ ...editing, available: v })} data-testid="edit-avail" />
                  Available
                </label>
              </div>

              {editing.is_thali && (
                <div className="bg-sand-subtle border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Thali rules</div>
                    <Button size="sm" variant="outline" className="border-border h-7 text-xs"
                      onClick={() => setEditing({
                        ...editing,
                        thali_groups: [
                          ...(editing.thali_groups || []),
                          { category_id: "", label: "", count: 1, _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
                        ],
                      })}
                      data-testid="add-thali-group">
                      <Plus className="w-3 h-3 mr-1" /> Add rule
                    </Button>
                  </div>
                  {(editing.thali_groups || []).map((g, idx) => (
                    <div key={g._key || idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`thali-group-row-${idx}`}>
                      <select value={g.category_id} onChange={(e) => {
                        const cat = categories.find(c => c.id === e.target.value);
                        const next = [...editing.thali_groups];
                        next[idx] = { ...next[idx], category_id: e.target.value, label: g.label || (cat?.name || "") };
                        setEditing({ ...editing, thali_groups: next });
                      }} className="col-span-5 bg-white border border-border rounded-md px-2 py-1.5 text-sm">
                        <option value="">Pick category…</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <Input className="col-span-4 h-8" placeholder="Label (e.g. Sabji)" value={g.label}
                        onChange={(e) => {
                          const next = [...editing.thali_groups];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setEditing({ ...editing, thali_groups: next });
                        }} />
                      <Input type="number" min="1" className="col-span-2 h-8 text-center" value={g.count}
                        onChange={(e) => {
                          const next = [...editing.thali_groups];
                          next[idx] = { ...next[idx], count: Math.max(1, Number(e.target.value) || 1) };
                          setEditing({ ...editing, thali_groups: next });
                        }} />
                      <button onClick={() => {
                        const next = editing.thali_groups.filter((_, i) => i !== idx);
                        setEditing({ ...editing, thali_groups: next });
                      }} className="col-span-1 text-destructive hover:bg-destructive/10 p-1.5 rounded-md justify-self-center"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {(editing.thali_groups || []).length === 0 && (
                    <div className="text-xs text-muted-foreground">No rules yet. E.g. <i>Pick 2 from Sabji, 1 from Dal</i>.</div>
                  )}
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Fixed inclusions (text)</label>
                    <Input value={editing.thali_extras} onChange={(e) => setEditing({ ...editing, thali_extras: e.target.value })}
                      placeholder="e.g. Roti (4), Rice, Salad, Papad, Buttermilk" data-testid="thali-extras" />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} className="border-border">Cancel</Button>
              <Button onClick={save} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="save-item-btn">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
