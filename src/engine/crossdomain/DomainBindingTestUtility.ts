/**
 * SECP Industrial OS — Domain Binding Test Utility
 * 
 * Provides helpers for existing test batteries to comply with the 
 * Canonical Domain Binding architecture without excessive boilerplate.
 */

import { CanonicalDomainBindingEngine } from './CanonicalDomainBindingEngine';
import { 
  PcbToCoreBinding, 
  ElectricalToCoreBinding, 
  FemToCoreBinding, 
  CfdToCoreBinding, 
  HarnessToCoreBinding 
} from './CanonicalDomainBinding';

export class DomainBindingTestUtility {
  public static createSealedPcbBinding(model: any): PcbToCoreBinding {
    return CanonicalDomainBindingEngine.createBinding(
      'PCB', 
      model.designId || 'TEST-PCB', 
      model.revisionId || 'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as PcbToCoreBinding;
  }

  public static createSealedElectricalBinding(model: any): ElectricalToCoreBinding {
    return CanonicalDomainBindingEngine.createBinding(
      'ELECTRICAL', 
      model.id || 'TEST-ELEC', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as ElectricalToCoreBinding;
  }

  public static createSealedFemBinding(model: any): FemToCoreBinding {
    return CanonicalDomainBindingEngine.createBinding(
      'FEM', 
      'TEST-FEM', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as FemToCoreBinding;
  }

  public static createSealedCfdBinding(mesh: any, fluid: any): CfdToCoreBinding {
    return CanonicalDomainBindingEngine.createBinding(
      'CFD', 
      'TEST-CFD', 
      'REV-TEST', 
      { mesh, fluid }, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as CfdToCoreBinding;
  }

  public static createSealedHarnessBinding(model: any): HarnessToCoreBinding {
    return CanonicalDomainBindingEngine.createBinding(
      'WIRING_HARNESS', 
      model.id || 'TEST-WH', 
      'REV-TEST', 
      model, 
      'geo-hash', 'topo-hash', 'mat-hash', 'env-hash', 'phys-hash'
    ) as HarnessToCoreBinding;
  }
}
