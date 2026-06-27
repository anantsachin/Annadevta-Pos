import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import api from "../../lib/api";
import { toast } from "sonner";

export default function EmployeeDetailsDrawer({ employee, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState("Profile");
  const [form, setForm] = useState({ ...employee });
  const [busy, setBusy] = useState(false);

  const tabs = ["Profile", "Attendance", "Advances", "Leaves", "Loans", "Bonuses", "Salary History", "Documents"];

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/staff/${employee.id}`, form);
      toast.success("Profile updated!");
      onUpdate();
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-sand-subtle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-terracotta text-white flex items-center justify-center font-bold text-xl uppercase">
              {employee.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold font-display">{employee.name}</h2>
              <p className="text-sm text-muted-foreground">{employee.designation || employee.role} • {employee.department || "No Department"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-border px-4 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-terracotta text-terracotta" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "Profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Login Email</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} required type="email" />
                </div>
                <div>
                  <Label>System Role</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                    value={form.role}
                    onChange={e => setForm({...form, role: e.target.value})}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <Label>Mobile Number</Label>
                  <Input value={form.mobile_number || ""} onChange={e => setForm({...form, mobile_number: e.target.value})} />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={form.designation || ""} onChange={e => setForm({...form, designation: e.target.value})} />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input value={form.department || ""} onChange={e => setForm({...form, department: e.target.value})} />
                </div>
                <div>
                  <Label>Joining Date</Label>
                  <Input type="date" value={form.joining_date || ""} onChange={e => setForm({...form, joining_date: e.target.value})} />
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                    value={form.employment_type || "Full-Time"}
                    onChange={e => setForm({...form, employment_type: e.target.value})}
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold mb-4 text-lg">Bank Details & KYC</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={form.bank_name || ""} onChange={e => setForm({...form, bank_name: e.target.value})} />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input value={form.bank_account || ""} onChange={e => setForm({...form, bank_account: e.target.value})} />
                  </div>
                  <div>
                    <Label>IFSC Code</Label>
                    <Input value={form.ifsc_code || ""} onChange={e => setForm({...form, ifsc_code: e.target.value})} />
                  </div>
                  <div>
                    <Label>PAN / Aadhaar</Label>
                    <Input value={form.pan_number || ""} onChange={e => setForm({...form, pan_number: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold mb-4 text-lg">Other Details</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Emergency Contact</Label>
                    <Input value={form.emergency_contact || ""} onChange={e => setForm({...form, emergency_contact: e.target.value})} />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={busy} className="bg-terracotta text-white">
                  Save Changes
                </Button>
              </div>
            </form>
          )}

          {activeTab !== "Profile" && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-sand rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl text-terracotta/50">🚧</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Under Construction</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                The {activeTab} module for {employee.name} is currently being developed and will be available soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
