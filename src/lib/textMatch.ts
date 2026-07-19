// 客名の検索・チャットコマンド解析での比較用に、全角/半角・ひらがな/カタカナの
// 表記ゆれを吸収する。例:「（シュウペイ）」と「(シュウペイ)」、
// 誤入力で紛れ込んだひらがな（例:「シュウぺイ」の「ぺ」）と正しいカタカナ「ペ」を同一視する。
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .trim();
}
