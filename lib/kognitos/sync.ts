import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { listAllRunsForAutomationRaw } from "./client-core";
import { getRunTimesFromPayload } from "./run-payload";
import { reindexKognitosRunInputsForRun } from "./reindex-run-inputs";
import { runShortIdFromName } from "./stage";

async function listExistingRunIds(): Promise<Set<string>> {
  if (!supabaseAdmin) return new Set();
  const { data, error } = await supabaseAdmin.from("kognitos_runs").select("id");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.id as string));
}

/** Latest `create_time` among stored runs (RFC3339), or null if none / all null. */
async function getLatestRunCreateTimeIso(): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("kognitos_runs")
    .select("create_time")
    .order("create_time", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error || data == null || data.create_time == null) return null;
  const t = data.create_time as string;
  return typeof t === "string" ? t : new Date(t).toISOString();
}

/**
 * AIP-160 filter for ListRuns: runs at or after the last stored create_time.
 * Skips re-fetching older history; combined with id de-dupe for overlap.
 */
function buildIncrementalCreateTimeFilter(lastCreateTimeIso: string): string {
  return `create_time >= "${lastCreateTimeIso}"`;
}

export type KognitosRefreshResult = {
  ok: boolean;
  written: boolean;
  newRuns: number;
  newRunIds: string[];
  mode: "full" | "incremental";
  sinceCreateTime: string | null;
  fetchedFromKognitos: number;
  skippedAlreadyInDb: number;
  error?: string;
};

export async function runKognitosRefresh(): Promise<KognitosRefreshResult> {
  if (!supabaseAdmin) {
    return {
      ok: false,
      written: false,
      newRuns: 0,
      newRunIds: [],
      mode: "full",
      sinceCreateTime: null,
      fetchedFromKognitos: 0,
      skippedAlreadyInDb: 0,
      error: "supabase_admin_missing",
    };
  }

  const lastCreateIso = await getLatestRunCreateTimeIso();
  const existingIds = await listExistingRunIds();

  const isFullBackfill = lastCreateIso == null;
  const filter = isFullBackfill
    ? undefined
    : buildIncrementalCreateTimeFilter(lastCreateIso);

  const remote = await listAllRunsForAutomationRaw({
    pageSize: 100,
    filter,
  });

  let skippedAlreadyInDb = 0;
  const inserted: string[] = [];

  for (const run of remote) {
    const name = String(run.name ?? "");
    const id = runShortIdFromName(name);
    if (!id) continue;
    if (existingIds.has(id)) {
      skippedAlreadyInDb += 1;
      continue;
    }

    const times = getRunTimesFromPayload(run);
    const row = {
      id,
      name,
      payload: run,
      create_time: times.create,
      update_time: times.update,
    };
    const { error } = await supabaseAdmin.from("kognitos_runs").insert(row);
    if (error) {
      if (error.code === "23505") {
        skippedAlreadyInDb += 1;
        existingIds.add(id);
        continue;
      }
      throw error;
    }
    inserted.push(id);
    existingIds.add(id);

    await reindexKognitosRunInputsForRun(
      id,
      row.payload as Record<string, unknown>,
    );
  }

  if (inserted.length === 0) {
    return {
      ok: true,
      written: false,
      newRuns: 0,
      newRunIds: [],
      mode: isFullBackfill ? "full" : "incremental",
      sinceCreateTime: lastCreateIso,
      fetchedFromKognitos: remote.length,
      skippedAlreadyInDb,
    };
  }

  return {
    ok: true,
    written: true,
    newRuns: inserted.length,
    newRunIds: inserted,
    mode: isFullBackfill ? "full" : "incremental",
    sinceCreateTime: lastCreateIso,
    fetchedFromKognitos: remote.length,
    skippedAlreadyInDb,
  };
}
