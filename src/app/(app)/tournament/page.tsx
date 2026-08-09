import Link from "next/link";
import { Fragment } from "react";
import {
  getCheckedInCustomers,
  getCustomers,
  getDenominations,
  getTournamentEntries,
  getTournaments,
} from "@/lib/data";
import { businessDateKey, shiftDayKey } from "@/lib/businessDay";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TournamentCustomerInput } from "@/components/TournamentCustomerInput";
import { NumberStepperInput } from "@/components/NumberStepperInput";
import { TournamentNameDatalistSync } from "@/components/TournamentNameDatalistSync";
import { TournamentRankPrizeInputs } from "@/components/TournamentRankPrizeInputs";
import { computePrizeAmounts } from "@/lib/prizePayout";
import {
  calculatePrizeCount,
  createTournament,
  deleteTournamentEntry,
  saveAllTournamentEntries,
} from "./actions";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 紙のエントリーシートに合わせ、常に最低40行分の記入欄を表示する
// （エントリーが40件を超えたらその分だけ行を増やす）。
const MIN_ROWS = 40;

// # / NAME / エントリー / 現金 / チップ / チケット / アドオン現金 / アドオン / 順位 / 獲得 / 保存 / 削除 の12列
const GRID_COLS =
  "grid-cols-[2rem_minmax(6rem,1fr)_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_4.5rem_3.25rem_3.25rem]";

const inputClassName =
  "w-full rounded-md border border-gray-300 px-1.5 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none";

const selectClassName =
  "w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none";

export default async function TournamentPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    session?: string;
    prizeCount?: string;
    prizeTotal?: string;
  }>;
}) {
  const [
    { date, session, prizeCount: prizeCountParam, prizeTotal: prizeTotalParam },
    entries,
    denominations,
    tournaments,
    checkedInCustomers,
    allCustomers,
  ] = await Promise.all([
    searchParams,
    getTournamentEntries(),
    getDenominations(),
    getTournaments(),
    getCheckedInCustomers(),
    getCustomers(),
  ]);

  // 「種類」は額面設定の「トーナメントで使う」項目をそのまま流用する
  // （アドオン専用の項目は種類の選択肢から除き、アドオンの種類選択に出す）
  const tournamentDenominations = denominations.filter(
    (d) => d.usable_for_tournament && !d.usable_for_addon,
  );
  const addonDenominations = denominations.filter((d) => d.usable_for_addon);
  const denominationLabelById = new Map(denominations.map((d) => [d.id, d.label]));

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

  // その日の「回」一覧。同じ営業日に複数のトーナメントが並行して立った場合、
  // ここでタブとして切り替えられる。
  const daySessions = tournaments
    .filter((t) => businessDateKey(t.created_at) === dayKey)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const selectedSession =
    daySessions.find((t) => t.id === session) ?? daySessions[0] ?? null;

  const dayEntries = selectedSession
    ? entries.filter((entry) => entry.tournament_id === selectedSession.id)
    : [];

  // プライズ計算ボタンの結果表示。日付・回を変えたら計算結果は持ち越さない
  // （date/sessionパラメータと一緒に発行されるURLのprizeCountだけを見る）。
  const prizeCount =
    date === dayKey &&
    session === selectedSession?.id &&
    prizeCountParam &&
    /^\d+$/.test(prizeCountParam)
      ? Number(prizeCountParam)
      : null;
  const prizeTotal =
    date === dayKey &&
    session === selectedSession?.id &&
    prizeTotalParam &&
    /^\d+$/.test(prizeTotalParam)
      ? Number(prizeTotalParam)
      : null;
  const prizeAmounts =
    prizeCount !== null && prizeTotal !== null
      ? computePrizeAmounts(prizeCount, prizeTotal)
      : [];

  const totals = dayEntries.reduce(
    (acc, entry) => ({
      entryFee: acc.entryFee + entry.entry_fee,
      cash: acc.cash + entry.cash_amount,
      // chip: 点数換算後の合計（種類選択の下の注意書き用）
      chip: acc.chip + entry.chip_amount,
      // chipCount: 「チップ(回数)」列の合計はエントリー回数の合計であり、点数ではない
      chipCount: acc.chipCount + entry.chip_count,
      ticket: acc.ticket + entry.ticket_amount,
      addonCash: acc.addonCash + entry.addon_cash_amount,
      addon: acc.addon + entry.addon_amount,
      addonCount: acc.addonCount + entry.addon_count,
      prize: acc.prize + entry.prize_amount,
    }),
    {
      entryFee: 0,
      cash: 0,
      chip: 0,
      chipCount: 0,
      ticket: 0,
      addonCash: 0,
      addon: 0,
      addonCount: 0,
      prize: 0,
    },
  );

  const rowCount = Math.max(MIN_ROWS, dayEntries.length);

  // 名前欄の候補（datalist）。既にこの回に入力済みの名前は初期表示から除外し、
  // 残りはTournamentNameDatalistSyncが入力のたびにその場で絞り込む。
  const enteredNames = new Set(
    dayEntries.map((entry) => entry.name.trim()).filter(Boolean),
  );
  const checkedInNames = checkedInCustomers.map((c) => c.name);
  const availableNames = checkedInNames.filter((n) => !enteredNames.has(n));

  return (
    <div className="space-y-6">
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

      <div className="space-y-3">
        {daySessions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {daySessions.map((t, idx) => {
              const label = t.label || `${idx + 1}回目`;
              const denomLabel = denominationLabelById.get(t.denomination_id ?? "") ?? "種類未設定";
              const isActive = t.id === selectedSession?.id;
              return (
                <Link
                  key={t.id}
                  href={`/tournament?date=${dayKey}&session=${t.id}`}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    isActive
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  <span className={isActive ? "ml-1 text-indigo-100" : "ml-1 text-gray-400"}>
                    ・{denomLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {dayKey === todayKey && (
          <form
            action={createTournament}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-3"
          >
            {daySessions.length === 0 && (
              <p className="w-full text-xs text-gray-500">
                今日のトーナメントをまだ開始していません。
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                回の名前(任意)
              </label>
              <input
                name="label"
                placeholder={`例: ${daySessions.length + 1}回目`}
                className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">種類</label>
              <select name="denominationId" className={selectClassName}>
                {tournamentDenominations.length === 0 && <option value="">種類未設定</option>}
                {tournamentDenominations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                アドオンの種類
              </label>
              <select name="addonDenominationId" className={selectClassName}>
                {addonDenominations.length === 0 && <option value="">種類未設定</option>}
                {addonDenominations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton
              pendingText="開始中"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              ＋ 新しいトーナメントを開始
            </SubmitButton>
          </form>
        )}
      </div>

      {!selectedSession ? (
        <p className="text-sm text-gray-500">この日の記録はありません。</p>
      ) : (
        <form action={saveAllTournamentEntries} className="space-y-4">
          <input type="hidden" name="rowCount" value={rowCount} />
          <input type="hidden" name="dayKey" value={dayKey} />
          <input type="hidden" name="tournamentId" value={selectedSession.id} />
          <datalist id="tournament-checked-in-names" data-all-names={JSON.stringify(checkedInNames)}>
            {availableNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <TournamentNameDatalistSync datalistId="tournament-checked-in-names" />

          <div className="flex flex-wrap items-end justify-between gap-6 rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">
              種類: {denominationLabelById.get(selectedSession.denomination_id ?? "") ?? "未設定"}
              {" ／ "}
              アドオン: {denominationLabelById.get(selectedSession.addon_denomination_id ?? "") ?? "未設定"}
            </div>
            <div className="text-right">
              <div className="flex items-start justify-end gap-3">
                <SubmitButton className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  記録保存
                </SubmitButton>
                <SubmitButton
                  formAction={calculatePrizeCount}
                  pendingText="計算中"
                  className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  プライズ計算
                </SubmitButton>
                {prizeCount !== null && prizeTotal !== null && (
                  <div className="flex items-start gap-3 rounded-md bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-800">
                    <div className="whitespace-nowrap">
                      対象 {prizeCount}名
                      <br />
                      総額 {prizeTotal.toLocaleString()}点
                    </div>
                    <div className="flex flex-col gap-0.5 whitespace-nowrap border-l border-amber-200 pl-3 font-normal text-amber-700">
                      {prizeAmounts.map((amount, i) => (
                        <div key={i}>
                          {i + 1}位 {amount.toLocaleString()}点
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <div className={`grid ${GRID_COLS} min-w-[800px] items-center gap-x-1.5 gap-y-2 p-4`}>
              <div />
              <div className="text-xs font-medium text-gray-500">NAME</div>
              <div className="text-xs font-medium text-gray-500">エントリー</div>
              <div className="text-xs font-medium text-gray-500">現金</div>
              <div className="text-xs font-medium text-gray-500">チップ(回数)</div>
              <div className="text-xs font-medium text-gray-500">チケット</div>
              <div className="text-xs font-medium text-gray-500">アドオン現金</div>
              <div className="text-xs font-medium text-gray-500">アドオン(チップ)</div>
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
                {totals.addonCash.toLocaleString()}
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
                      name={`addonCashAmount-${i}`}
                      defaultValue={entry?.addon_cash_amount ?? ""}
                      placeholder="0"
                      className={inputClassName}
                    />
                    <NumberStepperInput
                      name={`addonCount-${i}`}
                      defaultValue={entry?.addon_count ?? ""}
                      placeholder="回数"
                      className={inputClassName}
                    />
                    <TournamentRankPrizeInputs
                      rowIndex={i}
                      defaultRank={entry?.rank ?? ""}
                      defaultPrizeAmount={entry?.prize_amount ?? ""}
                      prizeAmounts={prizeAmounts}
                      className={inputClassName}
                    />
                    <div />
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
      )}
    </div>
  );
}
