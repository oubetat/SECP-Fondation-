/**
 * SECP Industrial OS — Hash Utility
 * Provides a portable hash function that works in both Node.js and Browser/Vitest environments.
 * Replaces dependencies on Node.js 'crypto' module for simple integrity checks.
 */

export class HashUtility {
  /**
   * Simple non-cryptographic hash function (Murmur-inspired or similar)
   * Suitable for deterministic execution checks and result stable identification.
   */
  public static computeHash(content: string): string {
    let hash = 0;
    if (content.length === 0) return '0';
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    
    // Return positive hex string
    const unsignedHash = hash >>> 0;
    return unsignedHash.toString(16).padStart(8, '0');
  }

  /**
   * Mock for crypto.createHash('sha256') for transition.
   */
  public static sha256(content: string): string {
     return this.computeHash(content);
  }
}
