"use client";

import { useState } from "react";
import {
  linkMemberToApp,
  resetMemberPassword,
  unlinkMember,
} from "@/app/(app)/customers/ocean-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { OceanMember } from "@/lib/data";

export function OceanMemberLink({
  customerId,
  oceanMember,
}: {
  customerId: string;
  oceanMember: OceanMember | null;
}) {
  const [showForm, setShowForm] = useState(false);

  if (!oceanMember) {
    if (!showForm) {
      return (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
        >
          アプリに紐付け
        </button>
      );
    }
    return (
      <form action={linkMemberToApp} className="flex items-center gap-2">
        <input type="hidden" name="customerId" value={customerId} />
        <input
          name="phone"
          placeholder="09012345678"
          required
          autoFocus
          autoComplete="off"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
        />
        <SubmitButton className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          連携する
        </SubmitButton>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          キャンセル
        </button>
      </form>
    );
  }

  if (!oceanMember.password_hash) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">
          アプリ連携済み（{oceanMember.phone}）— パスワード未設定
        </span>
        <form action={unlinkMember}>
          <input type="hidden" name="customerId" value={customerId} />
          <ConfirmSubmitButton
            confirmMessage="連携を取り消しますか？お客様はまだアプリを使い始めていません。"
            className="text-xs text-red-600 hover:underline"
          >
            連携を取り消す
          </ConfirmSubmitButton>
        </form>
      </div>
    );
  }

  return (
    <form action={resetMemberPassword}>
      <input type="hidden" name="customerId" value={customerId} />
      <ConfirmSubmitButton
        confirmMessage="パスワードをリセットしますか？お客様は次回アプリで新しいパスワードを設定する必要があり、現在のログインも解除されます。"
        className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        連携済み — パスワードをリセット
      </ConfirmSubmitButton>
    </form>
  );
}
