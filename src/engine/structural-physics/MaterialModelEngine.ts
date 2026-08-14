/**
 * PATCH-SECP-073: Material Model Engine
 * Defines and retrieves linear elastic material properties.
 */

import { MaterialProperties } from './StructuralPhysicsTypes';

export class MaterialModelEngine {
  private static materials: Record<string, MaterialProperties> = {
    'MAT-STEEL': {
      id: 'MAT-STEEL',
      name: 'Structural Steel (ASTM A36)',
      youngsModulus: 200e9, // 200 GPa
      poissonsRatio: 0.30,
      yieldStrength: 250e6, // 250 MPa
      density: 7850         // kg/m^3
    },
    'MAT-ALUM': {
      id: 'MAT-ALUM',
      name: 'Aluminium Alloy (6061-T6)',
      youngsModulus: 68.9e9, // 68.9 GPa
      poissonsRatio: 0.33,
      yieldStrength: 276e6,  // 276 MPa
      density: 2700
    },
    'MAT-TITANIUM': {
      id: 'MAT-TITANIUM',
      name: 'Titanium Grade 5 (Ti-6Al-4V)',
      youngsModulus: 113.8e9, // 113.8 GPa
      poissonsRatio: 0.34,
      yieldStrength: 880e6,   // 880 MPa
      density: 4430
    }
  };

  public static getMaterial(id: string): MaterialProperties {
    return this.materials[id] || this.materials['MAT-STEEL'];
  }

  public static getAllMaterials(): MaterialProperties[] {
    return Object.values(this.materials);
  }
}
