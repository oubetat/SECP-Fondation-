/**
 * PATCH-SECP-066: Maintenance Asset Registry Engine
 * Links SECP-065 asset identity with maintenance context.
 */

import { AssetIdentity } from '../asset-reliability/AssetReliabilityTypes';
import { MaintenanceAsset } from './MaintenanceGovernanceTypes';

export class MaintenanceAssetRegistryEngine {
  public static mapToMaintenance(asset: AssetIdentity, reliabilityRef: string, state: any): MaintenanceAsset {
    if (!asset.assetId) throw new Error('Invalid SECP-065 Asset Reference');
    
    return {
      assetId: asset.assetId,
      machineId: asset.serialNumber,
      assetType: asset.type,
      configurationVersion: asset.configurationVersion,
      currentHealthState: state,
      reliabilityReference: reliabilityRef
    };
  }
}
