import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const refresh = () => api.get("/customers").then(r => setList(r.data));
  useEffect(() => { refresh(); }, []);
  const add = async () => {
    if (!form.name || !form.phone) return toast.error("Name & phone required");
    await api.post("/customers", form);
    setForm({ name: "", phone: "", email: "" }); refresh();
  };
  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">CRM</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Customers</h1>
      </div>
      <Card className="p-4 border-border shadow-none mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cust-name-input" />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="cust-phone-input" />
          <Input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="cust-email-input" />
          <Button onClick={add} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="cust-add"><Plus className="w-4 h-4 mr-1" />Add customer</Button>
        </div>
      </Card>
      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-right px-4 py-3">Orders</th>
              <th className="text-right px-4 py-3">Points</th>
            </tr>
          </thead>
          <tbody data-testid="cust-table">
            {list.map(c => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3 text-right font-mono">{c.total_orders || 0}</td>
                <td className="px-4 py-3 text-right font-mono text-terracotta">{c.loyalty_points || 0}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="4" className="text-center text-muted-foreground py-8">No customers yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
