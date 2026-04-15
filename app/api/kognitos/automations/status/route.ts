import { NextResponse } from "next/server";

import { ensureAutomationFromEnv } from "@/lib/kognitos/ensure-automation-from-env";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Returns whether Kognitos automations are registered (after optional env bootstrap).
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { setupComplete: false, error: "supabase_admin_missing" },
      { status: 503 },
    );
  }

  try {
    await ensureAutomationFromEnv();
    const { count, error } = await supabaseAdmin
      .from("kognitos_automations")
      .select("*", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ setupComplete: (count ?? 0) > 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "status_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
