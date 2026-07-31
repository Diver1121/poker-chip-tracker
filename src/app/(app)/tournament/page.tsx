import Link from "next/link";
import { Fragment } from "react";
import {
  getCheckedInCustomers,
  getCustomers,
  getDenominations,
  getTournamentEntries,
} from "@/lib/data";
import { businessDateKey, shiftDayKey } from "@/lib/businessDay";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TournamentCustomerInput } from "@/components/TournamentCustomerInput";
import { NumberStepperInput } from "@/components/NumberStepperInput";
import { TournamentNameDatalistSync } from "@/components/TournamentNameDatalistSync";
import { deleteTournamentEntry, saveAllTournamentEntries, saveTournamentEntry } from "./actions";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 紙のエントリーシートに合わせ、常に最低40行分の記入欄を表示する
// （エントリーが40件を超えたらその分だけ行を増やす）。
const MIN_ROWS = 40;

// # / NAME / エントリー / 現金 / チップ / チケット / アドオン / 順位 / 獲得 / 保存 / 削除 の11列
// スマホでの利用が多いため、NAMEはなるべく幅を取らないようにしている
const GRID_COLS =
  "grid-cols-[2rem_minmax(4.5rem,1fr)_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_4.5rem_3.25rem_3.25rem]";

const inputClassName =
  "w-full rounded-md border border-gray-300 px-1.5 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none";

export default async function TournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ date }, entries, denominations, checkedInCustomers, allCustomers] =
    await Promise.all([
      searchParams,
      getTournamentEntries(),
      getDenominations(),
      getCheckedInCustomers(),
      getCustomers(),
    ]);

  // 「種類」は額面設定の「トーナメントで使う」項目をそのまま流用する
  // （アドオン専用の項目はこの日のトーナメント種類の選択肢から除き、アドオンの種類選択に出す）
  const tournamentDenominations = denominations.filter(
    (d) => d.usable_for_tournament && !d.usable_for_addon,
  );
  const addonDenominations = denominations.filter((d) => d.usable_for_addon);

  const todayKey = businessDateKey(new Date());
  const requestedDayKey =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey;
  const dayKey = requestedDayKey > todayKey ? todayKey : requestedDayKey;
  const prevDayKey = shiftDayKey(dayKey, -1);
  const nextDayKey = shiftDayKey(dayKey, 1);
  const canGoNext = nextDayKey <= todayKey;

  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const dayLabel = `${year}年${month}月${day}日（${weekday}）`;

  const dayEntries = entries.filter(
    (entry) => businessDateKey(entry.created_at) === dayKey,
  );

  const totals = dayEntries.reduce(
    (acc, entry) => ({
      entryFee: acc.entryFee + entry.entry_fee,
      cash: acc.cash + entry.cash_amount,
      // chip: 点数換算後の合計（種類選択の下の注意書き用）
      chip: acc.chip + entry.chip_amount,
      // chipCount: 「チップ(回数)」列の合計はエントリー回数の合計であり、点数ではない
      chipCount: acc.chipCount + entry.chip_count,
      ticket: acc.ticket + entry.ticket_amount,
      addon: acc.addon + entry.addon_amount,
      addonCount: acc.addonCount + entry.addon_count,
      prize: acc.prize + entry.prize_amount,
    }),
    { entryFee: 0, cash: 0, chip: 0, chipCount: 0, ticket: 0, addon: 0, addonCount: 0, prize: 0 },
  );

  const rowCount = Math.max(MIN_ROWS, dayEntries.length);

  // その日すでに保存されているエントリーがあれば、その種類をデフォルトにする。
  // 無ければ登録済みの先頭の種類、種類が1つも無ければ空。
  const defaultDayDenominationId =
    dayEntries[0]?.denomination_id ?? tournamentDenominations[0]?.id ?? "";
  const selectedDayDenomination =
    tournamentDenominations.find((d) => d.id === defaultDayDenominationId) ?? null;

  const defaultAddonDenominationId =
    dayEntries[0]?.addon_denomination_id ?? addonDenominations[0]?.id ?? "";
  const selectedAddonDenomination =
    addonDenominations.find((d) => d.id === defaultAddonDenominationId) ?? null;

  // 名前欄の候補（datalist）。既にその日のシートに入力済みの名前は初期表示から除外し、
  // 残りはTournamentNameDatalistSyncが入力のたびにその場で絞り込む。
  const enteredNames = new Set(
    dayEntries.map((entry) => entry.name.trim()).filter(Boolean),
  );
  const checkedInNames = checkedInCustomers.map((c) => c.name);
  const availableNames = checkedInNames.filter((n) => !enteredNames.has(n));

  return (
    <div className="space-y-6">
      <form action={saveAllTournamentEntries} className="space-y-4">
        <input type="hidden" name="rowCount" value={rowCount} />
        <datalist id="tournament-checked-in-names" data-all-names={JSON.stringify(checkedInNames)}>
          {availableNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <TournamentNameDatalistSync datalistId="tournament-checked-in-names" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">トーナメント</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              NAMEが客一覧の名前と完全に一致した行だけ、チップ・アドオン・獲得が来店ボードの保有チップと取引履歴に反映されます。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/tournament?date=${prevDayKey}`}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前日
            </Link>
            <span className="font-medium text-gray-900">{dayLabel}</span>
            {canGoNext ? (
              <Link
                href={`/tournament?date=${nextDayKey}`}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌日 →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌日 →
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                この日のトーナメント種類
              </label>
              <select
                name="dayDenominationId"
                defaultValue={defaultDayDenominationId}
                className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
              >
                {tournamentDenominations.length === 0 && <option value="">種類未設定</option>}
                {tournamentDenominations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {selectedDayDenomination ? (
                  <>
                    チップ欄には点数ではなく「利用回数」を入力してください。選んだ種類の点数で自動計算されます。
                    現在の合計 {totals.chip.toLocaleString()}点
                  </>
                ) : (
                  <>
                    「額面設定」でトーナメントに使う項目を登録すると、チップ欄の回数から点数が自動計算されるようになります。
                    <Link href="/settings/denominations" className="ml-1 text-indigo-600 hover:underline">
                      額面設定へ
                    </Link>
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                アドオンの種類
              </label>
              <select
                name="dayAddonDenominationId"
                defaultValue={defaultAddonDenominationId}
                className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
              >
                {addonDenominations.length === 0 && <option value="">種類未設定</option>}
                {addonDenominations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {selectedAddonDenomination ? (
                  <>
                    アドオン欄には点数ではなく「利用回数」を入力してください。選んだ種類の点数で自動計算されます。
                    現在の合計 {totals.addon.toLocaleString()}点
                  </>
                ) : (
                  <>
                    「額面設定」でアドオンに使う項目を登録すると、アドオン欄の回数から点数が自動計算されるようになります。
                    <Link href="/settings/denominations" className="ml-1 text-indigo-600 hover:underline">
                      額面設定へ
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <SubmitButton className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              記録保存
            </SubmitButton>
            <p className="mt-1 max-w-[16rem] text-[11px] text-gray-500">
              この表全体を記録として保存します。グラフページのトーナメント欄から、後で誰が参加したか振り返れます。
            </p>
          </div>
        </div>

        <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className={`grid ${GRID_COLS} min-w-[760px] items-center gap-x-1.5 gap-y-2 p-4`}>
            <div />
            <div className="text-xs font-medium text-gray-500">NAME</div>
            <div className="text-xs font-medium text-gray-500">エントリー</div>
            <div className="text-xs font-medium text-gray-500">現金</div>
            <div className="text-xs font-medium text-gray-500">チップ(回数)</div>
            <div className="text-xs font-medium text-gray-500">チケット</div>
            <div className="text-xs font-medium text-gray-500">アドオン(回数)</div>
            <div className="text-xs font-medium text-gray-500">順位</div>
            <div className="text-xs font-medium text-gray-500">獲得</div>
            <div />
            <div />

            <div />
            <div className="text-xs font-bold text-gray-900">合計</div>
            <div className="text-xs font-bold text-gray-900">
              {totals.entryFee.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-gray-900">{totals.cash.toLocaleString()}</div>
            <div className="text-xs font-bold text-gray-900">
              {totals.chipCount.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-gray-900">
              {totals.ticket.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-gray-900">
              {totals.addonCount.toLocaleString()}
            </div>
            <div />
            <div className="text-xs font-bold text-gray-900">{totals.prize.toLocaleString()}</div>
            <div />
            <div />

            {Array.from({ length: rowCount }, (_, i) => {
              const entry = dayEntries[i];
              return (
                <Fragment key={entry?.id ?? `blank-${i}`}>
                  <div className="text-xs text-gray-400">{i + 1}</div>
                  <input type="hidden" name={`id-${i}`} value={entry?.id ?? ""} />
                  <TournamentCustomerInput
                    rowIndex={i}
                    customers={allCustomers}
                    defaultText={entry?.name ?? ""}
                    datalistId="tournament-checked-in-names"
                    className={inputClassName}
                  />
                  {/* エントリーは現金・チップ・チケットの合計をサーバー側で自動計算する
                      （手入力ではなく保存後の数値をそのまま表示するだけの欄） */}
                  <div className="px-1.5 py-1 text-right text-sm text-gray-900">
                    {(entry?.entry_fee ?? 0).toLocaleString()}
                  </div>
                  <NumberStepperInput
                    name={`cashAmount-${i}`}
                    defaultValue={entry?.cash_amount ?? ""}
                    placeholder="0"
                    className={inputClassName}
                  />
                  <NumberStepperInput
                    name={`chipCount-${i}`}
                    defaultValue={entry?.chip_count ?? ""}
                    placeholder="回数"
                    className={inputClassName}
                  />
                  <NumberStepperInput
                    name={`ticketAmount-${i}`}
                    defaultValue={entry?.ticket_amount ?? ""}
                    placeholder="0"
                    className={inputClassName}
                  />
                  <NumberStepperInput
                    name={`addonCount-${i}`}
                    defaultValue={entry?.addon_count ?? ""}
                    placeholder="回数"
                    className={inputClassName}
                  />
                  <input
                    name={`rank-${i}`}
                    type="number"
                    step={1}
                    defaultValue={entry?.rank ?? ""}
                    placeholder="-"
                    className={inputClassName}
                  />
                  <input
                    name={`prizeAmount-${i}`}
                    type="number"
                    step={1}
                    defaultValue={entry?.prize_amount ?? ""}
                    placeholder="0"
                    className={inputClassName}
                  />
                  <SubmitButton
                    pendingText="保存中"
                    formAction={saveTournamentEntry.bind(null, i)}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    保存
                  </SubmitButton>
                  {entry ? (
                    <ConfirmSubmitButton
                      confirmMessage={`「${entry.name}」のエントリーを削除しますか？`}
                      formAction={deleteTournamentEntry.bind(null, entry.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      削除
                    </ConfirmSubmitButton>
                  ) : (
                    <div />
                  )}
                </Fragment>
              );
            })}
          </div>
        </section>
      </form>
    </div>
  );
}
