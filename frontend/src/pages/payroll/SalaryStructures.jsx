import React, { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { useLanguage } from "../../context/LanguageContext";

export default function SalaryStructures() {
  const [emps, setEmps] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  const fetchEmps = useCallback(async () => {
    try {
      const { data } = await api.get("/staff");
      setEmps(data);
      if (data.length > 0) selectEmp(data[0]);
    } catch { toast.error("Failed to load employees"); }
  }, []);

  useEffect(() => { fetchEmps(); }, [fetchEmps]);

  const selectEmp = async (emp) => {
    setSelectedEmp(emp);
    try {
      const { data } = await api.get(`/payroll/employees/${emp.id}/structure`);
      setForm(data);
    } catch { toast.error("Failed to load structure"); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/payroll/employees/${selectedEmp.id}/structure`, form);
      toast.success("Salary structure updated");
    } catch { toast.error("Failed to update structure"); }
    finally { setBusy(false); }
  };

  if (!emps.length) return <div className="p-6">No employees found. Please add an employee first.</div>;

  return (
    <div className="p-6 lg:p-10 max-w-6xl flex gap-6">
      <div className="w-1/3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t("payroll_module") || "HR & Payroll"}</div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight mb-4">Salary Structures</h1>
        <div className="space-y-2 overflow-y-auto max-h-[70vh] pr-2">
          {emps.map(e => (
            <button key={e.id} onClick={() => selectEmp(e)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${selectedEmp?.id === e.id ? "bg-sand-subtle border-terracotta" : "bg-white border-border hover:border-terracotta"}`}>
              <div className="font-semibold text-sm">{e.name}</div>
              <div className="text-xs text-muted-foreground">{e.designation}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1">
        {form && (
          <Card className="p-6 border-border shadow-none">
            <h2 className="font-display text-xl font-bold mb-4">Structure for {selectedEmp?.full_name}</h2>
            <div className="mb-4">
              <Label>Wage Type</Label>
              <select value={form.wage_type} onChange={e => setForm(f => ({...f, wage_type: e.target.value}))} className="w-full max-w-xs mt-1 px-3 py-2 rounded-md border border-border bg-white text-sm">
                <option value="Fixed">Fixed Monthly Salary</option>
                <option value="Hourly">Hourly Wage</option>
              </select>
            </div>

            {form.wage_type === "Fixed" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Basic Salary (₹)</Label><Input type="number" value={form.basic_salary} onChange={e => setForm(f => ({...f, basic_salary: Number(e.target.value)}))} /></div>
                  <div><Label>House Rent Allowance (HRA)</Label><Input type="number" value={form.hra} onChange={e => setForm(f => ({...f, hra: Number(e.target.value)}))} /></div>
                  <div><Label>Conveyance</Label><Input type="number" value={form.conveyance} onChange={e => setForm(f => ({...f, conveyance: Number(e.target.value)}))} /></div>
                  <div><Label>Medical</Label><Input type="number" value={form.medical} onChange={e => setForm(f => ({...f, medical: Number(e.target.value)}))} /></div>
                  <div><Label>Special Allowance</Label><Input type="number" value={form.special_allowance} onChange={e => setForm(f => ({...f, special_allowance: Number(e.target.value)}))} /></div>
                </div>
                <div className="pt-4 border-t border-border"><Label className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Statutory Deductions</Label></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>PF Deduction</Label><Input type="number" value={form.pf_deduction} onChange={e => setForm(f => ({...f, pf_deduction: Number(e.target.value)}))} /></div>
                  <div><Label>ESI Deduction</Label><Input type="number" value={form.esi_deduction} onChange={e => setForm(f => ({...f, esi_deduction: Number(e.target.value)}))} /></div>
                  <div><Label>Professional Tax</Label><Input type="number" value={form.professional_tax} onChange={e => setForm(f => ({...f, professional_tax: Number(e.target.value)}))} /></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Hourly Rate (₹/hr)</Label><Input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({...f, hourly_rate: Number(e.target.value)}))} /></div>
              </div>
            )}
            
            <div className="mt-6">
              <Button onClick={save} disabled={busy} className="bg-terracotta hover:bg-terracotta-hover text-white">Save Salary Structure</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
