"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  cancelChatCommand,
  recordChatTransaction,
  type ChatCommandState,
} from "@/app/(app)/chat/actions";

type ChatEntry = {
  id: string;
  kind: "user" | "reply";
  text: string;
  ok?: boolean;
  warning?: boolean;
  commandId?: string;
  transactionId?: string;
  cancelled?: boolean;
  senderName?: string;
};

export function ChatCommandInput({
  initialHistory = [],
  currentUserName = "",
}: {
  initialHistory?: ChatEntry[];
  currentUserName?: string;
}) {
  const [state, formAction, pending] = useActionState<ChatCommandState, FormData>(
    recordChatTransaction,
    null,
  );
  const [history, setHistory] = useState<ChatEntry[]>(initialHistory);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const commandIdInputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const lastHandledState = useRef<ChatCommandState>(null);

  // サーバーアクションの結果が更新されたら、返信の吹き出しとして履歴に積む
  useEffect(() => {
    if (!state || state === lastHandledState.current) return;
    lastHandledState.current = state;
    setHistory((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "reply",
        text: state.message,
        ok: state.ok,
        warning: state.warning,
        commandId: state.commandId,
      },
    ]);
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const value = new FormData(e.currentTarget).get("text");
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return;
    const commandId = crypto.randomUUID();
    if (commandIdInputRef.current) {
      commandIdInputRef.current.value = commandId;
    }
    setHistory((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: "user", text, commandId, senderName: currentUserName },
    ]);
  }

  async function handleCancel(commandId: string) {
    if (!confirm("この登録を取り消しますか？残高からも取り除かれます。")) return;
    setCancellingId(commandId);
    try {
      await cancelChatCommand(commandId);
      setHistory((prev) =>
        prev.map((entry) =>
          entry.commandId === commandId ? { ...entry, cancelled: true } : entry,
        ),
      );
    } finally {
      setCancellingId(null);
    }
  }

  const awaitingReply = pending && history.at(-1)?.kind === "user";

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-gray-200 bg-[#8bc9c0]/20">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {history.length === 0 && (
          <p className="mt-4 text-center text-sm text-gray-500">
            例: 「ダイバー　購入300」「OCEAN 300バイイン」「ダイバー トーナメントターボ」
          </p>
        )}
        {history.map((entry) =>
          entry.kind === "user" ? (
            <div key={entry.id} className="flex flex-col items-end">
              {entry.senderName && (
                <p className="mb-0.5 pr-1 text-xs text-gray-400">{entry.senderName}</p>
              )}
              <div
                className={`max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                  entry.cancelled
                    ? "bg-gray-300 text-gray-500 line-through"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {entry.text}
              </div>
            </div>
          ) : (
            <div key={entry.id} className="flex justify-start">
              <div className="max-w-[75%] space-y-1">
                {entry.senderName && (
                  <p className="pl-1 text-xs text-gray-400">{entry.senderName}</p>
                )}
                <div
                  className={`rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                    entry.cancelled
                      ? "bg-gray-100 text-gray-400 line-through"
                      : !entry.ok
                        ? "bg-red-50 text-red-700"
                        : entry.warning
                          ? "bg-amber-50 font-medium text-amber-800"
                          : "bg-white text-gray-800"
                  }`}
                >
                  {entry.text}
                </div>
                {entry.cancelled && (
                  <p className="pl-1 text-xs text-gray-400">取消済み</p>
                )}
                {!entry.cancelled && entry.ok && entry.transactionId && entry.commandId && (
                  <button
                    type="button"
                    onClick={() => handleCancel(entry.commandId!)}
                    disabled={cancellingId === entry.commandId}
                    className="pl-1 text-xs text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    {cancellingId === entry.commandId ? "取消中…" : "この登録を取消"}
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        {awaitingReply && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm text-gray-400 shadow-sm">
              …
            </div>
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-gray-200 bg-white p-3"
      >
        <input ref={commandIdInputRef} type="hidden" name="commandId" />
        <input
          type="text"
          name="text"
          required
          placeholder="例: ダイバー　購入300"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </div>
  );
}
