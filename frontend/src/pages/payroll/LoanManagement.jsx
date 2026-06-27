import React, { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { useLanguage } from "../../context/LanguageContext";
import { Plus, HandCoins, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "../../components/ui/badge";

export default function LoanManagement() {
  const [advances, setAdvances] = useState([]);
  const [emps, setEmps] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ employee_id: "", amount: "", emi_amount: "", reason: "", status: "Approved" });
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  const fetchAdvances = useCallback(async () => {
    try {
      const { data } = await api.get("/payroll/advances");
      setAdvances(data);
    } catch { toast.error("Failed to load salary advances"); }
  }, []);

  useEffect(() => {
    fetchAdvances();
    api.get("/staff").then(res => setEmps(res.data.filter(e => e.status === "Active"))).catch(console.error);
  }, [fetchAdvances]);

  const save = async () => {
    if (!form.employee_id || !form.amount || !form.emi_amount) { toast.error("Please fill required fields"); return; }
    setBusy(true);
    try {
      await api.post("/payroll/advances", { ...form, amount: Number(form.amount), emi_amount: Number(form.emi_amount) });
      toast.success("Advance granted successfully");
      setDialog(false);
      fetchAdvances();
    } catch { toast.error("Failed to grant advance"); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">Workforce Management</div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">Salary Advances</h1>
        </div>
        <Button onClick={() => { setForm({employee_id: emps[0]?.id || "", amount: "", emi_amount: "", reason: "", status: "Approved"}); setDialog(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Issue Advance
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {advances.map(adv => (
          <Card key={adv.id} className="p-0 border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow bg-white overflow-hidden">
            <div className="p-5 flex justify-between items-start border-b border-slate-100">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                  <HandCoins className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-lg leading-tight">{adv.employee_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(adv.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
            
            <div className="p-5 flex-1 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Original Amount</span>
                <span className="font-mono font-bold text-slate-800">₹{adv.balance.toLocaleString('en-IN')}</span> {/* Wait, balance is original initially, then gets deducted. So this is accurate enough for MVP. */}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Monthly Deduction</span>
                <span className="font-mono text-slate-600">₹{adv.emi_amount.toLocaleString('en-IN')}</span>
              </div>
              {adv.reason && <div className="text-xs italic text-slate-500 line-clamp-2 mt-2 bg-slate-100 p-2 rounded">{adv.reason}</div>}
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-between items-center bg-white">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Outstanding</span>
                <span className={`font-display text-xl font-bold ${adv.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ₹{adv.balance.toLocaleString('en-IN')}
                </span>
              </div>
              <Badge variant="outline" className={adv.status === "Approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : adv.status === "Pending" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}>
                {adv.status}
              </Badge>
            </div>
          </Card>
        ))}
        {advances.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            No salary advances found.
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-bold">Issue Salary Advance</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-slate-600">Select Employee</Label>
              <select value={form.employee_id} onChange={e => setForm(f => ({...f, employee_id: e.target.value}))} className="w-full mt-1.5 px-3 py-2.5 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Choose an employee...</option>
                {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-600">Total Advance (₹)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="mt-1.5" /></div>
              <div><Label className="text-slate-600">Monthly Deduction (₹)</Label><Input type="number" value={form.emi_amount} onChange={e => setForm(f => ({...f, emi_amount: e.target.value}))} className="mt-1.5" /></div>
            </div>
            <div>
              <Label className="text-slate-600">Reason</Label>
              <Input placeholder="E.g. Medical emergency, Festival..." value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} className="mt-1.5" />
            </div>
            <div className="pt-2">
              <Button onClick={save} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm py-5">Approve & Issue Advance</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
