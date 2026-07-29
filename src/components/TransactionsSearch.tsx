"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_INFO, quantityUnitLabel } from "@/lib/transactionCategory";
import {
  businessDateKey,
  businessMonthKey,
  daysInMonth,
  shiftDayKey,
  shiftMonthKey,
  toJstDatetimeLocal,
} from "@/lib/businessDay";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { normalizeForMatch } from "@/lib/textMatch";
import type { ChipTransaction } from "@/lib/types";

type Row = {
  tx: ChipTransaction;
  customerName: string;
  denominationLabel: string | null;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function TransactionsSearch({
  rows,
  updateTransactionDate,
  deleteTransaction,
}: {
  rows: Row[];
  updateTransactionDate: (formData: FormData) => void;
  deleteTransaction: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeForMatch(query);

  const todayKey = businessDateKey(new Date());
  // 全件をひたすら下にスクロールしなくて済むよう、通常表示は選んだ1日分だけに絞り、
  // カレンダーで日を切り替える。名前検索中はカレンダーの日付を無視して全期間から探す。
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarMonth, setCalendarMonth] = useState(businessMonthKey(todayKey));

  const rowsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = businessDateKey(row.tx.created_at);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const isSearching = normalizedQuery !== "";
  // 検索中は日付を問わず全期間から該当する取引だけに絞り込む（一致しない分は表示しない）
  const searchResults = useMemo(
    () =>
      isSearching
        ? rows.filter((r) => normalizeForMatch(r.customerName).includes(normalizedQuery))
        : [],
    [rows, isSearching, normalizedQuery],
  );

  const displayedRows = isSearching ? searchResults : (rowsByDay.get(selectedDate) ?? []);

  const currentMonthKey = businessMonthKey(new Date());
  const canGoNextMonth = shiftMonthKey(calendarMonth, 1) <= currentMonthKey;
  const [calYearPart, calMonthPart] = calendarMonth.split("-");
  const calendarMonthLabel = `${calYearPart}年${Number(calMonthPart)}月`;
  const calendarDays = daysInMonth(calendarMonth);
  const firstWeekday = new Date(
    Date.UTC(Number(calYearPart), Number(calMonthPart) - 1, 1),
  ).getUTCDay();

  const [selYear, selMonth, selDay] = selectedDate.split("-").map(Number);
  const selectedWeekday =
    WEEKDAY_LABELS[new Date(Date.UTC(selYear, selMonth - 1, selDay)).getUTCDay()];
  const selectedDateLabel = `${selYear}年${selMonth}月${selDay}日（${selectedWeekday}）`;

  function goToDate(dateKey: string) {
    setSelectedDate(dateKey);
    setCalendarMonth(businessMonthKey(dateKey));
    setQuery("");
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="客の名前で検索（全期間から探します）"
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
      />

      {!isSearching && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => shiftMonthKey(m, -1))}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
            </button>
            <span className="font-medium text-gray-900">{calendarMonthLabel}</span>
            {canGoNextMonth ? (
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => shiftMonthKey(m, 1))}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
              </button>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-1 font-medium text-gray-400">
                {w}
              </div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {calendarDays.map((dateKey) => {
              const count = rowsByDay.get(dateKey)?.length ?? 0;
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === todayKey;
              const dayNum = Number(dateKey.slice(-2));
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => goToDate(dateKey)}
                  className={`flex flex-col items-center rounded-md py-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : count > 0
                        ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        : "text-gray-400 hover:bg-gray-50"
                  } ${isToday && !isSelected ? "ring-1 ring-inset ring-indigo-400" : ""}`}
                >
                  <span>{dayNum}</span>
                  {count > 0 && (
                    <span
                      className={`mt-0.5 text-[10px] ${
                        isSelected ? "text-indigo-100" : "text-indigo-500"
                      }`}
                    >
                      {count}件
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900">
          {isSearching
            ? `「${query}」の検索結果（${searchResults.length}件）`
            : `${selectedDateLabel}の取引（${displayedRows.length}件）`}
        </h2>
        {!isSearching && (
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => goToDate(shiftDayKey(selectedDate, -1))}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前日
            </button>
            <button
              type="button"
              onClick={() => goToDate(shiftDayKey(selectedDate, 1))}
              disabled={selectedDate >= todayKey}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              翌日 →
            </button>
            {selectedDate !== todayKey && (
              <button
                type="button"
                onClick={() => goToDate(todayKey)}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                今日に戻る
              </button>
            )}
          </div>
        )}
      </div>

      {displayedRows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          {isSearching ? "該当する取引が見つかりません。" : "この日の取引はありません。"}
        </p>
      ) : (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">日時</th>
              <th className="px-4 py-2 font-medium">客</th>
              <th className="px-4 py-2 font-medium">種別</th>
              <th className="px-4 py-2 font-medium">額面</th>
              <th className="px-4 py-2 font-medium">枚数</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedRows.map(({ tx, customerName, denominationLabel }) => {
              return (
                <tr key={tx.id}>
                  <td className="px-4 py-2 text-gray-500">
                    <details className="group">
                      <summary className="cursor-pointer list-none hover:underline">
                        {new Date(tx.created_at).toLocaleString("ja-JP")}
                      </summary>
                      <form
                        action={updateTransactionDate}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={tx.id} />
                        <input type="hidden" name="customerId" value={tx.customer_id} />
                        <input
                          type="datetime-local"
                          name="createdAt"
                          defaultValue={toJstDatetimeLocal(tx.created_at)}
                          required
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                        />
                        <SubmitButton className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                          更新
                        </SubmitButton>
                      </form>
                    </details>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/customers/${tx.customer_id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 ${CATEGORY_INFO[tx.category].badgeClassName}`}
                    >
                      {CATEGORY_INFO[tx.category].label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-900">{denominationLabel ?? "-"}</td>
                  <td className="px-4 py-2 text-gray-900">
                    {tx.quantity} {quantityUnitLabel(tx.category)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <input type="hidden" name="customerId" value={tx.customer_id} />
                      <ConfirmSubmitButton
                        confirmMessage="この取引を削除しますか？保有枚数の計算からも取り除かれます。"
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
