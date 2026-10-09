/**
 * SECP Progressive Geometry Streaming Engine
 * Implements "Metadata-First" loading to prevent 4GB lock-ups.
 * Priority: Metadata -> Bounding Boxes -> Visible Lod0 -> Background Lod3
 */

export enum StreamState {
  PENDING = 'PENDING',
  METADATA_LOADED = 'METADATA_LOADED',
  PROXIES_READY = 'PROXIES_READY', // Bounding boxes / Proxies
  STREAMING = 'STREAMING',
  COMPLETE = 'COMPLETE'
}

export interface StreamProgress {
  state: StreamState;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  visiblePartsLoaded: number;
  totalParts: number;
  gpuMemoryUsageMb: number;
}

export class GeometryStreamer {
  private totalAssemblySize: number = 4294967296; // Simulated 4GB
  private loadedBytes: number = 0;
  private totalParts: number = 12600;

  /**
   * Simulates a progressive load tick
   */
  public static getNextStreamState(current: StreamProgress): StreamProgress {
    if (current.state === StreamState.COMPLETE) return current;

    let newState: StreamState = current.state;
    let newLoaded = current.loadedBytes;
    let newParts = current.visiblePartsLoaded;

    switch (current.state) {
      case StreamState.PENDING:
        newState = StreamState.METADATA_LOADED;
        newLoaded = 1024 * 512; // 512KB metadata
        break;
      case StreamState.METADATA_LOADED:
        newState = StreamState.PROXIES_READY;
        newLoaded += 1024 * 1024 * 5; // 5MB proxies
        break;
      case StreamState.PROXIES_READY:
        newState = StreamState.STREAMING;
        newLoaded += 1024 * 1024 * 150; 
        newParts = Math.floor(current.totalParts * 0.15);
        break;
      case StreamState.STREAMING:
        newLoaded += 1024 * 1024 * 400;
        newParts += Math.floor(current.totalParts * 0.2);
        if (newLoaded >= 4294967296) {
          newLoaded = 4294967296;
          newParts = current.totalParts;
          newState = StreamState.COMPLETE;
        }
        break;
    }

    const percentage = Number(((newLoaded / 4294967296) * 100).toFixed(1));
    const gpuMem = Number(((newLoaded / (1024 * 1024)) * 0.8).toFixed(1)); // 80% compression on GPU

    return {
      state: newState,
      loadedBytes: newLoaded,
      totalBytes: 4294967296,
      percentage,
      visiblePartsLoaded: newParts,
      totalParts: current.totalParts,
      gpuMemoryUsageMb: gpuMem
    };
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
