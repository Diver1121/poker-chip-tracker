import { getDenominations } from "@/lib/data";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { formatAliasesInput } from "@/lib/denominationAliases";
import {
  createDenomination,
  deleteDenomination,
  moveDenominationDown,
  moveDenominationUp,
  updateDenomination,
} from "./actions";

export default async function DenominationsSettingsPage() {
  const denominations = await getDenominations();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-bold text-gray-900">額面を追加</h1>
        <form
          action={createDenomination}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-gray-700">
              表示名（例: 100点）
            </label>
            <input
              id="label"
              name="label"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="value" className="mb-1 block text-sm font-medium text-gray-700">
              点数（並び替え・合計計算に使用）
            </label>
            <input
              id="value"
              name="value"
              type="number"
              step={1}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="aliases" className="mb-1 block text-sm font-medium text-gray-700">
              別名（チャット入力用、カンマ区切り）
            </label>
            <input
              id="aliases"
              name="aliases"
              placeholder="例: ターボ,turbo"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                name="usableForPurchase"
                value="1"
                defaultChecked
                className="h-4 w-4"
              />
              購入で使う
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                name="usableForTournament"
                value="1"
                defaultChecked
                className="h-4 w-4"
              />
              トーナメントで使う
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            追加
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">額面一覧</h2>
        {denominations.length === 0 ? (
          <p className="text-sm text-gray-500">まだ額面が登録されていません。</p>
        ) : (
          <div className="space-y-3">
            {denominations.map((d, index) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
              >
                <div className="flex gap-1 sm:flex-col">
                  <form action={moveDenominationUp}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      disabled={index === 0}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveDenominationDown}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      disabled={index === denominations.length - 1}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                </div>
                <form
                  action={updateDenomination}
                  className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap"
                >
                  <input type="hidden" name="id" value={d.id} />
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      表示名
                    </label>
                    <input
                      name="label"
                      defaultValue={d.label}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      点数
                    </label>
                    <input
                      name="value"
                      type="number"
                      step={1}
                      defaultValue={d.value}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      別名（チャット入力用）
                    </label>
                    <input
                      name="aliases"
                      defaultValue={formatAliasesInput(d.aliases)}
                      placeholder="例: ターボ,turbo"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="checkbox"
                        name="usableForPurchase"
                        value="1"
                        defaultChecked={d.usable_for_purchase}
                        className="h-4 w-4"
                      />
                      購入
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="checkbox"
                        name="usableForTournament"
                        value="1"
                        defaultChecked={d.usable_for_tournament}
                        className="h-4 w-4"
                      />
                      トーナメント
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    保存
                  </button>
                </form>
                <form action={deleteDenomination}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`「${d.label}」を削除しますか？この額面の取引履歴がある場合は削除できません。`}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    削除
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
