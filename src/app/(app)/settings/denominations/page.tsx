import { getDenominations } from "@/lib/data";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatAliasesInput } from "@/lib/denominationAliases";
import {
  createDenomination,
  deleteDenomination,
  moveDenominationDown,
  moveDenominationUp,
  updateDenomination,
} from "./actions";

const fieldInputClassName =
  "w-full rounded-md border border-gray-300 px-4 py-2.5 text-base text-gray-900 focus:border-indigo-500 focus:outline-none";
const fieldLabelClassName = "mb-1 block text-sm font-medium text-gray-700";
const checkboxGridClassName = "grid grid-cols-2 gap-x-6 gap-y-2 sm:w-64";
const checkboxLabelClassName = "flex items-center gap-2 text-sm text-gray-900";
const checkboxInputClassName = "h-5 w-5";

function UsageCheckboxes({
  defaultUsableForPurchase,
  defaultUsableForTournament,
  defaultUsableForAddon,
  defaultIsMysteryBounty,
}: {
  defaultUsableForPurchase: boolean;
  defaultUsableForTournament: boolean;
  defaultUsableForAddon: boolean;
  defaultIsMysteryBounty: boolean;
}) {
  return (
    <div className={checkboxGridClassName}>
      <label className={checkboxLabelClassName}>
        <input
          type="checkbox"
          name="usableForPurchase"
          value="1"
          defaultChecked={defaultUsableForPurchase}
          className={checkboxInputClassName}
        />
        購入
      </label>
      <label className={checkboxLabelClassName}>
        <input
          type="checkbox"
          name="usableForTournament"
          value="1"
          defaultChecked={defaultUsableForTournament}
          className={checkboxInputClassName}
        />
        トーナメント
      </label>
      <label className={checkboxLabelClassName}>
        <input
          type="checkbox"
          name="usableForAddon"
          value="1"
          defaultChecked={defaultUsableForAddon}
          className={checkboxInputClassName}
        />
        アドオン
      </label>
      <label className={checkboxLabelClassName}>
        <input
          type="checkbox"
          name="isMysteryBounty"
          value="1"
          defaultChecked={defaultIsMysteryBounty}
          className={checkboxInputClassName}
        />
        バウンティ
      </label>
    </div>
  );
}

export default async function DenominationsSettingsPage() {
  const denominations = await getDenominations();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-bold text-gray-900">額面を追加</h1>
        <form
          action={createDenomination}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="label" className={fieldLabelClassName}>
                表示名
              </label>
              <input
                id="label"
                name="label"
                required
                placeholder="例: 100点"
                className={fieldInputClassName}
              />
            </div>
            <div>
              <label htmlFor="value" className={fieldLabelClassName}>
                点数
              </label>
              <input
                id="value"
                name="value"
                type="number"
                step={1}
                required
                className={fieldInputClassName}
              />
            </div>
            <div>
              <label htmlFor="aliases" className={fieldLabelClassName}>
                別名（チャット用）
              </label>
              <input
                id="aliases"
                name="aliases"
                placeholder="例: ターボ,turbo"
                className={fieldInputClassName}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <UsageCheckboxes
              defaultUsableForPurchase
              defaultUsableForTournament
              defaultUsableForAddon={false}
              defaultIsMysteryBounty={false}
            />
            <SubmitButton className="rounded-md bg-indigo-600 px-6 py-2.5 text-base font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              追加
            </SubmitButton>
          </div>
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
                className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row"
              >
                <div className="flex gap-1 sm:flex-col">
                  <form action={moveDenominationUp}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton
                      disabled={index === 0}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </SubmitButton>
                  </form>
                  <form action={moveDenominationDown}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton
                      disabled={index === denominations.length - 1}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </SubmitButton>
                  </form>
                </div>
                <form action={updateDenomination} className="flex flex-1 flex-col gap-4">
                  <input type="hidden" name="id" value={d.id} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={fieldLabelClassName}>表示名</label>
                      <input
                        name="label"
                        defaultValue={d.label}
                        required
                        className={fieldInputClassName}
                      />
                    </div>
                    <div>
                      <label className={fieldLabelClassName}>点数</label>
                      <input
                        name="value"
                        type="number"
                        step={1}
                        defaultValue={d.value}
                        required
                        className={fieldInputClassName}
                      />
                    </div>
                    <div>
                      <label className={fieldLabelClassName}>別名（チャット用）</label>
                      <input
                        name="aliases"
                        defaultValue={formatAliasesInput(d.aliases)}
                        placeholder="例: ターボ,turbo"
                        className={fieldInputClassName}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <UsageCheckboxes
                      defaultUsableForPurchase={d.usable_for_purchase}
                      defaultUsableForTournament={d.usable_for_tournament}
                      defaultUsableForAddon={d.usable_for_addon}
                      defaultIsMysteryBounty={d.is_mystery_bounty}
                    />
                    <SubmitButton className="rounded-md border border-gray-300 px-6 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      保存
                    </SubmitButton>
                  </div>
                </form>
                <form action={deleteDenomination} className="sm:self-start">
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`「${d.label}」を削除しますか？この額面の取引履歴がある場合は削除できません。`}
                    className="rounded-md border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
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
