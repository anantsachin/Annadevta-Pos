import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, ChefHat, LayoutGrid, BookOpen, Boxes, Users, UserCog, Tag, Bike, BarChart3, LogOut, Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { offlineQueue } from "../lib/offlineQueue";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "POS Terminal", icon: ShoppingCart },
  { to: "/kitchen", label: "Kitchen (KOT)", icon: ChefHat },
  { to: "/tables", label: "Tables", icon: LayoutGrid },
  { to: "/online-orders", label: "Online Orders", icon: Bike },
  { to: "/menu", label: "Menu", icon: BookOpen, roles: ["admin", "manager"] },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager"] },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/discounts", label: "Discounts", icon: Tag, roles: ["admin", "manager"] },
  { to: "/staff", label: "Staff", icon: UserCog, roles: ["admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(offlineQueue.count());

  useEffect(() => {
    const setOn = () => setOnline(true);
    const setOff = () => setOnline(false);
    const refreshQueue = () => setQueueCount(offlineQueue.count());
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    window.addEventListener("pos-queue-changed", refreshQueue);
    return () => {
      window.removeEventListener("online", setOn);
      window.removeEventListener("offline", setOff);
      window.removeEventListener("pos-queue-changed", refreshQueue);
    };
  }, []);

  useEffect(() => {
    if (online && queueCount > 0) {
      offlineQueue.sync().then((r) => {
        if (r.synced) toast.success(`Synced ${r.synced} offline orders`);
      });
    }
  }, [online, queueCount]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen flex bg-sand-app">
      <aside className="w-64 border-r border-border bg-white flex flex-col" data-testid="sidebar">
        <div className="px-6 py-5 border-b border-border">
          <div className="font-display font-extrabold text-xl tracking-tight text-[#1C1C1C]">FORK<span className="text-terracotta">&</span>FIRE</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Restaurant POS</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.filter(n => !n.roles || n.roles.includes(user?.role)).map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  isActive ? "bg-terracotta text-white" : "text-foreground hover:bg-sand-subtle"
                }`
              }>
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-semibold">{user?.name}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{user?.role}</div>
          </div>
          <button onClick={handleLogout} data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-sand-subtle transition-all">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-white px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            {queueCount > 0 && (
              <button
                onClick={async () => {
                  const r = await offlineQueue.sync();
                  if (r.synced) toast.success(`Synced ${r.synced} offline orders`);
                  else if (r.error) toast.error(r.error);
                }}
                data-testid="sync-now-btn"
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100">
                <CloudUpload className="w-3.5 h-3.5" />
                {queueCount} pending
              </button>
            )}
            <div className="flex items-center gap-2" data-testid="sync-indicator">
              {online ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-forest pulse-dot" />
                  <span className="text-xs font-medium text-forest"><Wifi className="w-3 h-3 inline mr-1" />Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-destructive pulse-dot-offline" />
                  <span className="text-xs font-medium text-destructive"><WifiOff className="w-3 h-3 inline mr-1" />Offline</span>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
