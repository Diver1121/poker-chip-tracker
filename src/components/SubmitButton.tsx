"use client";

import { useFormStatus } from "react-dom";

// フォーム送信中はボタンを無効化して連打を防ぐ（反映が遅れて見えても、
// 二重送信で取引が重複登録されるのを防ぐのが目的）。
export function SubmitButton({
  children,
  pendingText = "処理中…",
  disabled = false,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingText : children}
    </button>
  );
}
