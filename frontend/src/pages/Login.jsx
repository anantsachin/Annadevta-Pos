import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { toast } from "sonner";
import { ChefHat, Loader2 } from "lucide-react";

export default function Login() {
  const { user, ready, login, googleSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@pos.com");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  // Handle Google session redirect: #session_id=xxxx
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("session_id=")) {
      const sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
      if (sid) {
        (async () => {
          try {
            await googleSession(sid);
            window.history.replaceState({}, "", window.location.pathname);
            navigate("/", { replace: true });
          } catch (e) {
            toast.error("Google sign-in failed");
          }
        })();
      }
    }
  }, [googleSession, navigate]);

  useEffect(() => {
    if (ready && user) navigate("/", { replace: true });
  }, [ready, user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  const onGoogle = () => {
    const redirect = `${window.location.origin}/login`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1707334724033-e997675f8c10?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            <span className="font-display font-extrabold tracking-tight text-lg">FORK & FIRE</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] mb-3 opacity-80">A point-of-sale built for hospitality</div>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold leading-tight max-w-md">
              Run your floor.<br />
              <span className="text-terracotta-light">Even when the wifi drops.</span>
            </h1>
            <p className="mt-4 text-sm opacity-80 max-w-sm">
              Take orders, fire the kitchen, sync Swiggy & Zomato — all from one calm, fast workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-sand-app grid-bg">
        <Card className="w-full max-w-md p-8 border-border shadow-none">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Sign in</div>
          <h2 className="font-display text-2xl font-bold tracking-tight mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">Use your staff credentials to access the terminal.</p>
          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" data-testid="login-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="password" data-testid="login-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required className="mt-1" />
            </div>
            <Button type="submit" disabled={busy} data-testid="login-submit"
              className="w-full bg-terracotta hover:bg-terracotta-hover text-white">
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> Or <div className="h-px flex-1 bg-border" />
          </div>

          <Button onClick={onGoogle} variant="outline" data-testid="google-signin-btn"
            className="w-full border-border">
            Continue with Google
          </Button>

          <div className="mt-6 text-xs text-muted-foreground">
            Demo: <code className="font-mono">admin@pos.com / admin123</code> &nbsp;·&nbsp; <code className="font-mono">cashier@pos.com / cashier123</code>
          </div>
        </Card>
      </div>
    </div>
  );
}
