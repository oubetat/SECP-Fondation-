import { ContactPointState } from "./types";

export class ContactStateHasher {
  /**
   * Generates a deterministic SHA-256 or numeric hash string for a contact state.
   */
  static computeStateHash(pairId: string, pointStates: ContactPointState[]): string {
    const sortedStates = [...pointStates].sort((a, b) => a.pointId.localeCompare(b.pointId));

    const content = sortedStates.map(s => 
      `${s.pointId}:${s.gap.toFixed(8)}:${s.normal.map(n => n.toFixed(8)).join(',')}:${s.contactPressure.toFixed(8)}:${s.status}`
    ).join('|');

    const rawString = `${pairId}#${content}`;

    return this.hashString(rawString);
  }

  private static hashString(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    const hex = hash.toString(16).padStart(8, '0');
    return `SHA256_MOCK_${hex}`;
  }
}
