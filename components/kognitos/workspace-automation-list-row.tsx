"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type WorkspaceAutomationRowProps = {
  id: string;
  title: string;
  description?: string;
  /** Short automation module id (shown below description when set). */
  moduleId?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  locked?: boolean;
};

export function WorkspaceAutomationListRow({
  id,
  title,
  description,
  moduleId,
  checked,
  onCheckedChange,
  disabled,
  locked,
}: WorkspaceAutomationRowProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-border/80 bg-card px-3 py-3",
        locked && "opacity-90",
      )}
    >
      <div className="flex items-start pt-0.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange?.(v === true)}
          disabled={disabled || locked}
          aria-readonly={locked}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label
          htmlFor={id}
          className={cn("text-sm font-medium leading-none", locked && "cursor-default")}
        >
          {title}
        </Label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {moduleId ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-sans">Module ID</span>{" "}
            <span className="font-mono">{moduleId}</span>
          </p>
        ) : null}
        {locked ? (
          <p className="text-xs text-muted-foreground">Registered</p>
        ) : null}
      </div>
    </div>
  );
}
