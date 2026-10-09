/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Rollback Manager
 */

export class TransientRollbackManager<T> {
  private previousState: T | null = null;
  private previousHash: string = '';

  public saveState(state: T, hash: string): void {
    // Deep clone or reference-lock the state
    this.previousState = JSON.parse(JSON.stringify(state));
    this.previousHash = hash;
  }

  public rollback(currentHash: string): { state: T; hash: string } {
    if (!this.previousState) {
      throw new Error(`ROLLBACK_CORRUPTION: No rollback state exists to restore.`);
    }
    return {
      state: this.previousState,
      hash: this.previousHash
    };
  }
}
