"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Redirects to onboarding (admin) or setup-pending (non-admin) until at least one
 * automation is registered in Supabase (after optional env bootstrap).
 */
export function KognitosSetupGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!user) {
      setReady(true);
      setAllowed(true);
      return;
    }

    let cancelled = false;

    async function run() {
      const u = user;
      if (!u) return;
      try {
        const res = await fetch("/api/kognitos/automations/status");
        const json = (await res.json()) as { setupComplete?: boolean };
        if (cancelled) return;

        if (json.setupComplete) {
          setAllowed(true);
          setReady(true);
          return;
        }

        if (u.role === "admin") {
          if (pathname?.startsWith("/onboarding/kognitos")) {
            setAllowed(true);
          } else {
            router.replace("/onboarding/kognitos");
            setAllowed(false);
          }
        } else {
          if (pathname?.startsWith("/setup-pending")) {
            setAllowed(true);
          } else {
            router.replace("/setup-pending");
            setAllowed(false);
          }
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setAllowed(true);
          setReady(true);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, pathname, router]);

  if (!user) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30 text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
