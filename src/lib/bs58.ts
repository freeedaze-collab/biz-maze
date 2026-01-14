
// src/lib/bs58.ts
// Lightweight Base58 implementation for Solana address validation and signature encoding.
// Standard Base58 alphabet
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET.charAt(i)] = i;
}

export function encode(source: Uint8Array | number[]): string {
  if (source.length === 0) return "";
  const digits = [0];
  for (let i = 0; i < source.length; i++) {
    let carry = source[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  
  let string = "";
  // Adhere to Base58 leading zero convention
  for (let i = 0; i < source.length && source[i] === 0; i++) {
    string += ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    string += ALPHABET[digits[i]];
  }
  return string;
}

export function decode(string: string): Uint8Array {
  if (string.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < string.length; i++) {
    let carry = ALPHABET_MAP[string[i]];
    if (carry === undefined) throw new Error("Non-base58 character");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  
  // Adhere to Base58 leading zero convention
  const result = [];
  for (let i = 0; i < string.length && string[i] === ALPHABET[0]; i++) {
    result.push(0);
  }
  for (let i = bytes.length - 1; i >= 0; i--) {
    result.push(bytes[i]);
  }
  return new Uint8Array(result);
}
