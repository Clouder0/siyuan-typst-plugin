class SimpleHash {
  /**
   * Hashes an input string or Buffer using the specified algorithm.
   * @param {string | Buffer} input The data to hash.
   * @param {'djb2' | 'fnv1a'} [algorithm='djb2'] The hashing algorithm to use.
   * @returns {number} A 32-bit unsigned integer hash.
   */
  static hash(input: any, algorithm: "djb2" | "fnv1a" = "djb2"): number {
    switch (algorithm) {
      case "fnv1a":
        return SimpleHash.fnv1a(input);
      case "djb2":
      default:
        return SimpleHash.djb2(input);
    }
  }

  /**
   * Implements the djb2 hash algorithm.
   * Extremely simple and fast with decent distribution.
   * See: http://www.cse.yorku.ca/~oz/hash.html
   *
   * @param {string | Buffer} input The string or Buffer to hash.
   * @returns {number} A 32-bit unsigned integer hash.
   */
  static djb2(input: string | number[]): number {
    // The magic starting number for djb2
    let hash = 5381;
    const len = input.length;

    if (typeof input === "string") {
      for (let i = 0; i < len; i++) {
        // Equivalent to: hash = (hash * 33) + input.charCodeAt(i)
        // The bit-shift version is often faster.
        hash = (hash << 5) + hash + input.charCodeAt(i);
        // Coerce to a 32-bit integer
        hash |= 0;
      }
    } else if (Buffer.isBuffer(input)) {
      for (let i = 0; i < len; i++) {
        hash = (hash << 5) + hash + input[i];
        hash |= 0;
      }
    } else {
      throw new TypeError("Input must be a string or a Buffer.");
    }

    // Ensure the final result is an unsigned 32-bit integer
    return hash >>> 0;
  }

  /**
   * Implements the 32-bit FNV-1a hash algorithm.
   * Known for excellent distribution properties.
   * See: http://www.isthe.com/chongo/tech/comp/fnv/
   *
   * @param {string | Buffer} input The string or Buffer to hash.
   * @returns {number} A 32-bit unsigned integer hash.
   */
  static fnv1a(input: string | number[]): number {
    // FNV-1a 32-bit constants
    const FNV_PRIME = 16777619;
    const FNV_OFFSET_BASIS = 2166136261;

    let hash = FNV_OFFSET_BASIS;
    const len = input.length;

    if (typeof input === "string") {
      for (let i = 0; i < len; i++) {
        // XOR the hash with the current byte
        hash ^= input.charCodeAt(i);

        // Multiply by the FNV prime.
        // Using Math.imul for 32-bit integer multiplication
        hash = Math.imul(hash, FNV_PRIME);
      }
    } else if (Buffer.isBuffer(input)) {
      for (let i = 0; i < len; i++) {
        hash ^= input[i];
        hash = Math.imul(hash, FNV_PRIME);
      }
    } else {
      throw new TypeError("Input must be a string or a Buffer.");
    }

    // Ensure the final result is an unsigned 32-bit integer
    return hash >>> 0;
  }
}
export default SimpleHash;
