import { logout } from "@/app/login/actions";
import { AppNav } from "@/components/AppNav";
import { APP_NAME } from "@/lib/appName";

// DBの最新状態を毎リクエスト反映するため、ビルド時の静的化を無効にする
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/board", label: "来店中ボード" },
  { href: "/", label: "ダッシュボード" },
  { href: "/customers", label: "客一覧" },
  { href: "/transactions", label: "取引履歴" },
  { href: "/chat", label: "チャット" },
  { href: "/settings/denominations", label: "額面設定" },
  { href: "/stats", label: "グラフ" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900">
              {APP_NAME}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ログアウト
              </button>
            </form>
          </div>
          <AppNav items={NAV_ITEMS} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
