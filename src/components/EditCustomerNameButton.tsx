"use client";

import { useState } from "react";
import { updateCustomerName } from "@/app/(app)/customers/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function EditCustomerNameButton({
  customerId,
  currentName,
}: {
  customerId: string;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        名前を編集
      </button>
    );
  }

  return (
    <form action={updateCustomerName} className="flex items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <input
        name="name"
        defaultValue={currentName}
        required
        autoFocus
        autoComplete="off"
        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      <SubmitButton className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        保存
      </SubmitButton>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-gray-500 hover:underline"
      >
        キャンセル
      </button>
    </form>
  );
}
