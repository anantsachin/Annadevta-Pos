import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Users, Trash2, Plus, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import EmployeeDetailsDrawer from "./payroll/EmployeeDetailsDrawer";

export default function StaffManager() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "cashier" });

  const fetchStaff = async () => {
    try {
      const { data } = await api.get("/staff");
      setStaff(data);
    } catch (e) {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (editId && staff.length > 0) {
      const target = staff.find(s => s.id === editId);
      if (target) setSelectedStaff(target);
    }
  }, [editId, staff]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      await api.post("/staff", form);
      toast.success("Staff account created successfully!");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "cashier" });
      fetchStaff();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create staff account");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;
    try {
      await api.delete(`/staff/${id}`);
      toast.success("Staff deleted");
      fetchStaff();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to delete");
    }
  };

  return (
    <Card className="p-6 mt-8 border-border">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-terracotta" />
          <h2 className="text-xl font-bold font-display">Team Directory</h2>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-terracotta hover:bg-terracotta-hover text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-4">
              <div>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Rahul Kumar" />
              </div>
              <div>
                <Label>Login Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="cashier@example.com" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="At least 8 characters" />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={busy} className="bg-terracotta text-white">
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-4 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : staff.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground bg-sand-subtle rounded-md">
          No employees found. Add your first employee above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-sand border-y border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-sand/30 cursor-pointer" onClick={() => setSelectedStaff(u)}>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center font-bold text-xs uppercase overflow-hidden border border-border">
                        {u.photo ? (
                          <img src={u.photo} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-forest/10 text-forest capitalize">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.department || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.status === "Active" ? "bg-forest/10 text-forest" : "bg-red-100 text-red-800"}`}>
                      {u.status || "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedStaff(u)} className="h-8 w-8 text-slate-600 hover:bg-slate-100" title="Edit Profile Details">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete Account">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedStaff && (
        <EmployeeDetailsDrawer 
          employee={selectedStaff} 
          onClose={() => setSelectedStaff(null)} 
          onUpdate={() => {
            fetchStaff();
            setSelectedStaff(null);
          }} 
        />
      )}
    </Card>
  );
}
