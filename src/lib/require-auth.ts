import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, getSessionName } from "@/lib/auth";

// proxy.tsでの楽観的チェックとは別に、Server Actionは直接POSTでも叩けるため
// 各アクションの先頭でも認証を検証する（多層防御）。
// 戻り値はログイン時に入力した名前（チャットの送信者表示に使う）。
export async function requireAuth(): Promise<string> {
  const cookieStore = await cookies();
  const name = await getSessionName(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!name) {
    throw new Error("認証が必要です。");
  }
  return name;
}

// Server Component（ページ）から、ログイン中の名前だけを読み取りたい場合に使う。
export async function getCurrentUserName(): Promise<string | null> {
  const cookieStore = await cookies();
  return getSessionName(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
