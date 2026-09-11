// ページ切り替え中、ヘッダー・ナビはそのまま残し、本文だけをこの表示に差し替える
// （データ取得が終わるまで何も表示されず固まって見えるのを防ぐため）。
export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"
          aria-hidden
        />
        読み込み中…
      </div>
    </div>
  );
}
