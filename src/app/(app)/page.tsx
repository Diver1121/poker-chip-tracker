import { redirect } from "next/navigation";

// ダッシュボードは廃止し、来店中ボードに一本化した。
// 古いブックマークや、未ログイン時の redirect="/" 経由のアクセスもここで拾う。
export default function RootPage() {
  redirect("/board");
}
