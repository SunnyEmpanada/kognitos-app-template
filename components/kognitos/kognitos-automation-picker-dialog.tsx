"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { kognitosDashboardFetch } from "@/lib/kognitos/kognitos-dashboard-fetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceAutomationListRow } from "./workspace-automation-list-row";

export type DiscoverItem = {
  automation_id: string;
  resource_name: string;
  display_name: string;
  description: string;
};

type Props = {
  mode: "onboarding" | "add";
  open: boolean;
  /** When true, dialog cannot be dismissed until completed (onboarding). */
  blocking?: boolean;
  registeredAutomationIds?: Set<string>;
  title: string;
  onOpenChange?: (open: boolean) => void;
  onCompleted: () => void;
};

export function KognitosAutomationPickerDialog({
  mode,
  open,
  blocking,
  registeredAutomationIds,
  title,
  onOpenChange,
  onCompleted,
}: Props) {
  const { user } = useAuth();
  const role = user?.role;
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = useMemo(() => {
    if (mode === "onboarding") return items;
    const reg = registeredAutomationIds ?? new Set();
    return items.filter((i) => !reg.has(i.automation_id));
  }, [items, mode, registeredAutomationIds]);

  const loadDiscover = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setDiscoverError(null);
    try {
      const res = await kognitosDashboardFetch("/api/kognitos/automations/discover", {
        method: "POST",
        role,
      });
      const json = (await res.json()) as {
        automations?: DiscoverItem[];
        error?: string;
      };
      if (!res.ok) {
        setDiscoverError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      setItems(json.automations ?? []);
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "discover_failed");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelected(new Set());
      void loadDiscover();
    }
  }, [open, loadDiscover]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!role || selected.size === 0) return;
    setLoading(true);
    try {
      const registrations = available
        .filter((i) => selected.has(i.automation_id))
        .map((i) => ({
          automation_id: i.automation_id,
          resource_name: i.resource_name,
          display_name: i.display_name,
          description: i.description || null,
        }));
      const res = await kognitosDashboardFetch("/api/kognitos/automations", {
        method: "POST",
        role,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrations }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(json.error ?? `Save failed (${res.status})`);
        return;
      }
      onCompleted();
      onOpenChange?.(false);
    } finally {
      setLoading(false);
    }
  }

  const canContinue = selected.size > 0 && !loading;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && blocking) return;
        onOpenChange?.(v);
      }}
    >
      <DialogContent
        className="flex max-h-[min(90vh,640px)] flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton={!blocking}
        onPointerDownOutside={(e) => {
          if (blocking) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (blocking) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-2 border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Select automations to register for this app.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="min-h-0 flex-1 px-2 py-2">
              {discoverError ? (
                <p className="px-4 text-sm text-destructive">{discoverError}</p>
              ) : null}
              {loading && items.length === 0 && !discoverError ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Loading automations…
                </p>
              ) : null}
              {!loading && available.length === 0 && !discoverError ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {mode === "add"
                    ? "No additional automations to add in this workspace."
                    : "No automations found for this workspace."}
                </p>
              ) : null}
              <ScrollArea className="h-[min(50vh,360px)] px-4">
                <div className="space-y-2 pb-4 pr-2">
                  {available.map((i) => (
                    <WorkspaceAutomationListRow
                      key={i.automation_id}
                      id={`auto-${i.automation_id}`}
                      title={i.display_name || i.automation_id}
                      description={i.description || undefined}
                      checked={selected.has(i.automation_id)}
                      onCheckedChange={(c) => toggle(i.automation_id, c)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 px-6 py-4 text-sm text-muted-foreground">
              <p>
                You are about to register{" "}
                <strong className="text-foreground">{selected.size}</strong>{" "}
                automation
                {selected.size === 1 ? "" : "s"} for this app.
              </p>
              <p>
                You cannot remove automations from the UI afterward. You can
                still add more later in Settings. Removing a registration later
                requires manual changes in Supabase (and may delete related
                synced runs).
              </p>
            </div>
            <DialogFooter className="border-t px-6 py-4 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => void handleConfirm()}
              >
                {loading ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
