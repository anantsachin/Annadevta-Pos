import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["admin", "manager", "cashier", "kitchen"];

export default function Staff() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "cashier" });
  const refresh = () => api.get("/auth/staff").then(r => setList(r.data));
  useEffect(() => { refresh(); }, []);
  const add = async () => {
    if (!form.email || !form.password || !form.name) return toast.error("All fields required");
    try {
      await api.post("/auth/register", form);
      setForm({ name: "", email: "", password: "", role: "cashier" });
      toast.success("Staff added");
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const remove = async (u) => { await api.delete(`/auth/staff/${u.id}`); refresh(); };
  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Team</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Staff</h1>
      </div>
      <Card className="p-4 border-border shadow-none mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="staff-name" />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="staff-email" />
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="staff-password" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="bg-white border border-border rounded-md px-3 py-2 text-sm" data-testid="staff-role">
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <Button onClick={add} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="staff-add">Add staff</Button>
        </div>
      </Card>
      <Card className="border-border shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-subtle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody data-testid="staff-table">
            {list.map(u => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-md bg-sand-subtle border border-border capitalize">{u.role}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(u)} data-testid={`staff-del-${u.id}`} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
