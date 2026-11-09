/**
 * SECP Industrial OS — Domain Binding Test Utility
 * 
 * Provides helpers for existing test batteries to comply with the 
 * Canonical Domain Binding architecture using the internal authority boundary.
 */

import { CanonicalDomainBindingEngine } from './CanonicalDomainBindingEngine';
import { 
  PcbToCoreBinding, 
  ElectricalToCoreBinding, 
  FemToCoreBinding, 
  CfdToCoreBinding, 
  HarnessToCoreBinding 
} from './CanonicalDomainBinding';
import { SealingCapability, issueSealingCapability } from '../simulation/SimulationSealingAuthorization';

export class DomainBindingTestUtility {
  private static readonly testCapability: SealingCapability = issueSealingCapability(
    'DOMAIN_BINDING_TEST_UTILITY',
    ['PCB', 'ELECTRICAL', 'FEM', 'CFD', 'WIRING_HARNESS']
  );

  public static createSealedPcbBinding(model: any): PcbToCoreBinding {
    const binding = CanonicalDomainBindingEngine.createBinding(
      'PCB', 
      model.designId || 'TEST-PCB', 
      model.revisionId || 'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as PcbToCoreBinding;
    return CanonicalDomainBindingEngine.sealBinding(binding, DomainBindingTestUtility.testCapability);
  }

  public static createSealedElectricalBinding(model: any): ElectricalToCoreBinding {
    const binding = CanonicalDomainBindingEngine.createBinding(
      'ELECTRICAL', 
      model.id || 'TEST-ELEC', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as ElectricalToCoreBinding;
    return CanonicalDomainBindingEngine.sealBinding(binding, DomainBindingTestUtility.testCapability);
  }

  public static createSealedFemBinding(model: any): FemToCoreBinding {
    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 
      'TEST-FEM', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as FemToCoreBinding;
    return CanonicalDomainBindingEngine.sealBinding(binding, DomainBindingTestUtility.testCapability);
  }

  public static createSealedCfdBinding(mesh: any, fluid: any): CfdToCoreBinding {
    const meshProv = mesh?.provenance || mesh?.meshProvenance;
    const geomHash = meshProv?.sourceGeometryHash || 'geo-hash';
    const revHash = meshProv?.sourceRevisionHash !== undefined ? String(meshProv.sourceRevisionHash) : 'REV-TEST';
    const topoHash = meshProv?.bRepHash || 'topo-hash';

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD', 
      'TEST-CFD', 
      revHash, 
      { mesh, fluid }, 
      geomHash, topoHash, 'mat-hash', 'env-hash', 'phys-hash'
    ) as CfdToCoreBinding;
    return CanonicalDomainBindingEngine.sealBinding(binding, DomainBindingTestUtility.testCapability);
  }

  public static createSealedHarnessBinding(model: any): HarnessToCoreBinding {
    const binding = CanonicalDomainBindingEngine.createBinding(
      'WIRING_HARNESS', 
      model.id || 'TEST-WH', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as HarnessToCoreBinding;
    return CanonicalDomainBindingEngine.sealBinding(binding, DomainBindingTestUtility.testCapability);
  }
}

