import React, { useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Receipt, CalendarDays, BookOpen, ListOrdered, LayoutDashboard, FileBarChart, Settings as SettingsIcon, LogOut, Package, Briefcase, Users, Menu, X, WifiOff, RefreshCw, CheckCircle2, CloudOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import PasswordChangeDialog from "./PasswordChangeDialog";
import api from "../lib/api";
import { useSyncManager } from "../lib/offlineManager";
import AIChatWidget from "./AIChatWidget";
const NAV_ITEMS = [
  { to: "/", key: "nav_billing", label: "Billing", icon: Receipt, hero: true, end: true, testid: "nav-billing" },
  { to: "/orders", key: "nav_orders", label: "Orders", icon: ListOrdered, testid: "nav-orders" },
  { to: "/daily-menu", key: "nav_daily_menu", label: "Daily Menu", icon: CalendarDays, roles: ["admin"], testid: "nav-daily-menu" },
  { to: "/menu", key: "nav_menu", label: "Menu", icon: BookOpen, roles: ["admin"], testid: "nav-menu" },
  { to: "/dashboard", key: "nav_dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"], testid: "nav-dashboard" },
  { to: "/reports", key: "nav_reports", label: "Reports", icon: FileBarChart, roles: ["admin"], testid: "nav-reports" },
  { to: "/staff", key: "nav_staff", label: "System Users", icon: Users, roles: ["admin"], testid: "nav-staff" },
  { to: "/settings", key: "nav_settings", label: "Settings", icon: SettingsIcon, roles: ["admin"], testid: "nav-settings" },
  { to: "/inventory", key: "nav_inventory", label: "Inventory", icon: Package, roles: ["admin"], testid: "nav-inventory" },
  { to: "/payroll", key: "nav_payroll", label: "Payroll & HR", icon: Briefcase, roles: ["admin"], testid: "nav-payroll" },
];

function navClasses({ isActive, hero }) {
  const base = "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150";
  if (isActive && hero) return `${base} bg-terracotta text-white shadow-sm`;
  if (isActive) return `${base} bg-foreground text-white`;
  if (hero) return `${base} bg-terracotta/5 text-terracotta hover:bg-terracotta/10`;
  return `${base} text-foreground hover:bg-sand-subtle`;
}

export default function Layout() {
  const { user, logout, isOffline } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [settings, setSettings] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isOnline, syncStatus, pendingCount, triggerSync } = useSyncManager();
  
  const handleLogout = async () => { await logout(); navigate("/login"); };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(user?.role)),
    [user?.role]
  );

  // Fetch settings for app name and tagline
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/settings");
        console.log("Settings loaded:", data);
        setSettings(data);
        // Also cache settings for offline use
        try { const { offlineStorage } = await import("../lib/offlineStorage"); offlineStorage.saveSettings(data); } catch (_) {}
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    };

    const fetchAlerts = async () => {
      if (user?.role === "admin") {
        try {
          const { data } = await api.get("/inventory/alerts/count");
          setAlertCount(data.count);
        } catch (e) { console.error("Failed to fetch alerts:", e); }
      }
    };
    
    fetchSettings();
    fetchAlerts();
    
    // Listen for settings updates
    const handleSettingsUpdate = () => {
      console.log("Settings update event received, refetching...");
      fetchSettings();
    };
    
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handlePasswordChangeClose = (success) => {
    if (success) {
      setShowPasswordChange(false);
    }
    // If not success and it's first login, keep dialog open
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-sand-app">
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-border sticky top-0 z-30 shadow-sm h-14">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-md hover:bg-sand-subtle text-foreground transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-display font-extrabold text-xl tracking-tight">
            {(settings?.app_name !== undefined && settings?.app_name !== null) ? settings.app_name : "Anndevta"}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-terracotta to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Mobile Menu Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Fixed/Drawer on mobile, Standard on desktop */}
      <aside className={`w-[280px] h-screen fixed left-0 top-0 bg-white border-r border-border flex flex-col shadow-sm transition-transform duration-300 z-50 lg:translate-x-0 ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`} data-testid="sidebar">
        {/* Header with Customizable Branding */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-display font-extrabold text-2xl tracking-tight">
              {(settings?.app_name !== undefined && settings?.app_name !== null) ? settings.app_name : "Anndevta"}<span className="text-terracotta">.</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
              {(settings?.app_tagline !== undefined && settings?.app_tagline !== null) ? settings.app_tagline : t("thali_billing_counter")}
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-md hover:bg-sand-subtle text-foreground transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {Array.isArray(visibleNav) && visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid}
              className={({ isActive }) => 
                `flex items-center justify-between px-4 py-3.5 rounded-lg text-[15px] font-medium transition-all ${
                  isActive && n.hero
                    ? 'bg-terracotta text-white shadow-sm' 
                    : isActive
                    ? 'bg-foreground text-white shadow-sm'
                    : n.hero
                    ? 'bg-terracotta/5 text-terracotta hover:bg-terracotta/10'
                    : 'text-foreground hover:bg-sand-subtle'
                }`
              }>
              <div className="flex items-center gap-3">
                <n.icon className="w-5 h-5 flex-shrink-0" />
                <span>{t(n.key)}</span>
              </div>
              {n.key === "nav_inventory" && alertCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Professional User Section - Sticky Bottom */}
        <div className="mt-auto border-t border-border">
          {/* User Profile Card */}
          <div className="p-4 bg-sand-subtle/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-terracotta to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{user?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {user?.role === "admin" ? "Administrator" : "Cashier"}
                </div>
              </div>
            </div>
            
            {/* Sign Out Button */}
            <button onClick={handleLogout} data-testid="logout-btn"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-foreground bg-white border border-border hover:bg-sand-subtle transition-all shadow-sm">
              <LogOut className="w-4 h-4" />
              {t("sign_out")}
            </button>
          </div>

          {/* Career Craftly Branding - Highlighted */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-t border-blue-200">
            <div className="flex flex-col items-center text-center gap-2">
              <img src="/tranferentlogo.png" alt="Career Craftly" className="h-12 w-auto" />
              <div className="text-[10px] leading-tight">
                <div className="font-bold text-blue-900">Career Craftly</div>
                <div className="text-blue-700">Digital Solutions</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Offset by sidebar width on desktop */}
      <main className="flex-1 lg:ml-[280px] overflow-auto min-w-0 flex flex-col">
        {/* Sync / Offline Status Bar */}
        {(!isOnline || pendingCount > 0 || syncStatus === "syncing" || syncStatus === "synced" || syncStatus === "error") && (
          <div className={`w-full px-4 py-2 flex items-center justify-between text-xs font-semibold z-20 ${
            !isOnline
              ? "bg-red-500 text-white"
              : syncStatus === "syncing"
              ? "bg-amber-400 text-amber-900"
              : syncStatus === "synced"
              ? "bg-green-500 text-white"
              : syncStatus === "error"
              ? "bg-red-500 text-white"
              : "bg-amber-100 text-amber-800"
          }`}>
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <><WifiOff className="w-3.5 h-3.5" /> OFFLINE MODE{pendingCount > 0 ? ` · ${pendingCount} order${pendingCount > 1 ? "s" : ""} queued` : ""}</>
              ) : syncStatus === "syncing" ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing {pendingCount} order{pendingCount > 1 ? "s" : ""}…</>
              ) : syncStatus === "synced" ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> All orders synced!</>
              ) : syncStatus === "error" ? (
                <><CloudOff className="w-3.5 h-3.5" /> Sync failed — will retry</>
              ) : (
                <><CloudOff className="w-3.5 h-3.5" /> {pendingCount} order{pendingCount > 1 ? "s" : ""} pending sync</>
              )}
            </div>
            {isOnline && pendingCount > 0 && syncStatus === "idle" && (
              <button onClick={triggerSync} className="underline underline-offset-2 hover:no-underline">
                Sync now
              </button>
            )}
          </div>
        )}
        <Outlet />
      </main>

      <PasswordChangeDialog
        open={showPasswordChange}
        onClose={handlePasswordChangeClose}
        isFirstLogin={true}
      />
      <AIChatWidget />
    </div>
  );
}
