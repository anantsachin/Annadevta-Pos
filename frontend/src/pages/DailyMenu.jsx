import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Save, Trash2, Play, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export default function DailyMenu() {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");

  const refresh = async () => {
    const [m, c, t] = await Promise.all([
      api.get("/menu"),
      api.get("/categories"),
      api.get("/templates"),
    ]);
    setMenu(m.data); setCategories(c.data); setTemplates(t.data);
  };
  useEffect(() => { refresh(); }, []);

  const grouped = useMemo(() => {
    const byCat = {};
    for (const c of categories) byCat[c.id] = { ...c, items: [] };
    for (const m of menu) {
      if (byCat[m.category_id]) byCat[m.category_id].items.push(m);
    }
    return Object.values(byCat).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [menu, categories]);

  const toggle = async (m) => {
    await api.patch(`/menu/${m.id}/toggle`);
    setMenu((prev) => prev.map((x) => x.id === m.id ? { ...x, available: !x.available } : x));
  };

  const setAllInCategory = async (catItems, value) => {
    await Promise.all(catItems.filter(i => i.available !== value).map(i => api.patch(`/menu/${i.id}/toggle`)));
    refresh();
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return toast.error("Name required");
    const active = menu.filter(m => m.available).map(m => m.id);
    await api.post("/templates", { name: templateName, item_ids: active });
    toast.success(`Saved template "${templateName}"`);
    setTemplateName("");
    refresh();
  };

  const activate = async (t) => {
    if (!window.confirm(`Are you sure?\n\nActivate "${t.name}"?\n\nCurrent active menu will be replaced.`)) return;
    await api.post(`/templates/${t.id}/activate`);
    toast.success(`Activated "${t.name}" — ${t.item_ids.length} items live`);
    refresh();
  };

  const removeTemplate = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    await api.delete(`/templates/${t.id}`);
    refresh();
  };

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" });
  const activeCount = menu.filter(m => m.available).length;

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{today}</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-terracotta" /> Daily Menu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle what&apos;s available today. <span className="text-foreground font-semibold">{activeCount}</span> items live on the counter.
          </p>
        </div>
      </div>

      <Card className="p-4 border-border shadow-none mb-6 bg-terracotta/5 border-terracotta/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold">Save current selection as a template</div>
            <div className="text-xs text-muted-foreground mt-1">e.g. <i>Monday menu</i>, <i>Tuesday menu</i>, <i>Festival special</i></div>
          </div>
          <div className="flex gap-2">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name" className="w-56 bg-white" data-testid="template-name" />
            <Button onClick={saveTemplate} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="save-template-btn">
              <Save className="w-4 h-4 mr-2" /> Save template
            </Button>
          </div>
        </div>

        {templates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-terracotta/20">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">Saved templates</div>
            <div className="flex flex-wrap gap-2" data-testid="templates-list">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-1 bg-white border border-border rounded-md pl-3 pr-1 py-1" data-testid={`template-${t.id}`}>
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">({t.item_ids.length})</span>
                  <button onClick={() => activate(t)} className="p-1 ml-1 text-forest hover:bg-forest/10 rounded-md" title="Activate" data-testid={`activate-${t.id}`}><Play className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeTemplate(t)} className="p-1 text-muted-foreground hover:text-destructive rounded-md" title="Delete" data-testid={`del-template-${t.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {grouped.map((cat) => (
          <Card key={cat.id} className="border-border shadow-none" data-testid={`cat-section-${cat.id}`}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="font-display font-bold text-lg">{cat.name}</div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground font-mono">{cat.items.filter(i => i.available).length}/{cat.items.length} active</span>
                <button onClick={() => setAllInCategory(cat.items, true)} className="text-terracotta hover:underline" data-testid={`all-on-${cat.id}`}>All on</button>
                <button onClick={() => setAllInCategory(cat.items, false)} className="text-muted-foreground hover:underline" data-testid={`all-off-${cat.id}`}>All off</button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {cat.items.length === 0 && <div className="text-xs text-muted-foreground col-span-full p-4 text-center">No items in this category.</div>}
              {cat.items.map(m => (
                <label key={m.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-md border transition-all cursor-pointer ${
                    m.available ? "border-terracotta/40 bg-terracotta/5" : "border-border bg-white"
                  }`}
                  data-testid={`daily-item-${m.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-1.5 truncate">
                      {m.is_thali && <span className="text-[9px] uppercase tracking-[0.18em] font-bold bg-terracotta text-white px-1.5 py-0.5 rounded">Thali</span>}
                      {m.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">₹{m.price}</div>
                  </div>
                  <Switch checked={m.available} onCheckedChange={() => toggle(m)} data-testid={`daily-toggle-${m.id}`} />
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
