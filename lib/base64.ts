// Base64

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET[i]] = i;

/* Decode */
export function base64ToArrayBuffer(input: string): ArrayBuffer {
  const clean = input.replace(/^data:[^;]+;base64,/, "").replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean[i]];
    const b = LOOKUP[clean[i + 1]];
    const c = i + 2 < clean.length ? LOOKUP[clean[i + 2]] : 0;
    const d = i + 3 < clean.length ? LOOKUP[clean[i + 3]] : 0;
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = (chunk >> 16) & 255;
    if (i + 2 < clean.length && out < bytes.length) bytes[out++] = (chunk >> 8) & 255;
    if (i + 3 < clean.length && out < bytes.length) bytes[out++] = chunk & 255;
  }
  return bytes.buffer;
}
