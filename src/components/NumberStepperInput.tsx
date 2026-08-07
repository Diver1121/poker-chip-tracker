"use client";

import { useRef } from "react";

// スマホのtype="number"はブラウザ標準の△▽（スピンボタン）が出ないため、
// PCと同じ感覚で使えるよう自前の△▽ボタンを入力欄の右端に重ねて表示する。
// 常時表示だと表が窮屈な上にタップ領域が小さくて押しづらいため、入力欄に
// フォーカスしている間だけ表示する（タップ→フォーカス→ボタン出現）。
export function NumberStepperInput({
  name,
  defaultValue,
  placeholder,
  className,
  min = 0,
  step = 1,
}: {
  name: string;
  defaultValue?: number | string;
  placeholder?: string;
  className?: string;
  min?: number;
  step?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function bump(delta: number) {
    const el = inputRef.current;
    if (!el) return;
    const next = (Number(el.value) || 0) + delta;
    el.value = String(Math.max(min, next));
  }

  return (
    <div className="group relative">
      <input
        ref={inputRef}
        name={name}
        type="number"
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`number-stepper-input ${className ?? ""}`}
        style={{ paddingRight: "1rem" }}
      />
      <div className="invisible absolute inset-y-0 right-0 flex w-6 flex-col overflow-hidden rounded-r-md border-l border-gray-300 bg-white opacity-0 shadow-sm transition-opacity group-focus-within:visible group-focus-within:opacity-100">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(step)}
          className="flex-1 bg-gray-50 text-[10px] leading-none text-gray-500 hover:bg-gray-200 active:bg-gray-300"
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(-step)}
          className="flex-1 border-t border-gray-300 bg-gray-50 text-[10px] leading-none text-gray-500 hover:bg-gray-200 active:bg-gray-300"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
