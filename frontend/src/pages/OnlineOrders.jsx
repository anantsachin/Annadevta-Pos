import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Bike, RefreshCw, Wifi, WifiOff, LogOut, ChefHat, Search,
  Clock, MapPin, Phone, Inbox, CloudUpload, IndianRupee, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { offlineQueue } from "../lib/offlineQueue";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "incoming", label: "Incoming" },
  { key: "accepted", label: "Accepted" },
  { key: "dispatched", label: "Dispatched" },
  { key: "rejected", label: "Rejected" },
];

const PLATFORM = {
  swiggy: { label: "Swiggy", color: "#FC8019", chip: "bg-swiggy/10 text-swiggy" },
  zomato: { label: "Zomato", color: "#CB202D", chip: "bg-zomato/10 text-zomato" },
};

const STATUS_CHIP = {
  incoming: "bg-amber-100 text-amber-800 border border-amber-200",
  accepted: "bg-forest-light text-forest border border-forest/30",
  dispatched: "bg-blue-100 text-blue-700 border border-blue-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); return `${h}h ${m % 60}m ago`;
};

export default function OnlineOrders() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(offlineQueue.count());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try { const { data } = await api.get("/online-orders"); setOrders(data); }
    catch (e) { /* offline */ }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    const setOn = () => setOnline(true);
    const setOff = () => setOnline(false);
    const refreshQueue = () => setQueueCount(offlineQueue.count());
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    window.addEventListener("pos-queue-changed", refreshQueue);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", setOn);
      window.removeEventListener("offline", setOff);
      window.removeEventListener("pos-queue-changed", refreshQueue);
    };
  }, []);

  const simulate = async (platform) => {
    setLoading(true);
    try {
      await api.post("/online-orders/simulate", { platform });
      toast.success(`New ${platform === 'swiggy' ? 'Swiggy' : 'Zomato'} order received`, {
        style: { borderLeft: `4px solid ${PLATFORM[platform].color}` }
      });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to simulate");
    } finally { setLoading(false); }
  };

  const burstSimulate = async () => {
    setLoading(true);
    try {
      for (let i = 0; i < 5; i++) {
        await api.post("/online-orders/simulate", { platform: Math.random() > 0.5 ? "swiggy" : "zomato" });
      }
      toast.success("5 fresh orders dropped in");
      refresh();
    } finally { setLoading(false); }
  };

  const act = async (o, action) => {
    try {
      await api.post(`/online-orders/${o.id}/${action}`);
      const verb = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "dispatched";
      toast.success(`Order #${o.external_id} ${verb}`);
      refresh();
    } catch (e) { toast.error("Failed"); }
  };

  const stats = useMemo(() => {
    const swiggyRev = orders.filter(o => o.platform === "swiggy" && o.status !== "rejected").reduce((s, o) => s + o.total, 0);
    const zomatoRev = orders.filter(o => o.platform === "zomato" && o.status !== "rejected").reduce((s, o) => s + o.total, 0);
    const incoming = orders.filter(o => o.status === "incoming").length;
    const accepted = orders.filter(o => o.status === "accepted").length;
    return { swiggyRev, zomatoRev, incoming, accepted, total: swiggyRev + zomatoRev };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(o =>
      (filter === "all" || o.status === filter) &&
      (platformFilter === "all" || o.platform === platformFilter) &&
      (!search || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.external_id.toLowerCase().includes(search.toLowerCase()))
    );
  }, [orders, filter, platformFilter, search]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-sand-app">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-border">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-terracotta flex items-center justify-center text-white">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-extrabold text-base tracking-tight leading-none">FORK<span className="text-terracotta">&</span>FIRE</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-0.5">Aggregator command center</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {queueCount > 0 && (
              <button onClick={async () => {
                const r = await offlineQueue.sync();
                if (r.synced) toast.success(`Synced ${r.synced} offline actions`);
              }} data-testid="sync-now-btn"
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100">
                <CloudUpload className="w-3.5 h-3.5" /> {queueCount} pending
              </button>
            )}
            <div className="flex items-center gap-2" data-testid="sync-indicator">
              {online ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-forest pulse-dot" />
                  <span className="text-xs font-semibold text-forest"><Wifi className="w-3 h-3 inline mr-1" />Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-destructive pulse-dot-offline" />
                  <span className="text-xs font-semibold text-destructive"><WifiOff className="w-3 h-3 inline mr-1" />Offline</span>
                </>
              )}
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold leading-none">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{user?.role}</div>
            </div>
            <button onClick={handleLogout} data-testid="logout-btn"
              className="p-2 rounded-md hover:bg-sand-subtle text-foreground" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8">
        {/* Hero */}
        <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Live inbox</div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Swiggy <span className="text-swiggy">·</span> Zomato
              <br />
              <span className="text-terracotta">at one glance.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              Accept, reject and dispatch every aggregator order from a single workspace —
              with offline-first reliability for the moments your wifi blinks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => simulate("swiggy")} disabled={loading} data-testid="sim-swiggy"
              style={{ background: "#FC8019" }}
              className="text-white hover:opacity-90 transition-all">
              <Bike className="w-4 h-4 mr-2" /> + Swiggy order
            </Button>
            <Button onClick={() => simulate("zomato")} disabled={loading} data-testid="sim-zomato"
              style={{ background: "#CB202D" }}
              className="text-white hover:opacity-90 transition-all">
              <Bike className="w-4 h-4 mr-2" /> + Zomato order
            </Button>
            <Button onClick={burstSimulate} disabled={loading} variant="outline" className="border-border" data-testid="sim-burst">
              <Sparkles className="w-4 h-4 mr-2" /> + 5 random
            </Button>
            <Button onClick={refresh} variant="outline" className="border-border" data-testid="refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8" data-testid="stat-strip">
          <Card className="p-5 border-border shadow-none border-l-4 border-l-swiggy">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Swiggy revenue</div>
              <Bike className="w-4 h-4" style={{ color: "#FC8019" }} />
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight mt-2 flex items-center">
              <IndianRupee className="w-5 h-5 mr-0.5 text-muted-foreground" />
              {stats.swiggyRev.toLocaleString('en-IN')}
            </div>
          </Card>
          <Card className="p-5 border-border shadow-none border-l-4 border-l-zomato">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Zomato revenue</div>
              <Bike className="w-4 h-4" style={{ color: "#CB202D" }} />
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight mt-2 flex items-center">
              <IndianRupee className="w-5 h-5 mr-0.5 text-muted-foreground" />
              {stats.zomatoRev.toLocaleString('en-IN')}
            </div>
          </Card>
          <Card className="p-5 border-border shadow-none border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Incoming</div>
              <Inbox className="w-4 h-4 text-amber-600" />
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight mt-2">{stats.incoming}</div>
            <div className="text-xs text-muted-foreground mt-1">Awaiting your response</div>
          </Card>
          <Card className="p-5 border-border shadow-none border-l-4 border-l-forest">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">In kitchen</div>
              <ChefHat className="w-4 h-4 text-forest" />
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight mt-2">{stats.accepted}</div>
            <div className="text-xs text-muted-foreground mt-1">Accepted, preparing</div>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-md" data-testid="status-filters">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                data-testid={`filter-${f.key}`}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  filter === f.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-md" data-testid="platform-filters">
            <button onClick={() => setPlatformFilter("all")} data-testid="plat-all"
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md ${platformFilter === "all" ? "bg-foreground text-white" : "text-muted-foreground"}`}>
              Both
            </button>
            <button onClick={() => setPlatformFilter("swiggy")} data-testid="plat-swiggy"
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md ${platformFilter === "swiggy" ? "text-white" : "text-muted-foreground"}`}
              style={platformFilter === "swiggy" ? { background: "#FC8019" } : {}}>
              Swiggy
            </button>
            <button onClick={() => setPlatformFilter("zomato")} data-testid="plat-zomato"
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md ${platformFilter === "zomato" ? "text-white" : "text-muted-foreground"}`}
              style={platformFilter === "zomato" ? { background: "#CB202D" } : {}}>
              Zomato
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="search-input" placeholder="Search by name or order id…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
          </div>

          <div className="ml-auto text-xs text-muted-foreground font-mono" data-testid="result-count">
            {filtered.length} of {orders.length}
          </div>
        </div>

        {/* Orders grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="orders-grid">
          {filtered.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 py-20 text-center border border-dashed border-border rounded-md bg-white/60">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <div className="text-sm text-muted-foreground">No orders match your filters.</div>
              <Button onClick={burstSimulate} variant="outline" className="border-border mt-4">
                <Sparkles className="w-4 h-4 mr-2" /> Drop 5 demo orders
              </Button>
            </div>
          )}

          {filtered.map(o => {
            const p = PLATFORM[o.platform];
            return (
              <Card key={o.id} data-testid={`order-${o.id}`}
                className="border-border shadow-none overflow-hidden hover:-translate-y-0.5 transition-all duration-200">
                <div className="h-1 w-full" style={{ background: p.color }} />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-md ${p.chip}`}>{p.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{o.external_id}</span>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-semibold ${STATUS_CHIP[o.status]}`}>{o.status}</span>
                  </div>

                  <div className="text-base font-semibold leading-tight">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> <span className="font-mono">{o.customer_phone}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{o.address}</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                    {o.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-foreground">{it.name}</span>
                        <span className="font-mono text-muted-foreground">×{it.qty}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(o.created_at)}
                    </span>
                    <span className="font-display text-xl font-extrabold flex items-center" style={{ color: p.color }}>
                      <IndianRupee className="w-4 h-4" />{o.total}
                    </span>
                  </div>

                  {o.status === "incoming" && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <Button onClick={() => act(o, "reject")} variant="outline" className="border-border" data-testid={`reject-${o.id}`}>Reject</Button>
                      <Button onClick={() => act(o, "accept")} className="text-white hover:opacity-90" style={{ background: p.color }} data-testid={`accept-${o.id}`}>
                        Accept
                      </Button>
                    </div>
                  )}
                  {o.status === "accepted" && (
                    <Button onClick={() => act(o, "dispatch")} className="w-full mt-4 bg-foreground hover:bg-foreground/90 text-white" data-testid={`dispatch-${o.id}`}>
                      Mark as dispatched
                    </Button>
                  )}
                  {o.status === "dispatched" && (
                    <div className="mt-4 px-3 py-2 rounded-md bg-blue-50 text-xs text-blue-700 text-center">
                      Out for delivery via {p.label}
                    </div>
                  )}
                  {o.status === "rejected" && (
                    <div className="mt-4 px-3 py-2 rounded-md bg-red-50 text-xs text-red-700 text-center">
                      Rejected — refund handled by {p.label}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <footer className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
          <div>
            <span className="font-semibold">Demo mode</span> — orders are simulated. Connect Swiggy/Zomato partner webhooks once onboarded.
          </div>
          <div className="font-mono">FORK&FIRE POS · v0.1</div>
        </footer>
      </div>
    </div>
  );
}
