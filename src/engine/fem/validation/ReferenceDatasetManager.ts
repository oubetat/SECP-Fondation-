import { ReferenceDataset } from "./types";

export class ReferenceDatasetManager {
  /**
   * Generates a deterministic hash for dataset integrity verification.
   */
  public static hashDataset(data: any): string {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    let hashVal = 0;
    for (let i = 0; i < raw.length; i++) {
      hashVal = ((hashVal << 5) - hashVal) + raw.charCodeAt(i);
      hashVal |= 0;
    }
    return Math.abs(hashVal).toString(16).padStart(8, '0');
  }

  /**
   * Validates dataset integrity against its stored hash.
   */
  public static verifyIntegrity(dataset: ReferenceDataset): boolean {
    const currentHash = this.hashDataset(dataset.data);
    return currentHash === dataset.rawDataHash;
  }

  /**
   * Locks a dataset by generating its metadata hash.
   */
  public static lockDataset(dataset: ReferenceDataset): string {
    return this.hashDataset({
      id: dataset.datasetId,
      version: dataset.datasetVersion,
      contentHash: dataset.rawDataHash
    });
  }
}
