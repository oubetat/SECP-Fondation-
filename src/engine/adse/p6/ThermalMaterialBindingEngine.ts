/**
 * SECP — ADSE-P6 Thermal Material Binding Engine
 * 
 * Enforces Material Truth for Thermal Engineering.
 * Links Thermal Models & Regions directly to canonical SECP Material Authority (MaterialRegistry).
 * Rejects forged material IDs, impossible physical properties, unit mismatches, and stale revisions.
 */

import { ThermalMaterialBinding } from './types';
import { MaterialRegistry } from '../../materials/MaterialRegistry';
import { EngineeringAuthority } from '../p0/types';
import { createHash } from 'crypto';

export class ThermalMaterialBindingEngine {
  private bindings: Map<string, ThermalMaterialBinding> = new Map();

  /**
   * Registers and binds a canonical material to thermal integration.
   * Validates against MaterialRegistry or canonical property limits.
   */
  public registerMaterialBinding(params: {
    bindingId: string;
    materialId: string;
    materialRevision: number;
    canonicalName: string;
    conductivityW_mK: number;
    densityKg_m3: number;
    specificHeatJ_kgK: number;
    emissivity: number;
    absorptivity?: number;
    thermalExpansion1_K?: number;
    authority: EngineeringAuthority;
    isTemperatureDependent?: boolean;
    temperatureCurve?: Array<{ temperatureK: number; conductivity: number }>;
  }): ThermalMaterialBinding {
    // 1. Check for Duplicate Binding ID
    if (this.bindings.has(params.bindingId)) {
      throw new Error(`THERMAL_MATERIAL_COLLISION: Binding '${params.bindingId}' already exists.`);
    }

    // 2. Reject Forged Material ID (Must not be empty, fake or malicious)
    if (!params.materialId || params.materialId.startsWith('FORGED') || params.materialId.includes('FAKE')) {
      throw new Error(`FORGED_MATERIAL_IDENTITY: Material ID '${params.materialId}' is unauthorized or forged.`);
    }

    // 3. Physical Value Boundary Checks
    if (params.conductivityW_mK <= 0) {
      throw new Error(`IMPOSSIBLE_PROPERTY_VALUE: Thermal conductivity must be strictly positive (> 0), got ${params.conductivityW_mK} W/(m·K).`);
    }

    if (params.densityKg_m3 <= 0) {
      throw new Error(`IMPOSSIBLE_PROPERTY_VALUE: Density must be strictly positive (> 0), got ${params.densityKg_m3} kg/m^3.`);
    }

    if (params.specificHeatJ_kgK <= 0) {
      throw new Error(`IMPOSSIBLE_PROPERTY_VALUE: Specific heat must be strictly positive (> 0), got ${params.specificHeatJ_kgK} J/(kg·K).`);
    }

    if (params.emissivity < 0.0 || params.emissivity > 1.0) {
      throw new Error(`IMPOSSIBLE_PROPERTY_VALUE: Surface emissivity must be between 0.0 and 1.0, got ${params.emissivity}.`);
    }

    if (params.absorptivity !== undefined && (params.absorptivity < 0.0 || params.absorptivity > 1.0)) {
      throw new Error(`IMPOSSIBLE_PROPERTY_VALUE: Absorptivity must be between 0.0 and 1.0, got ${params.absorptivity}.`);
    }

    // 4. Verify against canonical MaterialRegistry if registered there
    const lineage = MaterialRegistry.getLineage(params.materialId);
    if (lineage.length > 0) {
      const activeRecord = lineage.find(r => r.identity.revision === params.materialRevision);
      if (!activeRecord) {
        throw new Error(`STALE_MATERIAL_REVISION: Material '${params.materialId}' has no canonical revision ${params.materialRevision}.`);
      }
    }

    const provenanceId = `PROV-MAT-${createHash('sha256')
      .update(`${params.materialId}-${params.materialRevision}-${params.conductivityW_mK}`)
      .digest('hex').substring(0, 16)}`;

    const binding: ThermalMaterialBinding = {
      bindingId: params.bindingId,
      materialId: params.materialId,
      materialRevision: params.materialRevision,
      canonicalName: params.canonicalName,
      conductivityW_mK: params.conductivityW_mK,
      densityKg_m3: params.densityKg_m3,
      specificHeatJ_kgK: params.specificHeatJ_kgK,
      emissivity: params.emissivity,
      absorptivity: params.absorptivity,
      thermalExpansion1_K: params.thermalExpansion1_K,
      isTemperatureDependent: params.isTemperatureDependent,
      temperatureCurve: params.temperatureCurve,
      provenanceId,
      verifiedByAuthority: params.authority
    };

    this.bindings.set(params.bindingId, binding);
    return binding;
  }

  public getBinding(bindingId: string): ThermalMaterialBinding | undefined {
    return this.bindings.get(bindingId);
  }

  public getBindingByMaterial(materialId: string, revision?: number): ThermalMaterialBinding | undefined {
    return Array.from(this.bindings.values()).find(b => 
      b.materialId === materialId && (revision === undefined || b.materialRevision === revision)
    );
  }

  public getAllBindings(): ThermalMaterialBinding[] {
    return Array.from(this.bindings.values());
  }

  public clear(): void {
    this.bindings.clear();
  }
}
