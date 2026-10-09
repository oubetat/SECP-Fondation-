import { AssetIdentity } from './AssetReliabilityTypes';

export class AssetRegistryEngine {
  public static registerAsset(params: {
    assetId: string;
    name: string;
    type: string;
    manufacturer: string;
    serialNumber: string;
    commissioningDate: string;
    configurationVersion: string;
  }): AssetIdentity {
    return {
      assetId: params.assetId,
      name: params.name,
      type: params.type,
      manufacturer: params.manufacturer,
      serialNumber: params.serialNumber,
      commissioningDate: params.commissioningDate,
      configurationVersion: params.configurationVersion
    };
  }
}
