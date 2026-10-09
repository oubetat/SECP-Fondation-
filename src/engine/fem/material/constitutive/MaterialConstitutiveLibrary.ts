import { MaterialConstitutiveDefinition } from './ConstitutiveTypes';

export class MaterialConstitutiveLibrary {
  private static materials: MaterialConstitutiveDefinition[] = [
    {
      identity: {
        materialId: 'MAT_STEEL_S355',
        name: 'Steel S355',
        family: 'STEEL',
        source: 'EN 10025-2',
        isTestBenchmarkReference: true
      },
      units: {
        system: 'SI',
        stressUnit: 'Pa',
        strainUnit: 'dimensionless',
        densityUnit: 'kg/m^3',
        temperatureUnit: 'K'
      },
      density: 7850,
      constitutiveType: 'ISOTROPIC_LINEAR_ELASTIC',
      elastic: { type: 'ISOTROPIC', E: 210e9, nu: 0.3 },
      provenance: {
        revision: 1,
        provenanceHash: '0x123456789',
        author: 'SECP Material Service',
        timestamp: new Date().toISOString(),
        sourceReference: 'STANDARD-ASTM-A36-EQUIV'
      }
    },
    {
      identity: {
        materialId: 'MAT_ALUM_6061',
        name: 'Aluminum 6061-T6',
        family: 'ALUMINUM',
        source: 'ASM Handbook',
        isTestBenchmarkReference: true
      },
      units: {
        system: 'SI',
        stressUnit: 'Pa',
        strainUnit: 'dimensionless',
        densityUnit: 'kg/m^3',
        temperatureUnit: 'K'
      },
      density: 2700,
      constitutiveType: 'ISOTROPIC_LINEAR_ELASTIC',
      elastic: { type: 'ISOTROPIC', E: 69e9, nu: 0.33 },
      provenance: {
        revision: 1,
        provenanceHash: '0x223456789',
        author: 'SECP Material Service',
        timestamp: new Date().toISOString(),
        sourceReference: 'ASM-6061-T6'
      }
    },
    {
      identity: {
        materialId: 'MAT_POLYMER_PEEK_ORTHO',
        name: 'PEEK Orthotropic',
        family: 'POLYMER',
        source: 'Composite Data Sheet',
        isTestBenchmarkReference: true
      },
      units: {
        system: 'SI',
        stressUnit: 'Pa',
        strainUnit: 'dimensionless',
        densityUnit: 'kg/m^3',
        temperatureUnit: 'K'
      },
      density: 1320,
      constitutiveType: 'ORTHOTROPIC_LINEAR_ELASTIC',
      elastic: { type: 'ORTHOTROPIC', E1: 4.0e9, E2: 3.5e9, E3: 3.5e9, nu12: 0.4, nu13: 0.4, nu23: 0.45, G12: 1.3e9, G13: 1.3e9, G23: 1.1e9 },
      provenance: {
        revision: 1,
        provenanceHash: '0x323456789',
        author: 'SECP Material Service',
        timestamp: new Date().toISOString(),
        sourceReference: 'PEEK-ORTHO-SPEC'
      }
    },
    {
      identity: {
        materialId: 'MAT_TITANIUM_TI6AL4V',
        name: 'Titanium Ti-6Al-4V',
        family: 'TITANIUM',
        source: 'MMPDS',
        isTestBenchmarkReference: true
      },
      units: {
        system: 'SI',
        stressUnit: 'Pa',
        strainUnit: 'dimensionless',
        densityUnit: 'kg/m^3',
        temperatureUnit: 'K'
      },
      density: 4430,
      constitutiveType: 'ISOTROPIC_LINEAR_ELASTIC',
      elastic: { type: 'ISOTROPIC', E: 113.8e9, nu: 0.342 },
      provenance: {
        revision: 1,
        provenanceHash: '0x423456789',
        author: 'SECP Material Service',
        timestamp: new Date().toISOString(),
        sourceReference: 'TI-6AL-4V-EL-SPEC'
      }
    },
    {
      identity: {
        materialId: 'MAT_CONCRETE_C30',
        name: 'Concrete C30/37',
        family: 'CONCRETE',
        source: 'Eurocode 2',
        isTestBenchmarkReference: true
      },
      units: {
        system: 'SI',
        stressUnit: 'Pa',
        strainUnit: 'dimensionless',
        densityUnit: 'kg/m^3',
        temperatureUnit: 'K'
      },
      density: 2400,
      constitutiveType: 'ISOTROPIC_LINEAR_ELASTIC',
      elastic: { type: 'ISOTROPIC', E: 33e9, nu: 0.2 },
      provenance: {
        revision: 1,
        provenanceHash: '0x523456789',
        author: 'SECP Material Service',
        timestamp: new Date().toISOString(),
        sourceReference: 'EC2-CONCRETE-SPEC'
      }
    }
  ];

  public static list(): MaterialConstitutiveDefinition[] {
    return this.materials;
  }

  public static get(id: string): MaterialConstitutiveDefinition | undefined {
    return this.materials.find(m => m.identity.materialId === id);
  }
}
