"use client";

import { useFormStatus } from "react-dom";

// フォーム送信中はボタンを無効化して連打を防ぐ（反映が遅れて見えても、
// 二重送信で取引が重複登録されるのを防ぐのが目的）。
export function SubmitButton({
  children,
  pendingText = "処理中…",
  disabled = false,
  className,
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
  // 共有フォーム内で、このボタンだけ別のサーバーアクションを呼びたい場合に指定する
  // （例: 行ごとの保存ボタンを「まとめて保存」と同じフォームに同居させる）
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingText : children}
    </button>
  );
}
