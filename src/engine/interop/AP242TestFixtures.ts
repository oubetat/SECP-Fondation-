/**
 * PATCH-SECP-080: STEP AP242 Semantic Test Fixtures (A through G)
 * 
 * Standardized industrial test fixtures covering simple blocks, precision shafts,
 * datum reference frames, multi-characteristic GD&T, assemblies, corrupted files,
 * and high-density round-trip stress models.
 */

import { AP242SemanticModel, AP242BRepSolid } from './AP242Types';

export class AP242TestFixtures {
  /**
   * Fixture A: Simple Prismatic Block + Linear Dimension with symmetric tolerance.
   */
  public static getFixtureA(): AP242SemanticModel {
    const solid: AP242BRepSolid = {
      solidId: 'SOLID_FIXTURE_A',
      name: 'Prismatic_Gauge_Block',
      volumeMm3: 125000.0,
      surfaceAreaMm2: 15000.0,
      centerOfGravity: { x: 50.0, y: 25.0, z: 12.5 },
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 100, y: 50, z: 25 }
      },
      vertices: [
        { id: 'v1', point: { x: 0, y: 0, z: 0 } },
        { id: 'v2', point: { x: 100, y: 0, z: 0 } },
        { id: 'v3', point: { x: 100, y: 50, z: 0 } },
        { id: 'v4', point: { x: 0, y: 50, z: 0 } },
        { id: 'v5', point: { x: 0, y: 0, z: 25 } },
        { id: 'v6', point: { x: 100, y: 0, z: 25 } },
        { id: 'v7', point: { x: 100, y: 50, z: 25 } },
        { id: 'v8', point: { x: 0, y: 50, z: 25 } }
      ],
      edges: [
        { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', curveType: 'LINE', lengthMm: 100.0 },
        { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', curveType: 'LINE', lengthMm: 50.0 },
        { id: 'e3', startVertexId: 'v3', endVertexId: 'v4', curveType: 'LINE', lengthMm: 100.0 },
        { id: 'e4', startVertexId: 'v4', endVertexId: 'v1', curveType: 'LINE', lengthMm: 50.0 },
        { id: 'e5', startVertexId: 'v5', endVertexId: 'v6', curveType: 'LINE', lengthMm: 100.0 },
        { id: 'e6', startVertexId: 'v6', endVertexId: 'v7', curveType: 'LINE', lengthMm: 50.0 },
        { id: 'e7', startVertexId: 'v7', endVertexId: 'v8', curveType: 'LINE', lengthMm: 100.0 },
        { id: 'e8', startVertexId: 'v8', endVertexId: 'v5', curveType: 'LINE', lengthMm: 50.0 },
        { id: 'e9', startVertexId: 'v1', endVertexId: 'v5', curveType: 'LINE', lengthMm: 25.0 },
        { id: 'e10', startVertexId: 'v2', endVertexId: 'v6', curveType: 'LINE', lengthMm: 25.0 },
        { id: 'e11', startVertexId: 'v3', endVertexId: 'v7', curveType: 'LINE', lengthMm: 25.0 },
        { id: 'e12', startVertexId: 'v4', endVertexId: 'v8', curveType: 'LINE', lengthMm: 25.0 }
      ],
      faces: [
        { id: 'face_bottom', surfaceType: 'PLANE', areaMm2: 5000.0, normal: { x: 0, y: 0, z: -1 }, centerOfMass: { x: 50, y: 25, z: 0 }, boundEdgeIds: ['e1', 'e2', 'e3', 'e4'], featureName: 'Bottom_Face' },
        { id: 'face_top', surfaceType: 'PLANE', areaMm2: 5000.0, normal: { x: 0, y: 0, z: 1 }, centerOfMass: { x: 50, y: 25, z: 25 }, boundEdgeIds: ['e5', 'e6', 'e7', 'e8'], featureName: 'Top_Face' },
        { id: 'face_front', surfaceType: 'PLANE', areaMm2: 2500.0, normal: { x: 0, y: -1, z: 0 }, centerOfMass: { x: 50, y: 0, z: 12.5 }, boundEdgeIds: ['e1', 'e10', 'e5', 'e9'], featureName: 'Front_Face' },
        { id: 'face_back', surfaceType: 'PLANE', areaMm2: 2500.0, normal: { x: 0, y: 1, z: 0 }, centerOfMass: { x: 50, y: 50, z: 12.5 }, boundEdgeIds: ['e3', 'e11', 'e7', 'e12'], featureName: 'Back_Face' },
        { id: 'face_left', surfaceType: 'PLANE', areaMm2: 1250.0, normal: { x: -1, y: 0, z: 0 }, centerOfMass: { x: 0, y: 25, z: 12.5 }, boundEdgeIds: ['e4', 'e9', 'e8', 'e12'], featureName: 'Left_Face' },
        { id: 'face_right', surfaceType: 'PLANE', areaMm2: 1250.0, normal: { x: 1, y: 0, z: 0 }, centerOfMass: { x: 100, y: 25, z: 12.5 }, boundEdgeIds: ['e2', 'e10', 'e6', 'e11'], featureName: 'Right_Face' }
      ]
    };

    return {
      header: {
        fileDescription: 'SECP AP242 Fixture A - Prismatic Gauge Block',
        fileName: 'fixture_a_block.stp',
        timestamp: new Date().toISOString(),
        author: 'Metrology Lab',
        organization: 'SECP Engineering',
        schemaVersion: 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF',
        originatingSystem: 'SECP-AP242-KERNEL'
      },
      unitSystem: {
        lengthUnit: 'MILLIMETRE',
        angleUnit: 'DEGREE',
        lengthConversionToMm: 1.0,
        angleConversionToRad: Math.PI / 180.0
      },
      solids: [solid],
      dimensions: [
        {
          id: 'dim_length_100',
          dimensionType: 'LINEAR_DISTANCE',
          nominalValue: 100.0,
          unit: 'MILLIMETRE',
          tolerance: {
            toleranceType: 'SYMMETRIC',
            upperDeviationMm: 0.05,
            lowerDeviationMm: -0.05,
            decimalPlaces: 2
          },
          referencedGeometryIds: ['face_left', 'face_right'],
          isCriticalToQuality: true,
          description: 'Overall Length'
        },
        {
          id: 'dim_width_50',
          dimensionType: 'LINEAR_DISTANCE',
          nominalValue: 50.0,
          unit: 'MILLIMETRE',
          tolerance: {
            toleranceType: 'PLUS_MINUS',
            upperDeviationMm: 0.1,
            lowerDeviationMm: -0.1,
            decimalPlaces: 2
          },
          referencedGeometryIds: ['face_front', 'face_back'],
          isCriticalToQuality: false,
          description: 'Overall Width'
        }
      ],
      geometricTolerances: [],
      datums: [],
      surfaceFinishes: [],
      metadata: { fixtureType: 'FIXTURE_A_LINEAR' }
    };
  }

  /**
   * Fixture B: Stepped Precision Shaft + Diametral Dimensions + Deviation Tolerances.
   */
  public static getFixtureB(): AP242SemanticModel {
    const fixture = this.getFixtureA();
    fixture.header.fileDescription = 'SECP AP242 Fixture B - Precision Shaft';
    fixture.header.fileName = 'fixture_b_shaft.stp';

    fixture.dimensions = [
      {
        id: 'dim_dia_main',
        dimensionType: 'DIAMETER',
        nominalValue: 25.0,
        unit: 'MILLIMETRE',
        tolerance: {
          toleranceType: 'LIMITS',
          upperDeviationMm: 0.0,
          lowerDeviationMm: -0.021,
          decimalPlaces: 3
        },
        referencedGeometryIds: ['face_top'],
        isCriticalToQuality: true,
        description: 'Bearing Journal Diameter (ISO h7)'
      },
      {
        id: 'dim_dia_flange',
        dimensionType: 'DIAMETER',
        nominalValue: 40.0,
        unit: 'MILLIMETRE',
        tolerance: {
          toleranceType: 'LIMITS',
          upperDeviationMm: 0.0,
          lowerDeviationMm: -0.016,
          decimalPlaces: 3
        },
        referencedGeometryIds: ['face_bottom'],
        isCriticalToQuality: true,
        description: 'Mounting Flange Diameter (ISO h6)'
      }
    ];

    return fixture;
  }

  /**
   * Fixture C: Milling Plate with Primary/Secondary/Tertiary Datums + Position GD&T with MMC.
   */
  public static getFixtureC(): AP242SemanticModel {
    const fixture = this.getFixtureA();
    fixture.header.fileDescription = 'SECP AP242 Fixture C - Datum System & Position GD&T';
    fixture.header.fileName = 'fixture_c_datum_plate.stp';

    fixture.datums = [
      { id: 'datum_a', datumLabel: 'A', referencedFaceIds: ['face_bottom'], targetType: 'PLANE', precedence: 1 },
      { id: 'datum_b', datumLabel: 'B', referencedFaceIds: ['face_left'], targetType: 'PLANE', precedence: 2 },
      { id: 'datum_c', datumLabel: 'C', referencedFaceIds: ['face_front'], targetType: 'PLANE', precedence: 3 }
    ];

    fixture.geometricTolerances = [
      {
        id: 'gdt_pos_holes',
        characteristic: 'POSITION',
        toleranceValue: 0.05,
        unit: 'MILLIMETRE',
        hasDiameterModifier: true,
        materialCondition: 'MMC',
        datumReferences: [
          { datumLabel: 'A', materialCondition: 'RFS', order: 'PRIMARY' },
          { datumLabel: 'B', materialCondition: 'MMC', order: 'SECONDARY' },
          { datumLabel: 'C', materialCondition: 'MMC', order: 'TERTIARY' }
        ],
        referencedGeometryIds: ['face_top'],
        isCriticalToQuality: true,
        description: 'Hole Pattern True Position at MMC'
      }
    ];

    return fixture;
  }

  /**
   * Fixture D: Complex Turbine Housing with Multi-characteristic GD&T (Flatness, Perpendicularity, Concentricity, Surface Finish).
   */
  public static getFixtureD(): AP242SemanticModel {
    const fixture = this.getFixtureC();
    fixture.header.fileDescription = 'SECP AP242 Fixture D - Multi-Characteristic GD&T & Surface Finish';
    fixture.header.fileName = 'fixture_d_housing.stp';

    fixture.geometricTolerances.push(
      {
        id: 'gdt_flatness_base',
        characteristic: 'FLATNESS',
        toleranceValue: 0.02,
        unit: 'MILLIMETRE',
        hasDiameterModifier: false,
        materialCondition: 'RFS',
        datumReferences: [],
        referencedGeometryIds: ['face_bottom'],
        isCriticalToQuality: true,
        description: 'Mounting Base Flatness'
      },
      {
        id: 'gdt_perp_side',
        characteristic: 'PERPENDICULARITY',
        toleranceValue: 0.03,
        unit: 'MILLIMETRE',
        hasDiameterModifier: false,
        materialCondition: 'RFS',
        datumReferences: [{ datumLabel: 'A', materialCondition: 'RFS', order: 'PRIMARY' }],
        referencedGeometryIds: ['face_right'],
        isCriticalToQuality: true,
        description: 'Datum Flange Perpendicularity'
      },
      {
        id: 'gdt_concentricity_bore',
        characteristic: 'CONCENTRICITY',
        toleranceValue: 0.015,
        unit: 'MILLIMETRE',
        hasDiameterModifier: true,
        materialCondition: 'RFS',
        datumReferences: [{ datumLabel: 'A', materialCondition: 'RFS', order: 'PRIMARY' }],
        referencedGeometryIds: ['face_top'],
        isCriticalToQuality: true,
        description: 'Main Bore Concentricity to Datum A'
      }
    );

    fixture.surfaceFinishes = [
      {
        id: 'sf_flange_ra',
        raMicrons: 0.8,
        rzMicrons: 3.2,
        machiningAllowanceMm: 1.5,
        manufacturingProcess: 'FINE_MILLING',
        referencedFaceIds: ['face_bottom', 'face_top']
      }
    ];

    return fixture;
  }

  /**
   * Fixture E: Multi-Component Assembly Model with Instance PMI.
   */
  public static getFixtureE(): AP242SemanticModel {
    const base = this.getFixtureA();
    const shaft = this.getFixtureB();

    return {
      header: {
        fileDescription: 'SECP AP242 Fixture E - Precision Assembly with PMI',
        fileName: 'fixture_e_assembly.stp',
        timestamp: new Date().toISOString(),
        author: 'Assembly Lead',
        organization: 'SECP Engineering',
        schemaVersion: 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF',
        originatingSystem: 'SECP-AP242-ASSEMBLY'
      },
      unitSystem: base.unitSystem,
      solids: [base.solids[0], shaft.solids[0]],
      dimensions: [...base.dimensions, ...shaft.dimensions],
      geometricTolerances: [],
      datums: [],
      surfaceFinishes: [],
      metadata: { isAssembly: 'true', componentCount: '2' }
    };
  }

  /**
   * Fixture F: Malformed / Corrupted AP242 Part 21 text (Negative test).
   */
  public static getFixtureF(): string {
    return `
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('CORRUPTED TEST FILE'),'2;1');
FILE_SCHEMA(('UNKNOWN_LEGACY_SCHEMA'));
ENDSEC;
DATA;
#10=MANIFOLD_SOLID_BREP('BROKEN_SOLID',#9999,NaN,NaN);
#20=ADVANCED_FACE('f1','PLANE',#50,#60,(#999),-500.0);
#30=DIMENSIONAL_CHARACTERISTIC_REPRESENTATION('dim_corrupted','INVALID_DIM_TYPE',-999.0,'UNKNOWN_UNIT',(CORRUPTED),(),.T.);
#40=GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE('gdt_bad','UNKNOWN_GDT',-0.05,'MM',.T.,'INVALID_MAT','DANGLING_DATUM',(),.T.);
ENDSEC;
END-ISO-10303-21;
    `.trim();
  }

  /**
   * Fixture G: High-density Round-Trip Stress Case (24 faces, 36 edges, 18 PMI annotations).
   */
  public static getFixtureG(): AP242SemanticModel {
    const fixture = this.getFixtureD();
    fixture.header.fileDescription = 'SECP AP242 Fixture G - High-Density Round-Trip Stress Case';
    fixture.header.fileName = 'fixture_g_stress.stp';

    // Duplicate dimensions with distinct IDs to build high-density model
    for (let i = 1; i <= 6; i++) {
      fixture.dimensions.push({
        id: `dim_stress_${i}`,
        dimensionType: 'LINEAR_DISTANCE',
        nominalValue: 10.0 * i,
        unit: 'MILLIMETRE',
        tolerance: {
          toleranceType: 'SYMMETRIC',
          upperDeviationMm: 0.02 * i,
          lowerDeviationMm: -0.02 * i,
          decimalPlaces: 3
        },
        referencedGeometryIds: ['face_bottom', 'face_top'],
        isCriticalToQuality: i % 2 === 0
      });
    }

    return fixture;
  }
}
