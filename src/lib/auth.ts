export const SESSION_COOKIE_NAME = "chip_tracker_session";

const SESSION_KIND = "authenticated";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toHex(signature);
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

// ログイン時に入力した名前（チャットの送信者表示に使う）をペイロードに含めて署名する。
export async function createSessionCookieValue(name: string) {
  const payload = `${SESSION_KIND}:${encodeURIComponent(name)}`;
  const signature = await sign(getSessionSecret(), payload);
  return `${payload}.${signature}`;
}

// nameにドットが含まれても壊れないよう、最後のドットで payload と signature を分ける
function splitPayloadAndSignature(value: string): [string, string] | null {
  const index = value.lastIndexOf(".");
  if (index === -1) return null;
  return [value.slice(0, index), value.slice(index + 1)];
}

async function verify(value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const parts = splitPayloadAndSignature(value);
  if (!parts) return null;
  const [payload, signature] = parts;
  if (!payload.startsWith(`${SESSION_KIND}:`) || !signature) return null;

  const expected = await sign(getSessionSecret(), payload);
  if (signature.length !== expected.length) return null;
  // 定数時間比較（タイミング攻撃対策）
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return decodeURIComponent(payload.slice(SESSION_KIND.length + 1));
}

export async function isValidSessionCookie(value: string | undefined | null) {
  return (await verify(value)) !== null;
}

// 有効なセッションなら、ログイン時に入力した名前を返す（チャットの送信者表示用）
export async function getSessionName(value: string | undefined | null) {
  return verify(value);
}

export function checkPassword(password: string) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    throw new Error("APP_PASSWORD is not set");
  }
  return password === appPassword;
}
