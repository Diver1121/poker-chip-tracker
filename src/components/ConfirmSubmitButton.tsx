"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
  formAction,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
  // 共有フォーム内で、このボタンだけ既定のactionと違うServer Actionを呼びたい場合に使う
  // （例: 行ごとの削除ボタンを「まとめて保存」フォームの中に同居させる）
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "処理中…" : children}
    </button>
  );
}
