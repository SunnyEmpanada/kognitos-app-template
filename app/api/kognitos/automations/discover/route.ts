import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api/kognitos-mock-role";
import { automationShortIdFromResourceName } from "@/lib/kognitos/automation-name";
import { listAllAutomationsRaw } from "@/lib/kognitos/client-core";

export type DiscoverAutomation = {
  automation_id: string;
  resource_name: string;
  display_name: string;
  description: string;
};

export async function POST(request: Request) {
  const forbidden = requireAdmin(request);
  if (forbidden) return forbidden;

  const hasEnv =
    process.env.KOGNITOS_BASE_URL &&
    (process.env.KOGNITOS_API_KEY || process.env.KOGNITOS_PAT) &&
    (process.env.KOGNITOS_ORGANIZATION_ID || process.env.KOGNITOS_ORG_ID) &&
    process.env.KOGNITOS_WORKSPACE_ID;

  if (!hasEnv) {
    return NextResponse.json(
      { error: "kognitos_env_missing" },
      { status: 503 },
    );
  }

  try {
    const raw = await listAllAutomationsRaw();
    const automations: DiscoverAutomation[] = [];
    for (const a of raw) {
      const name = String(a.name ?? "");
      const shortId = automationShortIdFromResourceName(name);
      if (!shortId) continue;
      const displayName =
        typeof a.display_name === "string" && a.display_name
          ? a.display_name
          : shortId;
      const desc =
        typeof a.description === "string"
          ? a.description
          : typeof a.english_code === "string"
            ? a.english_code
            : "";
      automations.push({
        automation_id: shortId,
        resource_name: name,
        display_name: displayName,
        description: desc,
      });
    }
    return NextResponse.json({ automations });
  } catch (e) {
    const message = e instanceof Error ? e.message : "discover_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
