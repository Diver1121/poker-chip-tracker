import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 無料プランのSupabaseには自動バックアップが無いため、Vercel Cronから毎日叩いて
// 全テーブルのデータをJSONとしてGitHub（プライベートリポジトリ）にコミットする。
// CRON_SECRETを設定しておくと、VercelのCronはAuthorizationヘッダーに
// 自動でBearerトークンを付けてくれる（人が直接叩けないようにするための保護）。
const TABLES = [
  "customers",
  "denominations",
  "chip_transactions",
  "visits",
  "chat_messages",
  "shop_settings",
] as const;

const GITHUB_OWNER = "Diver1121";
const GITHUB_REPO = "poker-chip-tracker";
const BACKUP_PATH = "backups/latest.json";

async function fetchAllRows(supabase: SupabaseClient, table: string) {
  const pageSize = 1000;
  let from = 0;
  const rows: unknown[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const githubToken = process.env.BACKUP_GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json(
      { ok: false, error: "BACKUP_GITHUB_TOKEN is not set" },
      { status: 500 },
    );
  }

  const supabase = getSupabaseClient();
  const generatedAt = new Date().toISOString();
  const backup: Record<string, unknown> = { generatedAt };
  const failedTables: string[] = [];

  for (const table of TABLES) {
    try {
      backup[table] = await fetchAllRows(supabase, table);
    } catch (error) {
      failedTables.push(table);
      backup[table] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  const content = JSON.stringify(backup, null, 2);
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BACKUP_PATH}`;
  const githubHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
  };

  const existing = await fetch(apiUrl, { headers: githubHeaders });
  const existingSha = existing.ok ? ((await existing.json()) as { sha: string }).sha : undefined;

  const putResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...githubHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Automated backup ${generatedAt}`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha: existingSha,
    }),
  });

  if (!putResponse.ok) {
    const errorText = await putResponse.text();
    return NextResponse.json(
      { ok: false, error: `GitHub commit failed: ${errorText}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, generatedAt, failedTables });
}
