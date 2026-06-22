import React, { useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Receipt, CalendarDays, BookOpen, ListOrdered, LayoutDashboard, FileBarChart, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import PasswordChangeDialog from "./PasswordChangeDialog";
import api from "../lib/api";

const NAV_ITEMS = [
  { to: "/", key: "nav_billing", label: "Billing", icon: Receipt, hero: true, end: true, testid: "nav-billing" },
  { to: "/orders", key: "nav_orders", label: "Orders", icon: ListOrdered, testid: "nav-orders" },
  { to: "/daily-menu", key: "nav_daily_menu", label: "Daily Menu", icon: CalendarDays, roles: ["admin"], testid: "nav-daily-menu" },
  { to: "/menu", key: "nav_menu", label: "Menu", icon: BookOpen, roles: ["admin"], testid: "nav-menu" },
  { to: "/dashboard", key: "nav_dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"], testid: "nav-dashboard" },
  { to: "/reports", key: "nav_reports", label: "Reports", icon: FileBarChart, roles: ["admin"], testid: "nav-reports" },
  { to: "/settings", key: "nav_settings", label: "Settings", icon: SettingsIcon, roles: ["admin"], testid: "nav-settings" },
];

function navClasses({ isActive, hero }) {
  const base = "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150";
  if (isActive && hero) return `${base} bg-terracotta text-white shadow-sm`;
  if (isActive) return `${base} bg-foreground text-white`;
  if (hero) return `${base} bg-terracotta/5 text-terracotta hover:bg-terracotta/10`;
  return `${base} text-foreground hover:bg-sand-subtle`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [settings, setSettings] = useState(null);
  
  const handleLogout = async () => { await logout(); navigate("/login"); };

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
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    };
    
    fetchSettings();
    
    // Listen for settings updates
    const handleSettingsUpdate = () => {
      console.log("Settings update event received, refetching...");
      fetchSettings();
    };
    
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Check if this is first login (password hasn't been changed from default)
  useEffect(() => {
    if (user && user.email === "admin@pos.com") {
      const passwordChanged = localStorage.getItem("passwordChanged");
      if (!passwordChanged) {
        setShowPasswordChange(true);
      }
    }
  }, [user]);

  const handlePasswordChangeClose = (success) => {
    if (success) {
      setShowPasswordChange(false);
    }
    // If not success and it's first login, keep dialog open
  };

  return (
    <div className="min-h-screen flex bg-sand-app">
      {/* Fixed Professional Sidebar */}
      <aside className="w-[280px] h-screen fixed left-0 top-0 bg-white border-r border-border flex flex-col shadow-sm" data-testid="sidebar">
        {/* Header with Customizable Branding */}
        <div className="px-6 py-6 border-b border-border">
          <div className="font-display font-extrabold text-2xl tracking-tight">
            {(settings?.app_name !== undefined && settings?.app_name !== null) ? settings.app_name : "Annapurna"}<span className="text-terracotta">.</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
            {(settings?.app_tagline !== undefined && settings?.app_tagline !== null) ? settings.app_tagline : t("thali_billing_counter")}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3.5 rounded-lg text-[15px] font-medium transition-all ${
                  isActive && n.hero
                    ? 'bg-terracotta text-white shadow-sm' 
                    : isActive
                    ? 'bg-foreground text-white shadow-sm'
                    : n.hero
                    ? 'bg-terracotta/5 text-terracotta hover:bg-terracotta/10'
                    : 'text-foreground hover:bg-sand-subtle'
                }`
              }>
              <n.icon className="w-5 h-5 flex-shrink-0" />
              <span>{t(n.key)}</span>
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

      {/* Main Content - Offset by sidebar width */}
      <main className="flex-1 ml-[280px] overflow-auto min-w-0">
        <Outlet />
      </main>

      <PasswordChangeDialog
        open={showPasswordChange}
        onClose={handlePasswordChangeClose}
        isFirstLogin={true}
      />
    </div>
  );
}
