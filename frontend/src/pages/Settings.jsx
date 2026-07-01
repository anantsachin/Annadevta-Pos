import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Save, Store, Receipt, Sliders, Eye, Database, Download, Upload, AlertTriangle, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import ReceiptPreview from "../components/ReceiptPreview";
import { useLanguage } from "../context/LanguageContext";

export default function Settings() {
  const { t, changeLanguage } = useLanguage();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [testPrinting, setTestPrinting] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.get("/settings").then((r) => {
      if (mounted) {
        setS(r.data);
        if (r.data?.language && !localStorage.getItem("pos_language")) {
          changeLanguage(r.data.language);
        }
      }
    }).catch(console.error);
    // Load last backup timestamp from localStorage
    const lastBackupTime = localStorage.getItem("lastBackupTime");
    if (lastBackupTime && mounted) {
      setLastBackup(new Date(lastBackupTime));
    }
    // Load printers if in Electron
    if (window.electronAPI && window.electronAPI.printer && mounted) {
      window.electronAPI.printer.getPrinters().then(printerList => {
        if (mounted) setPrinters(printerList);
      }).catch(err => console.error('Failed to load printers:', err));
    }
    return () => { mounted = false; };
  }, [changeLanguage]);

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
        receipt_prefix: s.receipt_prefix ?? "",
        receipt_padding: Number(s.receipt_padding) || 6,
        tax_label: s.tax_label ?? "GST",
        language: s.language ?? "en",
        app_name: s.app_name ?? "Anndevta",
        app_tagline: s.app_tagline ?? "THALI BILLING COUNTER",
        default_printer: s.default_printer || null,
      };
      const { data } = await api.put("/settings", payload);
      console.log("Settings saved:", data);
      setS(data);
      if (data?.language) {
        changeLanguage(data.language);
      }
      
      // Notify other components (like Layout) that settings were updated
      console.log("Dispatching settingsUpdated event");
      window.dispatchEvent(new Event('settingsUpdated'));
      
      toast.success(t("settings_saved_success"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  const createBackup = async () => {
    setBackupBusy(true);
    try {
      const { data } = await api.post("/backup/create");
      
      // Create timestamped filename
      const now = new Date();
      const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `AnndevtaPOS_Backup_${timestamp}.json`;
      
      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Save backup timestamp
      localStorage.setItem("lastBackupTime", now.toISOString());
      setLastBackup(now);
      
      toast.success(`${t("backup_created")}: ${filename}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Backup failed");
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreBackup = async () => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Confirm before restore
      if (!window.confirm(t("confirm_restore"))) {
        return;
      }
      
      setRestoreBusy(true);
      try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        // Validate backup structure
        if (!backupData.collections || !backupData.timestamp) {
          throw new Error(t("invalid_backup_format"));
        }
        
        await api.post("/backup/restore", backupData);
        
        toast.success(t("backup_restored"));
        
        // Reload page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        
      } catch (e) {
        toast.error(e?.response?.data?.detail || e.message || "Restore failed");
        setRestoreBusy(false);
      }
    };
    
    input.click();
  };

  const handleTestPrint = async () => {
    if (!window.electronAPI || !window.electronAPI.printer) {
      toast.error("Printer API not available. Please run in Electron app.");
      return;
    }
    
    setTestPrinting(true);
    try {
      const printerName = s.default_printer || null;
      const paperWidth = Number(s.paper_width) || 80;
      const success = await window.electronAPI.printer.testPrint(printerName, paperWidth);
      
      if (success) {
        toast.success("Test print sent successfully!");
      } else {
        toast.error("Test print failed. Check printer connection.");
      }
    } catch (error) {
      toast.error("Test print error: " + error.message);
    } finally {
      setTestPrinting(false);
    }
  };

  const getBackupStatus = () => {
    if (!lastBackup) return { text: "No Backup Found", color: "text-destructive", showWarning: true };
    
    const daysSince = Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince >= 30) {
      return { text: "Backup Overdue", color: "text-destructive", showWarning: true };
    } else if (daysSince >= 7) {
      return { text: "Backup Recommended", color: "text-amber-600", showWarning: true };
    } else {
      return { text: lastBackup.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), color: "text-forest", showWarning: false };
    }
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
      {/* Professional Page Header */}
      <div className="mb-8 bg-gradient-to-r from-terracotta/10 via-amber-50 to-transparent border-l-4 border-terracotta rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-8 h-8 text-terracotta" />
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-terracotta font-semibold">Configuration</div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                  Restaurant & Receipt Settings
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Configure your profile, paper properties, and customize how customers see receipts.
            </p>
          </div>
          <Button onClick={save} disabled={busy} className="bg-terracotta hover:bg-terracotta-hover text-white shadow-md md:self-start" data-testid="save-settings-btn">
            <Save className="w-4 h-4 mr-2" /> {busy ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Restaurant Profile */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Store className="w-4 h-4" /> {t("restaurant_profile")}
            </h2>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("restaurant_name")}</label>
              <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className="mt-1" data-testid="set-name" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("address")}</label>
              <Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} className="mt-1" data-testid="set-address" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("gstin")}</label>
                <Input value={s.gstin} onChange={(e) => setS({ ...s, gstin: e.target.value })} className="mt-1 font-mono" placeholder="29ABCDE1234F1Z5" data-testid="set-gstin" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("phone")}</label>
                <Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} className="mt-1" data-testid="set-phone" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("language_select")}</label>
              <select
                value={s.language || "en"}
                onChange={(e) => {
                  const val = e.target.value;
                  setS({ ...s, language: val });
                  changeLanguage(val);
                }}
                className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                data-testid="set-language"
              >
                <option value="en">English</option>
                <option value="gu">ગુજરાતી</option>
                <option value="bilingual">ગુજરાતી + English</option>
              </select>
            </div>

            {/* Sidebar Branding */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Sidebar Branding</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">App Name</label>
                  <Input 
                    value={s.app_name ?? "Anndevta"} 
                    onChange={(e) => setS({ ...s, app_name: e.target.value })} 
                    className="mt-1" 
                    placeholder="Anndevta"
                    data-testid="set-app-name" 
                  />
                  <div className="text-[10px] text-muted-foreground mt-1">Displayed at the top of the sidebar</div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagline</label>
                  <Input 
                    value={s.app_tagline ?? "THALI BILLING COUNTER"} 
                    onChange={(e) => setS({ ...s, app_tagline: e.target.value })} 
                    className="mt-1" 
                    placeholder="THALI BILLING COUNTER"
                    data-testid="set-app-tagline" 
                  />
                  <div className="text-[10px] text-muted-foreground mt-1">Subtitle below the app name</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Section 2: Receipt Formatting */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Sliders className="w-4 h-4" /> {t("receipt_format_styles")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("header_alignment")}</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("header_template")}</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("paper_width")}</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Printer className="w-3 h-3" />
                  Default Printer
                </label>
                <select
                  value={s.default_printer || ""}
                  onChange={(e) => setS({ ...s, default_printer: e.target.value || null })}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                  disabled={printers.length === 0}
                >
                  <option value="">System Default</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.isDefault ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
                {printers.length === 0 && (
                  <div className="text-[10px] text-amber-600 mt-1">No printers found. Run in desktop app.</div>
                )}
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("font_size")}</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tax_label")}</label>
                <Input value={s.tax_label} onChange={(e) => setS({ ...s, tax_label: e.target.value })} className="mt-1" placeholder="GST" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("default_tax")}</label>
                <Input type="number" value={s.gst_rate} onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < 0) {
                    toast.error(t("gst_rate_negative_error"));
                    setS({ ...s, gst_rate: 0 });
                  } else if (val > 100) {
                    toast.error(t("gst_rate_max_error"));
                    setS({ ...s, gst_rate: 100 });
                  } else {
                    setS({ ...s, gst_rate: e.target.value });
                  }
                }} className="mt-1" data-testid="set-gst-rate" />
                <div className="text-[10px] text-muted-foreground mt-1">Default percentage applied to menu items.</div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("footer_message")}</label>
                <Input value={s.footer_msg} onChange={(e) => setS({ ...s, footer_msg: e.target.value })} className="mt-1" data-testid="set-footer" />
              </div>
            </div>
          </Card>

          {/* Section 3: Receipt Number Format */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Receipt className="w-4 h-4" /> {t("receipt_numbering")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("receipt_prefix")}</label>
                <Input value={s.receipt_prefix} onChange={(e) => setS({ ...s, receipt_prefix: e.target.value })} className="mt-1 font-mono" placeholder="ANP-" />
                <div className="text-[10px] text-muted-foreground mt-1">Example: Prefix 'ANP-' results in 'ANP-000001'.</div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("receipt_padding")}</label>
                <Input type="number" value={s.receipt_padding} onChange={(e) => setS({ ...s, receipt_padding: e.target.value })} className="mt-1 font-mono" placeholder="6" />
                <div className="text-[10px] text-muted-foreground mt-1">Number of digits for numeric component.</div>
              </div>
            </div>
          </Card>

          {/* Section 4: Toggles & Features */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Receipt className="w-4 h-4" /> {t("template_features_rules")}
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
                  <div className="text-xs font-bold text-foreground">{t("show_tax_breakdown")}</div>
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
                  <div className="text-xs font-bold text-foreground">{t("show_payment_method")}</div>
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
                  <div className="text-xs font-bold text-foreground">{t("show_thali_selections")}</div>
                  <div className="text-[9px] text-muted-foreground">Print detailed thali selections.</div>
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
                  <div className="text-sm font-bold text-foreground">{t("auto_print_receipt")}</div>
                  <div className="text-[10px] text-muted-foreground">Print receipts automatically after checkout (direct to printer in desktop app).</div>
                </div>
              </label>

              <div className="flex items-center justify-center border border-border rounded-md p-3">
                <Button
                  onClick={handleTestPrint}
                  disabled={testPrinting || !window.electronAPI}
                  variant="outline"
                  className="w-full border-terracotta text-terracotta hover:bg-terracotta hover:text-white"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {testPrinting ? "Printing..." : "Test Print"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Section 5: Data Management */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Database className="w-4 h-4" /> {t("data_management")}
            </h2>
            
            <div className="bg-sand-subtle/40 border border-border rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${getBackupStatus().showWarning ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{t("last_backup")}</div>
                  <div className={`text-sm font-mono ${getBackupStatus().color} mt-1`}>
                    {getBackupStatus().text}
                  </div>
                  {getBackupStatus().showWarning && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Regular backups protect your business data. Create a backup now.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={createBackup}
                disabled={backupBusy}
                className="bg-forest hover:bg-forest/90 text-white"
                data-testid="backup-now-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                {backupBusy ? "..." : t("backup_now")}
              </Button>

              <Button
                onClick={restoreBackup}
                disabled={restoreBusy}
                variant="outline"
                className="border-border hover:bg-sand-subtle"
                data-testid="restore-backup-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                {restoreBusy ? "..." : t("restore_backup")}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
              <p><strong>Backup includes:</strong> All orders, revenue, menu items, daily menu templates, Thali configurations, users, and settings.</p>
              <p><strong>File format:</strong> JSON file with timestamp (e.g., AnndevtaPOS_Backup_2026-06-22.json)</p>
              <p><strong>Restore:</strong> Select a backup file to restore all data. Current data will be overwritten.</p>
            </div>
          </Card>

          {/* Section 6: About & Branding */}
          <Card className="p-6 border-border shadow-none space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-terracotta flex items-center gap-2">
              <Info className="w-4 h-4" /> System Information
            </h2>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <img src="/tranferentlogo.png" alt="Career Craftly" className="h-16" />
                <div>
                  <div className="text-xl font-bold text-blue-900">Career Craftly</div>
                  <div className="text-sm text-blue-700">Crafting Digital Success, Intelligently</div>
                </div>
              </div>
              
              <div className="border-t border-blue-300 pt-4 space-y-2 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span className="font-semibold">Product:</span>
                  <span>Anndevta POS System</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Version:</span>
                  <span>1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Developed by:</span>
                  <span>Career Craftly</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">License:</span>
                  <span>Commercial</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-blue-300 text-xs text-blue-700">
                <p className="leading-relaxed">
                  This Point of Sale system is professionally developed by <strong>Career Craftly</strong>, 
                  a leading digital solutions provider. For support, updates, or custom features, 
                  contact Career Craftly.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Interactive Thermal Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Eye className="w-4 h-4" /> {t("thermal_print_preview")} ({s.paper_width}mm)
          </div>

          <div className="w-full max-w-sm flex justify-center bg-neutral-50 p-6 rounded-md shadow-inner border border-border overflow-hidden">
            <ReceiptPreview order={mockOrder} settings={s} />
          </div>
        </div>
      </div>
    </div>
  );
}


