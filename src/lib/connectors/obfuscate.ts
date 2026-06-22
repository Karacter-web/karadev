// Lightweight reversible obfuscation for credentials stored in the DB.
// NOT real encryption — it only prevents casual at-rest plaintext exposure.
// True secret storage should use a server-side vault.

const PREFIX = "obf_v1:";

export function obfuscate(value: string): string {
  if (!value) return value;
  if (value.startsWith(PREFIX)) return value;
  const reversed = value.split("").reverse().join("");
  const b64 = typeof btoa !== "undefined" ? btoa(reversed) : Buffer.from(reversed, "utf-8").toString("base64");
  return PREFIX + b64;
}

export function deobfuscate(value: string): string {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value;
  const b64 = value.slice(PREFIX.length);
  const decoded = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf-8");
  return decoded.split("").reverse().join("");
}