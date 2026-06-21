import React, { useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Receipt, CalendarDays, BookOpen, ListOrdered, LayoutDashboard, FileBarChart, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordChangeDialog from "./PasswordChangeDialog";

const NAV_ITEMS = [
  { to: "/", label: "Billing", icon: Receipt, hero: true, end: true, testid: "nav-billing" },
  { to: "/orders", label: "Orders", icon: ListOrdered, testid: "nav-orders" },
  { to: "/daily-menu", label: "Daily Menu", icon: CalendarDays, roles: ["admin"], testid: "nav-daily-menu" },
  { to: "/menu", label: "Menu", icon: BookOpen, roles: ["admin"], testid: "nav-menu" },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"], testid: "nav-dashboard" },
  { to: "/reports", label: "Reports", icon: FileBarChart, roles: ["admin"], testid: "nav-reports" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"], testid: "nav-settings" },
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
  const navigate = useNavigate();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  const handleLogout = async () => { await logout(); navigate("/login"); };

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(user?.role)),
    [user?.role]
  );

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
      <aside className="w-56 border-r border-border bg-white flex flex-col" data-testid="sidebar">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-display font-extrabold text-lg tracking-tight">Annapurna<span className="text-terracotta">.</span></div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-0.5">Thali billing counter</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid}
              className={({ isActive }) => navClasses({ isActive, hero: n.hero })}>
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-1.5 mb-1.5">
            <div className="text-sm font-semibold leading-none">{user?.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{user?.role}</div>
          </div>
          <button onClick={handleLogout} data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-sand-subtle transition-all">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
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
