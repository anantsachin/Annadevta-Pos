import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const COLORS = {
  free: "bg-white border-border",
  occupied: "bg-terracotta-light border-terracotta",
  reserved: "bg-forest-light border-forest",
};

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(4);

  const refresh = () => api.get("/tables").then(r => setTables(r.data));

  useEffect(() => { refresh(); }, []);

  const addTable = async () => {
    if (!number) return toast.error("Table number required");
    await api.post("/tables", { number, capacity: Number(capacity) });
    setNumber("");
    refresh();
  };

  const setStatus = async (t, status) => {
    await api.patch(`/tables/${t.id}/status`, { status });
    refresh();
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Floor plan</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Tables</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Table #" value={number} onChange={(e) => setNumber(e.target.value)} className="w-28" data-testid="table-number" />
          <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-24" data-testid="table-capacity" />
          <Button onClick={addTable} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="add-table-btn"><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="tables-grid">
        {tables.map(t => (
          <Card key={t.id} className={`p-4 border-2 ${COLORS[t.status]} shadow-none transition-all`} data-testid={`table-${t.id}`}>
            <div className="flex items-start justify-between">
              <div className="font-display text-2xl font-extrabold tracking-tight">{t.number}</div>
              <div className="text-[10px] uppercase tracking-wider font-medium">{t.status}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Seats {t.capacity}</div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              <button onClick={() => setStatus(t, "free")} className="text-[10px] py-1 rounded-md border border-border hover:bg-white" data-testid={`table-free-${t.id}`}>Free</button>
              <button onClick={() => setStatus(t, "occupied")} className="text-[10px] py-1 rounded-md border border-border hover:bg-white" data-testid={`table-occupied-${t.id}`}>Busy</button>
              <button onClick={() => setStatus(t, "reserved")} className="text-[10px] py-1 rounded-md border border-border hover:bg-white" data-testid={`table-reserved-${t.id}`}>Resv</button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-border bg-white" /> Free</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-terracotta bg-terracotta-light" /> Occupied</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-forest bg-forest-light" /> Reserved</span>
      </div>
    </div>
  );
}
