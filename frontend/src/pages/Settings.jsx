import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Save, Store, Receipt, Sliders, Eye } from "lucide-react";
import { toast } from "sonner";
import ReceiptPreview from "../components/ReceiptPreview";

export default function Settings() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.get("/settings").then((r) => { if (mounted) setS(r.data); });
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: s.name,
        address: s.address,
        gstin: s.gstin,
        phone: s.phone,
        gst_rate: Number(s.gst_rate) || 0,
        footer_msg: s.footer_msg || "",
        show_gst: !!s.show_gst,
        show_payment: !!s.show_payment,
        show_thali_selections: !!s.show_thali_selections,
        paper_width: Number(s.paper_width) || 80,
        font_size: s.font_size || "medium",
        header_alignment: s.header_alignment || "center",
        header_template: s.header_template || "classic",
        auto_print: !!s.auto_print,
        receipt_prefix: s.receipt_prefix || "",
        receipt_padding: Number(s.receipt_padding) || 6,
        tax_label: s.tax_label || "GST",
      };
      const { data } = await api.put("/settings", payload);
      setS(data);
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  if (!s) return <div className="p-10 text-muted-foreground">Loading…</div>;

  // Mock order for Settings Preview
  const mockOrder = {
    receipt_no: 17,
    created_at: new Date("2026-06-22T01:20:00").toISOString(),
    cashier_name: "Owner",
    items: [
      {
        menu_item_id: "mock-1",
        name: "Regular Thali",
        price: 150,
        qty: 1,
        is_thali: true,
        thali_selections: {
          "Sabji": ["Paneer Masala", "Mix Veg"],
          "Dal": ["Dal Tadka"]
        }
      },
      {
        menu_item_id: "mock-2",
        name: "Buttermilk",
        price: 30,
        qty: 2,
        is_thali: false
      }
    ],
    subtotal: 210,
    tax: (210 * (s.gst_rate ?? 5.0)) / 100,
    discount: 0,
    total: 210 + (s.show_gst !== false ? (210 * (s.gst_rate ?? 5.0)) / 100 : 0),
    payment_mode: "card"
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Configuration</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Store className="w-7 h-7 text-terracotta" /> Restaurant & Receipt Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your profile, paper properties, and customize how customers see printouts.</p>
        </div>
        <Button onClick={save} disabled={busy} className="bg-terracotta hover:bg-terracotta-hover text-white md:self-end" data-testid="save-settings-btn">
          <Save className="w-4 h-4 mr-2" /> Save settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Restaurant Profile */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Store className="w-4 h-4" /> Restaurant Profile
            </h2>
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
          </Card>

          {/* Section 2: Receipt Formatting */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Sliders className="w-4 h-4" /> Receipt Format Styles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Header Alignment</label>
                <select
                  value={s.header_alignment}
                  onChange={(e) => setS({ ...s, header_alignment: e.target.value })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="center">Center Header</option>
                  <option value="left">Left Header</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Header Template</label>
                <select
                  value={s.header_template}
                  onChange={(e) => setS({ ...s, header_template: e.target.value })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="classic">Classic (Name, Address, Phone, GSTIN)</option>
                  <option value="compact">Compact (Name, Phone)</option>
                  <option value="modern">Modern (Styled Logo, Name, Address)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Paper Width</label>
                <select
                  value={s.paper_width}
                  onChange={(e) => setS({ ...s, paper_width: Number(e.target.value) })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="80">80mm (3-inch)</option>
                  <option value="58">58mm (2-inch)</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Font Size</label>
                <select
                  value={s.font_size}
                  onChange={(e) => setS({ ...s, font_size: e.target.value })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tax Label</label>
                <Input value={s.tax_label} onChange={(e) => setS({ ...s, tax_label: e.target.value })} className="mt-1" placeholder="GST" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Default Tax / GST %</label>
                <Input type="number" value={s.gst_rate} onChange={(e) => setS({ ...s, gst_rate: e.target.value })} className="mt-1" data-testid="set-gst-rate" />
                <div className="text-[10px] text-muted-foreground mt-1">Default percentage applied to menu items.</div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Footer Message</label>
                <Input value={s.footer_msg} onChange={(e) => setS({ ...s, footer_msg: e.target.value })} className="mt-1" data-testid="set-footer" />
              </div>
            </div>
          </Card>

          {/* Section 3: Receipt Number Format */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Receipt Numbering
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Receipt Prefix</label>
                <Input value={s.receipt_prefix} onChange={(e) => setS({ ...s, receipt_prefix: e.target.value })} className="mt-1 font-mono" placeholder="ANP-" />
                <div className="text-[10px] text-muted-foreground mt-1">Example: Prefix 'ANP-' results in 'ANP-000001'.</div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Receipt Padding (Digits)</label>
                <Input type="number" value={s.receipt_padding} onChange={(e) => setS({ ...s, receipt_padding: e.target.value })} className="mt-1 font-mono" placeholder="6" />
                <div className="text-[10px] text-muted-foreground mt-1">Number of digits for numeric component.</div>
              </div>
            </div>
          </Card>

          {/* Section 4: Toggles & Features */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Template Features & Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all">
                <input
                  type="checkbox"
                  checked={s.show_gst}
                  onChange={(e) => setS({ ...s, show_gst: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">Show Tax Breakdown</div>
                  <div className="text-[9px] text-muted-foreground">Print subtotal & tax row details.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all">
                <input
                  type="checkbox"
                  checked={s.show_payment}
                  onChange={(e) => setS({ ...s, show_payment: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">Show Payment Method</div>
                  <div className="text-[9px] text-muted-foreground">Display if billed via cash/upi/card.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all">
                <input
                  type="checkbox"
                  checked={s.show_thali_selections}
                  onChange={(e) => setS({ ...s, show_thali_selections: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">Show Thali Selections</div>
                  <div className="text-[9px] text-muted-foreground">Print detailed thali selections.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all sm:col-span-3">
                <input
                  type="checkbox"
                  checked={s.auto_print}
                  onChange={(e) => setS({ ...s, auto_print: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-sm font-bold text-foreground">Auto Print Receipt</div>
                  <div className="text-[10px] text-muted-foreground">Trigger browser print dialog automatically after checkouts.</div>
                </div>
              </label>
            </div>
          </Card>
        </div>

        {/* Right Side: Interactive Thermal Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Eye className="w-4 h-4" /> Thermal Print Preview ({s.paper_width}mm)
          </div>

          <div className="w-full max-w-sm flex justify-center bg-neutral-50 p-6 rounded-md shadow-inner border border-border overflow-hidden">
            <ReceiptPreview order={mockOrder} settings={s} />
          </div>
        </div>
      </div>
    </div>
  );
}


