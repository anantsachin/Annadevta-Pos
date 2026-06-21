import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Save, Store } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings").then(r => setS(r.data)); }, []);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: s.name, address: s.address, gstin: s.gstin, phone: s.phone,
        gst_rate: Number(s.gst_rate) || 0, footer_msg: s.footer_msg || "",
      };
      const { data } = await api.put("/settings", payload);
      setS(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  if (!s) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Configuration</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Store className="w-7 h-7 text-terracotta" /> Restaurant Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">These details appear on every printed receipt.</p>
      </div>

      <Card className="p-6 border-border shadow-none space-y-4" data-testid="settings-form">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Restaurant name</label>
          <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className="mt-1" data-testid="set-name" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Address</label>
          <Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} className="mt-1" data-testid="set-address" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">GSTIN</label>
            <Input value={s.gstin} onChange={(e) => setS({ ...s, gstin: e.target.value })} className="mt-1 font-mono" placeholder="29ABCDE1234F1Z5" data-testid="set-gstin" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</label>
            <Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} className="mt-1" data-testid="set-phone" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Default GST %</label>
            <Input type="number" value={s.gst_rate} onChange={(e) => setS({ ...s, gst_rate: e.target.value })} className="mt-1" data-testid="set-gst-rate" />
            <div className="text-[11px] text-muted-foreground mt-1">Used as the default for new menu items.</div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Receipt footer message</label>
            <Input value={s.footer_msg} onChange={(e) => setS({ ...s, footer_msg: e.target.value })} className="mt-1" data-testid="set-footer" />
          </div>
        </div>
        <div className="pt-3 border-t border-border flex justify-end">
          <Button onClick={save} disabled={busy} className="bg-terracotta hover:bg-terracotta-hover text-white" data-testid="save-settings-btn">
            <Save className="w-4 h-4 mr-2" /> Save settings
          </Button>
        </div>
      </Card>

      <div className="mt-8 text-xs text-muted-foreground">
        <div className="font-semibold mb-2 uppercase tracking-wider text-[10px]">Preview</div>
        <Card className="p-5 border-border shadow-none font-mono text-center">
          <div className="font-bold text-base">{s.name}</div>
          <div>{s.address}</div>
          {s.phone && <div>Ph: {s.phone}</div>}
          {s.gstin && <div>GSTIN: {s.gstin}</div>}
          <div className="my-2 border-t border-dashed border-border" />
          <div className="text-left text-xs">
            Receipt #1042<br />
            01/02/2026 13:42
          </div>
          <div className="my-2 border-t border-dashed border-border" />
          <div>{s.footer_msg}</div>
        </Card>
      </div>
    </div>
  );
}
