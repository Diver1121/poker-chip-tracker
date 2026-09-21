import { logout } from "@/app/login/actions";
import { AppNav } from "@/components/AppNav";
import { APP_NAME } from "@/lib/appName";
import { SubmitButton } from "@/components/SubmitButton";

// DBの最新状態を毎リクエスト反映するため、ビルド時の静的化を無効にする
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/board", label: "来店中ボード" },
  { href: "/transactions", label: "取引履歴" },
  { href: "/tournament", label: "トーナメント" },
  { href: "/customers", label: "客一覧" },
  { href: "/stats", label: "データ" },
  { href: "/ranking", label: "ランキング" },
  { href: "/settings/denominations", label: "額面設定" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-10 border-b border-white/10"
        style={{ background: "linear-gradient(115deg, #3b0764, #6d28d9 65%, #8b5cf6)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/imageの最適化はproxy.ts
                  の認証チェックに/ocean-logo.jpgごと引っかかり、サーバー側のフェッチがログイン画面に
                  リダイレクトされて画像として無効になるため、素の<img>で直接読み込む */}
              <img src="/ocean-logo.jpg" alt="" width={30} height={30} className="rounded-md" />
              <span className="font-bold text-white">{APP_NAME}</span>
            </div>
            <form action={logout}>
              <SubmitButton className="text-sm text-purple-200 hover:text-white disabled:opacity-50">
                ログアウト
              </SubmitButton>
            </form>
          </div>
          <AppNav items={NAV_ITEMS} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
