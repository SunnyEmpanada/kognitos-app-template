import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { getRunRaw } from "./client-core";
import { getRunTimesFromPayload } from "./run-payload";
import { reindexKognitosRunInputsForRun } from "./reindex-run-inputs";

/**
 * Re-fetch each run from Kognitos GET Run and replace `kognitos_runs.payload` with unmapped JSON
 * (so `user_inputs` / `file.remote` are present). Re-runs `kognitos_run_inputs` indexing per row.
 */
export async function refreshAllRunPayloadsFromKognitos(): Promise<{
  ok: boolean;
  updated: number;
  failed: number;
  error?: string;
}> {
  if (!supabaseAdmin) {
    return { ok: false, updated: 0, failed: 0, error: "supabase_admin_missing" };
  }
  const hasEnv =
    process.env.KOGNITOS_BASE_URL &&
    (process.env.KOGNITOS_API_KEY || process.env.KOGNITOS_PAT) &&
    (process.env.KOGNITOS_ORGANIZATION_ID || process.env.KOGNITOS_ORG_ID) &&
    process.env.KOGNITOS_WORKSPACE_ID &&
    process.env.KOGNITOS_AUTOMATION_ID;
  if (!hasEnv) {
    return { ok: false, updated: 0, failed: 0, error: "kognitos_env_missing" };
  }

  const { data, error } = await supabaseAdmin.from("kognitos_runs").select("id");
  if (error) return { ok: false, updated: 0, failed: 0, error: error.message };

  let updated = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const id = String(row.id);
    try {
      const raw = await getRunRaw(id);
      if (!raw) {
        failed += 1;
        continue;
      }
      const times = getRunTimesFromPayload(raw);
      const nm = String(raw.name ?? "");
      const { error: upErr } = await supabaseAdmin
        .from("kognitos_runs")
        .update({
          payload: raw,
          ...(nm ? { name: nm } : {}),
          create_time: times.create,
          update_time: times.update,
        })
        .eq("id", id);
      if (upErr) {
        failed += 1;
        continue;
      }
      updated += 1;
      await reindexKognitosRunInputsForRun(id, raw);
    } catch {
      failed += 1;
    }
  }

  return { ok: true, updated, failed };
}
