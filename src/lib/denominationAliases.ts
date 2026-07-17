// 額面設定画面の「別名」欄（カンマ区切りのテキスト入力）と
// DBのtext[]カラムを相互変換するためのヘルパー。

export function parseAliasesInput(raw: string): string[] {
  return raw
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatAliasesInput(aliases: string[]): string {
  return aliases.join("、");
}
