/** No look-alikes (0/O, 1/l/I) so a printed password is easy to read and type. 31 characters. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A random staff password like "kq7m-3tzp-9hwx": 12 characters (about 59 bits) from the secure
 * random generator (browser and Node). Bytes that would make some characters likelier are skipped.
 */
export function generatePassword(): string {
  const limit = 256 - (256 % ALPHABET.length); // largest multiple of 31 that fits in a byte
  const chars: string[] = [];
  while (chars.length < 12) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < limit && chars.length < 12) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}
