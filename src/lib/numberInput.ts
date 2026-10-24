// type="number"の入力欄にIME入力中の全角数字が混ざると、ブラウザ側のサニタイズで
// 値が黒子ごと空文字になり、見た目に数字が入っていても送信時には何も入っていない
// ことがある（トーナメントの入力でNAMEは反映されるのに数値欄だけ消える不具合の原因）。
// 全角数字を半角に変換し、数字以外の文字を取り除くことで、IME経由の入力でも
// 値を失わないようにする。

const FULLWIDTH_DIGITS = "０１２３４５６７８９";

export function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (c) => String(FULLWIDTH_DIGITS.indexOf(c)));
}

export function sanitizeDigitsInput(value: string): string {
  return toHalfWidthDigits(value).replace(/[^0-9]/g, "");
}
