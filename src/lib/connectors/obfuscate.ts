// Lightweight reversible obfuscation for credentials stored in the DB.
// NOT real encryption — it only prevents casual at-rest plaintext exposure.
// True secret storage should use a server-side vault.

const PREFIX = "obf_v1:";

export function obfuscate(value: string): string {
  if (!value) return value;
  if (value.startsWith(PREFIX)) return value;
  const reversed = value.split("").reverse().join("");
  return PREFIX + btoa(reversed);
}

export function deobfuscate(value: string): string {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value;
  const decoded = atob(value.slice(PREFIX.length));
  return decoded.split("").reverse().join("");
}