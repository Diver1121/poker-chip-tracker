"use client";

import { useState } from "react";
import { normalizeForMatch } from "@/lib/textMatch";

// 来店ボードのCustomerCombobox相当だが、この表専用に調整したもの:
// ・空欄でも送信できる（40行のうち大半は未入力のため required にできない）
// ・全行で1つの共有datalistを使い回す（TournamentNameDatalistSyncが候補を絞り込む）
// ・入力文字列と客一覧を照合し、一致すればhidden欄で客IDも一緒に送信する
//   （一致した行だけ、保存時にchip_transactionsが作られる）
export function TournamentCustomerInput({
  rowIndex,
  customers,
  defaultText,
  datalistId,
  className,
}: {
  rowIndex: number;
  customers: { id: string; name: string }[];
  defaultText: string;
  datalistId: string;
  className?: string;
}) {
  const [text, setText] = useState(defaultText);
  const match = customers.find((c) => normalizeForMatch(c.name) === normalizeForMatch(text));

  return (
    <>
      <input
        name={`name-${rowIndex}`}
        list={datalistId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        className={className}
      />
      <input type="hidden" name={`customerId-${rowIndex}`} value={match?.id ?? ""} />
    </>
  );
}
