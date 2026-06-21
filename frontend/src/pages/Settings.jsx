import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Save, Store, Receipt, Printer, Eye, Sliders } from "lucide-react";
import { toast } from "sonner";

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
        show_barcode: !!s.show_barcode,
        show_thali_selections: !!s.show_thali_selections,
        paper_width: s.paper_width || "80mm",
        font_size: s.font_size || "medium",
        header_alignment: s.header_alignment || "center",
        auto_print: !!s.auto_print,
      };
      const { data } = await api.put("/settings", payload);
      setS(data);
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  if (!s) return <div className="p-10 text-muted-foreground">Loading…</div>;

  // Font sizing style mapping for the preview
  const previewFontClass = 
    s.font_size === "small" ? "text-[10px]" : 
    s.font_size === "large" ? "text-sm" : "text-xs";

  // Width container mapping for the preview
  const previewWidthClass = s.paper_width === "58mm" ? "w-[220px]" : "w-[290px]";

  // Text alignment helper for header details
  const headerAlignClass = s.header_alignment === "left" ? "text-left" : "text-center";

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Paper Width</label>
                <select
                  value={s.paper_width}
                  onChange={(e) => setS({ ...s, paper_width: e.target.value })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="80mm">80mm (3-inch)</option>
                  <option value="58mm">58mm (2-inch)</option>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Header Alignment</label>
                <select
                  value={s.header_alignment}
                  onChange={(e) => setS({ ...s, header_alignment: e.target.value })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Default GST %</label>
                <Input type="number" value={s.gst_rate} onChange={(e) => setS({ ...s, gst_rate: e.target.value })} className="mt-1" data-testid="set-gst-rate" />
                <div className="text-[10px] text-muted-foreground mt-1">Default percentage applied to menu items.</div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Footer Message</label>
                <Input value={s.footer_msg} onChange={(e) => setS({ ...s, footer_msg: e.target.value })} className="mt-1" data-testid="set-footer" />
              </div>
            </div>
          </Card>

          {/* Section 3: Toggles & Features */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Template Features & Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all">
                <input
                  type="checkbox"
                  checked={s.show_gst}
                  onChange={(e) => setS({ ...s, show_gst: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-sm font-bold text-foreground">Show GST Breakdown</div>
                  <div className="text-[10px] text-muted-foreground">Print subtotal & tax row details.</div>
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
                  <div className="text-sm font-bold text-foreground">Show Payment Method</div>
                  <div className="text-[10px] text-muted-foreground">Display if billed via cash/upi/card.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all">
                <input
                  type="checkbox"
                  checked={s.show_barcode}
                  onChange={(e) => setS({ ...s, show_barcode: e.target.checked })}
                  className="w-4 h-4 rounded text-terracotta border-border focus:ring-terracotta"
                />
                <div>
                  <div className="text-sm font-bold text-foreground">Print Barcode</div>
                  <div className="text-[10px] text-muted-foreground">Print scan barcode at base of ticket.</div>
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
                  <div className="text-sm font-bold text-foreground">Show Thali Selections</div>
                  <div className="text-[10px] text-muted-foreground">Print detailed customization selections.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none border border-border rounded-md p-3 hover:bg-sand-subtle transition-all sm:col-span-2">
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
            <Eye className="w-4 h-4" /> Thermal Print Preview ({s.paper_width})
          </div>

          <div className="w-full max-w-sm flex justify-center bg-[#eae8e4] p-6 rounded-md shadow-inner border border-sand-dark/15 overflow-hidden">
            {/* The paper roll strip container */}
            <div className={`bg-[#fdfbf7] p-5 shadow-[0px_4px_10px_rgba(0,0,0,0.15)] border-y border-dashed border-[#e6e4de] font-mono leading-relaxed text-[#1a1a1a] transition-all duration-300 ${previewFontClass} ${previewWidthClass}`}>
              
              {/* Header details */}
              <div className={headerAlignClass}>
                <div className="font-bold text-sm tracking-wide mb-1 uppercase whitespace-pre-wrap">{s.name || "Annapurna Thali House"}</div>
                {s.address && <div className="text-[10px] text-[#444] whitespace-pre-wrap mb-0.5">{s.address}</div>}
                {s.phone && <div className="text-[10px] text-[#444] mb-0.5">PH: {s.phone}</div>}
                {s.gstin && <div className="text-[10px] text-[#444]">GSTIN: {s.gstin}</div>}
              </div>

              <div className="my-2 border-t border-double border-black" />

              {/* Metadata */}
              <div className="space-y-0.5 text-[10px] text-[#333]">
                <div>Receipt #: 000017</div>
                <div>Date: 22/06/2026</div>
                <div>Time: 01:20 AM</div>
                <div>Cashier: Owner</div>
              </div>

              <div className="my-2 border-t border-dashed border-black" />
              <div className="text-center font-bold tracking-widest text-[10px] mb-1">ITEMS</div>
              <div className="my-1 border-t border-dashed border-black" />

              {/* Items Block */}
              <div className="space-y-2">
                <div>
                  <div className="font-bold text-left">Regular Thali</div>
                  <div className="flex justify-between text-[11px] text-[#222]">
                    <span>1 x Rs.150.00</span>
                    <span className="font-bold">Rs.150.00</span>
                  </div>
                  {s.show_thali_selections && (
                    <div className="text-[9px] text-[#555] pl-2 italic">
                      + Paneer Masala, Mix Veg<br/>
                      + Dal Tadka
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-bold text-left">Buttermilk</div>
                  <div className="flex justify-between text-[11px] text-[#222]">
                    <span>2 x Rs.30.00</span>
                    <span className="font-bold">Rs.60.00</span>
                  </div>
                </div>
              </div>

              <div className="my-2 border-t border-dashed border-black" />

              {/* Summary Block */}
              <div className="space-y-0.5 text-[#333]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs.210.00</span>
                </div>
                {s.show_gst && (
                  <div className="flex justify-between">
                    <span>GST ({s.gst_rate}%)</span>
                    <span>Rs.{((210 * s.gst_rate) / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="my-2 border-t border-dashed border-black" />
              
              <div className="flex justify-between font-extrabold text-sm py-0.5">
                <span>TOTAL</span>
                <span>Rs.{s.show_gst ? (210 + (210 * s.gst_rate) / 100).toFixed(2) : "210.00"}</span>
              </div>
              
              <div className="my-2 border-t border-dashed border-black" />

              {/* Payment Details */}
              {s.show_payment && (
                <div className="font-bold text-[10px] uppercase">
                  Payment Method : CARD
                </div>
              )}

              <div className="my-2 border-t border-double border-black" />

              {/* Footer */}
              <div className="text-center font-bold uppercase text-[10px] space-y-0.5">
                <div>{s.footer_msg || "THANK YOU"}</div>
                <div>VISIT AGAIN</div>
              </div>

              <div className="my-2 border-t border-double border-black" />
              <div className="text-center text-[9px] text-[#555]">22/06/2026 01:20 AM</div>

              {/* Barcode Option */}
              {s.show_barcode && (
                <div className="flex flex-col items-center mt-3 opacity-90">
                  <svg className="w-full max-w-[150px] h-9" viewBox="0 0 100 24">
                    {Array.from({ length: 28 }).map((_, idx) => {
                      const width = (idx * 7) % 3 === 0 ? 3 : (idx * 5) % 2 === 0 ? 1 : 2;
                      const space = (idx * 11) % 4 === 0 ? 2 : 1;
                      const startX = idx * 3.2;
                      if (startX >= 90) return null;
                      return <rect key={idx} x={startX} y="0" width={width * 0.55} height="19" fill="currentColor" />;
                    })}
                    <text x="50" y="24" fontSize="4.5" textAnchor="middle" fill="currentColor" letterSpacing="1">000017</text>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

