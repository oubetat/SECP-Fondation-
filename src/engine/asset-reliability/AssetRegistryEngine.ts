/**
 * PATCH-SECP-065: Asset Registry Engine
 * Manages manufacturing machine identities and configurations.
 */

import { AssetIdentity } from './AssetReliabilityTypes';

export class AssetRegistryEngine {
  public static registerAsset(identity: AssetIdentity): AssetIdentity {
    if (!identity.assetId || identity.assetId.length < 4) {
      throw new Error('Invalid Asset ID: Must be at least 4 characters.');
    }
    return { ...identity };
  }

  public static updateConfiguration(asset: AssetIdentity, newVersion: string): AssetIdentity {
    return {
      ...asset,
      configurationVersion: newVersion
    };
  }
}
