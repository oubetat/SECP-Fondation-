/**
 * SECP CAD Kernel — Revision Utilities
 */

export class RevisionUtils {
  /**
   * Deterministic Revision Code derivation:
   * Maps numeric revision (1, 2, 3...) to standard alphanumeric engineering revisions (REV-A, REV-B, REV-C...).
   */
  public static deriveRevisionCode(revision: number | string | undefined | null): string {
    if (revision === undefined || revision === null) return 'REV-A';
    if (typeof revision === 'string') {
      if (revision.startsWith('REV-')) return revision;
      // Handle string numbers like "1"
      const num = parseInt(revision, 10);
      if (!isNaN(num) && String(num) === revision) {
        return this.deriveRevisionCode(num);
      }
      return `REV-${revision}`;
    }
    if (typeof revision === 'number') {
      if (revision >= 1 && revision <= 26) {
        return `REV-${String.fromCharCode(64 + revision)}`;
      }
      return `REV-${revision}`;
    }
    return 'REV-A';
  }
}
