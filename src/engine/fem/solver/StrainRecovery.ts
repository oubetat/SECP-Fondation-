import { BAR2Element } from '../elements/BAR2Element';
import { HEX8Element } from '../elements/HEX8Element';
import { QUAD4Element } from '../elements/QUAD4Element';
import { TET4Element } from '../elements/TET4Element';
import { TRI3Element } from '../elements/TRI3Element';
import { DOFManager } from './DOFManager';
import { StructuralModel } from './StructuralModel';
import { ElementRecoveryResult } from './types';

export class StrainRecovery {
  static recoverElementResults(
    model: StructuralModel,
    dofManager: DOFManager,
    u_global: number[]
  ): ElementRecoveryResult[] {
    const results: ElementRecoveryResult[] = [];

    for (const elem of model.elements) {
      // 1. Extract element node coordinates
      const coords = elem.nodeIds.map((id) => {
        const node = model.getNode(id);
        if (!node) throw new Error(`Node ${id} not found`);
        return node.coordinates;
      });

      // 2. Extract element global DOFs and nodal displacements u_e
      const elemDOFs = dofManager.getElementGlobalDOFs(elem.nodeIds, dofManager.dofsPerNode);
      const u_e = elemDOFs.map((idx) => u_global[idx]);

      // 3. Compute strain and stress using verified element formulation
      let strain: number[] = [];
      let stress: number[] = [];
      let vonMises = 0;

      switch (elem.type) {
        case 'BAR2': {
          const res = BAR2Element.computeStrainStress(coords, u_e, elem.material);
          strain = res.strain;
          stress = res.stress;
          vonMises = res.vonMisesStress;
          break;
        }
        case 'TRI3': {
          const res = TRI3Element.computeStrainStress(coords, u_e, elem.material);
          strain = res.strain;
          stress = res.stress;
          vonMises = res.vonMisesStress;
          break;
        }
        case 'QUAD4': {
          const res = QUAD4Element.computeStrainStress(coords, u_e, elem.material);
          strain = res.strain;
          stress = res.stress;
          vonMises = res.vonMisesStress;
          break;
        }
        case 'TET4': {
          const res = TET4Element.computeStrainStress(coords, u_e, elem.material);
          strain = res.strain;
          stress = res.stress;
          vonMises = res.vonMisesStress;
          break;
        }
        case 'HEX8': {
          const res = HEX8Element.computeStrainStress(coords, u_e, elem.material);
          strain = res.strain;
          stress = res.stress;
          vonMises = res.vonMisesStress;
          break;
        }
      }

      // Compute element strain energy U_e = 1/2 u_e^T K_e u_e
      // Compute Ke
      let KeMatrix: number[][];
      switch (elem.type) {
        case 'BAR2':
          KeMatrix = BAR2Element.computeStiffness(elem.id, coords, elem.material).stiffnessMatrix.data;
          break;
        case 'TRI3':
          KeMatrix = TRI3Element.computeStiffness(elem.id, coords, elem.material).stiffnessMatrix.data;
          break;
        case 'QUAD4':
          KeMatrix = QUAD4Element.computeStiffness(elem.id, coords, elem.material).stiffnessMatrix.data;
          break;
        case 'TET4':
          KeMatrix = TET4Element.computeStiffness(elem.id, coords, elem.material).stiffnessMatrix.data;
          break;
        case 'HEX8':
          KeMatrix = HEX8Element.computeStiffness(elem.id, coords, elem.material).stiffnessMatrix.data;
          break;
      }

      let strainEnergy = 0;
      const numDOFs = u_e.length;
      for (let i = 0; i < numDOFs; i++) {
        for (let j = 0; j < numDOFs; j++) {
          strainEnergy += 0.5 * u_e[i] * KeMatrix[i][j] * u_e[j];
        }
      }

      // Element centroid
      let cx = 0, cy = 0, cz = 0;
      const nodeCount = coords.length;
      for (const pt of coords) {
        cx += pt[0];
        cy += pt[1] ?? 0;
        cz += pt[2] ?? 0;
      }
      cx /= nodeCount;
      cy /= nodeCount;
      cz /= nodeCount;

      results.push({
        elementId: elem.id,
        elementTypeId: elem.type,
        nodalDisplacements: u_e,
        gaussPoints: [
          {
            location: { x: cx, y: cy, z: cz },
            strain,
            stress,
            vonMisesStress: vonMises
          }
        ],
        elementCenterStrain: strain,
        elementCenterStress: stress,
        elementCenterVonMises: vonMises,
        elementStrainEnergy: strainEnergy
      });
    }

    return results;
  }
}
