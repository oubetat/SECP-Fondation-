/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — CAM Tool Repository & Catalog Engine
 * 
 * Manages in-memory storage, persistence, standard ISO tool catalogs,
 * tool revisions, audit logging, search, filtering, and import/export.
 */

import {
  CAMTool,
  ToolUUID,
  ToolType,
  ToolCategory,
  ToolMaterial,
  ToolCoating,
  HolderInterfaceType,
  ToolDimensions,
  ToolAuditEvent,
  ToolAuditEventType,
  ToolVersionInfo,
  LibraryScope
} from './ToolTypes';
import { ToolGeometryEngine } from './ToolGeometryEngine';
import { ToolCuttingCalculator } from './ToolCuttingCalculator';
import { ToolAssemblyEngine } from './ToolAssemblyEngine';
import { ToolValidator } from './ToolValidator';
import { generateDeterministicHash } from '../../../lib/hash';

export class ToolRepository {
  private static tools: Map<ToolUUID, CAMTool> = new Map();
  private static auditLogs: ToolAuditEvent[] = [];
  private static initialized: boolean = false;

  /**
   * Initializes the repository with standard preset catalogs
   */
  public static async initialize(): Promise<void> {
    if (this.initialized && this.tools.size > 0) return;
    this.tools.clear();
    await this.seedStandardCatalog();
    this.initialized = true;
  }

  /**
   * Seeds the comprehensive ISO tool catalog
   */
  private static async seedStandardCatalog(): Promise<void> {
    const standardHolders = ToolAssemblyEngine.getStandardHolders();
    const defaultHolder = standardHolders[0]; // BT40 ER32

    // Helper to build tools
    const addStandardTool = async (
      toolUUID: string,
      toolId: string,
      name: string,
      type: ToolType,
      category: ToolCategory,
      dims: ToolDimensions,
      material: ToolMaterial = 'CARBIDE',
      coating: ToolCoating = 'TIALN',
      manufacturerName: string = 'SECP Precision Tooling AG',
      compatibleHolders: HolderInterfaceType[] = ['BT40', 'HSK_A63', 'CAT40', 'CAPTO_C6']
    ) => {
      const geometry = await ToolGeometryEngine.createGeometryModel(type, dims);
      
      const cuttingParams = [
        ToolCuttingCalculator.generateRecommendedParameters(type, dims.cuttingDiameterMm, dims.fluteCount, material, 'ISO_N_NON_FERROUS', 'ENGINEERING_DATABASE'),
        ToolCuttingCalculator.generateRecommendedParameters(type, dims.cuttingDiameterMm, dims.fluteCount, material, 'ISO_P_STEEL', 'ENGINEERING_DATABASE'),
        ToolCuttingCalculator.generateRecommendedParameters(type, dims.cuttingDiameterMm, dims.fluteCount, material, 'ISO_M_STAINLESS', 'ENGINEERING_DATABASE'),
        ToolCuttingCalculator.generateRecommendedParameters(type, dims.cuttingDiameterMm, dims.fluteCount, material, 'ISO_S_HIGH_TEMP_ALLOY', 'ENGINEERING_DATABASE')
      ];

      const version: ToolVersionInfo = {
        versionString: '1.0.0',
        revisionNumber: 1,
        createdAtTimestamp: Date.now() - 100000,
        author: 'SECP CAM Engineering Library',
        changeLog: 'Initial release of ISO standard tool catalog definition.',
        versionHash: await generateDeterministicHash({ toolUUID, v: '1.0.0', geom: geometry.geometryHash })
      };

      const entityPayload = {
        toolUUID,
        toolId,
        type,
        dims,
        version: version.versionString,
        geometryHash: geometry.geometryHash
      };

      const entityHash = await generateDeterministicHash(entityPayload);

      const tool: CAMTool = {
        toolUUID,
        toolId,
        name,
        type,
        category,
        version,
        geometry,
        material,
        coating,
        coatingThicknessUm: 3.5,
        manufacturer: {
          manufacturer: manufacturerName,
          orderCode: `SECP-${toolId}-${dims.cuttingDiameterMm}`,
          eclassCode: '21-01-01-01',
          iso13399Designation: `DIN 6527-${toolId}`
        },
        cuttingParameters: cuttingParams,
        compatibleHolders,
        defaultHolder,
        availability: 'AVAILABLE',
        libraryScope: 'GLOBAL',
        validationStatus: 'TOOL_VALID',
        validationMessages: ['Standard validated tool entity.'],
        isArchived: false,
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
        entityHash
      };

      this.tools.set(toolUUID, tool);
    };

    // 1. Flat End Mills
    await addStandardTool('tool-em-2mm-2f', 'T01', '2mm Micro End Mill 2F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 2.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 50.0,
      cuttingLengthMm: 6.0,
      shoulderLengthMm: 12.0,
      fluteCount: 2,
      helixAngleDeg: 30
    }, 'CARBIDE', 'ALCRN');

    await addStandardTool('tool-em-3mm-4f', 'T02', '3mm Flat End Mill 4F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 3.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 50.0,
      cuttingLengthMm: 9.0,
      shoulderLengthMm: 15.0,
      fluteCount: 4,
      helixAngleDeg: 35
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-em-6mm-4f', 'T03', '6mm Flat End Mill 4F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 6.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 57.0,
      cuttingLengthMm: 13.0,
      shoulderLengthMm: 20.0,
      fluteCount: 4,
      helixAngleDeg: 35
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-em-8mm-4f', 'T04', '8mm Flat End Mill 4F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 8.0,
      shankDiameterMm: 8.0,
      overallLengthMm: 63.0,
      cuttingLengthMm: 19.0,
      shoulderLengthMm: 26.0,
      fluteCount: 4,
      helixAngleDeg: 38
    }, 'CARBIDE', 'TIALN');

    // Benchmark A tool (10mm End Mill)
    await addStandardTool('tool-em-10mm-4f', 'T05', '10mm High-Performance End Mill 4F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 10.0,
      shankDiameterMm: 10.0,
      overallLengthMm: 72.0,
      cuttingLengthMm: 22.0,
      shoulderLengthMm: 30.0,
      fluteCount: 4,
      helixAngleDeg: 40
    }, 'CARBIDE', 'ALCRN');

    await addStandardTool('tool-em-12mm-4f', 'T06', '12mm Roughing/Finishing End Mill 4F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 12.0,
      shankDiameterMm: 12.0,
      overallLengthMm: 83.0,
      cuttingLengthMm: 26.0,
      shoulderLengthMm: 36.0,
      fluteCount: 4,
      helixAngleDeg: 42
    }, 'CARBIDE', 'ALCRN');

    await addStandardTool('tool-em-16mm-5f', 'T07', '16mm High-Feed Rougher 5F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 16.0,
      shankDiameterMm: 16.0,
      overallLengthMm: 92.0,
      cuttingLengthMm: 32.0,
      shoulderLengthMm: 42.0,
      fluteCount: 5,
      helixAngleDeg: 45
    }, 'CARBIDE', 'ALTIN');

    await addStandardTool('tool-em-20mm-6f', 'T08', '20mm Finishing End Mill 6F', 'END_MILL', 'MILLING', {
      cuttingDiameterMm: 20.0,
      shankDiameterMm: 20.0,
      overallLengthMm: 104.0,
      cuttingLengthMm: 38.0,
      shoulderLengthMm: 50.0,
      fluteCount: 6,
      helixAngleDeg: 45
    }, 'CARBIDE', 'ALCRN');

    // 2. Ball End Mills (Benchmark B)
    await addStandardTool('tool-ball-3mm-2f', 'T09', '3mm Ball Nose End Mill 2F (R1.5)', 'BALL_END_MILL', 'MILLING', {
      cuttingDiameterMm: 3.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 50.0,
      cuttingLengthMm: 8.0,
      shoulderLengthMm: 16.0,
      fluteCount: 2,
      cornerRadiusMm: 1.5,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-ball-6mm-2f', 'T10', '6mm Ball Nose End Mill 2F (R3.0)', 'BALL_END_MILL', 'MILLING', {
      cuttingDiameterMm: 6.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 57.0,
      cuttingLengthMm: 12.0,
      shoulderLengthMm: 22.0,
      fluteCount: 2,
      cornerRadiusMm: 3.0,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-ball-10mm-2f', 'T11', '10mm Ball Nose End Mill 2F (R5.0)', 'BALL_END_MILL', 'MILLING', {
      cuttingDiameterMm: 10.0,
      shankDiameterMm: 10.0,
      overallLengthMm: 72.0,
      cuttingLengthMm: 20.0,
      shoulderLengthMm: 30.0,
      fluteCount: 2,
      cornerRadiusMm: 5.0,
      helixAngleDeg: 30
    }, 'CARBIDE', 'ALCRN');

    // 3. Bull Nose (Toroidal) End Mills
    await addStandardTool('tool-bull-10mm-r1', 'T12', '10mm Bull Nose Toroidal R1.0 4F', 'BULL_NOSE', 'MILLING', {
      cuttingDiameterMm: 10.0,
      shankDiameterMm: 10.0,
      overallLengthMm: 72.0,
      cuttingLengthMm: 22.0,
      shoulderLengthMm: 30.0,
      fluteCount: 4,
      cornerRadiusMm: 1.0,
      helixAngleDeg: 38
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-bull-12mm-r2', 'T13', '12mm Bull Nose Toroidal R2.0 4F', 'BULL_NOSE', 'MILLING', {
      cuttingDiameterMm: 12.0,
      shankDiameterMm: 12.0,
      overallLengthMm: 83.0,
      cuttingLengthMm: 26.0,
      shoulderLengthMm: 36.0,
      fluteCount: 4,
      cornerRadiusMm: 2.0,
      helixAngleDeg: 40
    }, 'CARBIDE', 'ALCRN');

    // 4. Face Mills
    await addStandardTool('tool-facemill-50mm-5insert', 'T14', '50mm Indexable Face Mill 45° (5-Insert)', 'FACE_MILL', 'MILLING', {
      cuttingDiameterMm: 50.0,
      shankDiameterMm: 22.0,
      overallLengthMm: 45.0,
      cuttingLengthMm: 8.0,
      shoulderLengthMm: 45.0,
      fluteCount: 5,
      insertCount: 5,
      insertType: 'APKT 1604'
    }, 'CARBIDE', 'TIALN', 'Walter Valenite', ['BT40', 'HSK_A63']);

    // 5. Drills
    await addStandardTool('tool-drill-3_3mm', 'T15', '3.3mm Carbide Twist Drill 140° (M4 Tap)', 'DRILL', 'HOLEMAKING', {
      cuttingDiameterMm: 3.3,
      shankDiameterMm: 6.0,
      overallLengthMm: 66.0,
      cuttingLengthMm: 28.0,
      shoulderLengthMm: 36.0,
      fluteCount: 2,
      tipAngleDeg: 140,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-drill-5_0mm', 'T16', '5.0mm Carbide Twist Drill 140° (M6 Tap)', 'DRILL', 'HOLEMAKING', {
      cuttingDiameterMm: 5.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 66.0,
      cuttingLengthMm: 28.0,
      shoulderLengthMm: 36.0,
      fluteCount: 2,
      tipAngleDeg: 140,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-drill-6_8mm', 'T17', '6.8mm Carbide Twist Drill 140° (M8 Tap)', 'DRILL', 'HOLEMAKING', {
      cuttingDiameterMm: 6.8,
      shankDiameterMm: 8.0,
      overallLengthMm: 79.0,
      cuttingLengthMm: 34.0,
      shoulderLengthMm: 45.0,
      fluteCount: 2,
      tipAngleDeg: 140,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-drill-8_5mm', 'T18', '8.5mm Carbide Twist Drill 140° (M10 Tap)', 'DRILL', 'HOLEMAKING', {
      cuttingDiameterMm: 8.5,
      shankDiameterMm: 10.0,
      overallLengthMm: 89.0,
      cuttingLengthMm: 47.0,
      shoulderLengthMm: 55.0,
      fluteCount: 2,
      tipAngleDeg: 140,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    await addStandardTool('tool-drill-10_2mm', 'T19', '10.2mm Carbide Twist Drill 140° (M12 Tap)', 'DRILL', 'HOLEMAKING', {
      cuttingDiameterMm: 10.2,
      shankDiameterMm: 12.0,
      overallLengthMm: 102.0,
      cuttingLengthMm: 55.0,
      shoulderLengthMm: 65.0,
      fluteCount: 2,
      tipAngleDeg: 140,
      helixAngleDeg: 30
    }, 'CARBIDE', 'TIALN');

    // 6. Reamers
    await addStandardTool('tool-reamer-6h7', 'T20', '6.0mm H7 Carbide Precision Reamer 6F', 'REAMER', 'HOLEMAKING', {
      cuttingDiameterMm: 6.0,
      shankDiameterMm: 6.0,
      overallLengthMm: 75.0,
      cuttingLengthMm: 20.0,
      shoulderLengthMm: 40.0,
      fluteCount: 6,
      helixAngleDeg: 8
    }, 'CARBIDE', 'UNCOATED');

    await addStandardTool('tool-reamer-8h7', 'T21', '8.0mm H7 Carbide Precision Reamer 6F', 'REAMER', 'HOLEMAKING', {
      cuttingDiameterMm: 8.0,
      shankDiameterMm: 8.0,
      overallLengthMm: 100.0,
      cuttingLengthMm: 25.0,
      shoulderLengthMm: 55.0,
      fluteCount: 6,
      helixAngleDeg: 8
    }, 'CARBIDE', 'UNCOATED');

    // 7. Chamfer Mill
    await addStandardTool('tool-chamfer-12mm-90deg', 'T22', '12mm 90° Chamfer / Deburring Mill 4F', 'CHAMFER_TOOL', 'MILLING', {
      cuttingDiameterMm: 12.0,
      shankDiameterMm: 12.0,
      overallLengthMm: 75.0,
      cuttingLengthMm: 6.0,
      shoulderLengthMm: 30.0,
      fluteCount: 4,
      tipAngleDeg: 90,
      pilotDiameterMm: 0.5,
      pilotLengthMm: 0.5
    }, 'CARBIDE', 'TIALN');

    // 8. Thread Mill
    await addStandardTool('tool-thrmill-m6', 'T23', 'M6x1.0 Solid Carbide Thread Mill 3F', 'THREAD_MILL', 'THREADING', {
      cuttingDiameterMm: 4.8,
      shankDiameterMm: 6.0,
      overallLengthMm: 57.0,
      cuttingLengthMm: 13.0,
      shoulderLengthMm: 20.0,
      fluteCount: 3,
      threadPitchMm: 1.0,
      threadProfile: 'M'
    }, 'CARBIDE', 'ALCRN');

    // 9. Custom Step Revolved Tool
    const customProfilePoints = [
      { radiusMm: 2.0, heightMm: 0 },
      { radiusMm: 2.0, heightMm: 5 },
      { radiusMm: 5.0, heightMm: 8 },
      { radiusMm: 5.0, heightMm: 25 },
      { radiusMm: 8.0, heightMm: 30 },
      { radiusMm: 8.0, heightMm: 70 }
    ];

    const customToolUUID = 'tool-custom-form-01';
    const customGeom = await ToolGeometryEngine.createGeometryModel('CUSTOM_TOOL', {
      cuttingDiameterMm: 10.0,
      shankDiameterMm: 16.0,
      overallLengthMm: 70.0,
      cuttingLengthMm: 25.0,
      shoulderLengthMm: 30.0,
      fluteCount: 3
    }, 'CUSTOM_TIP', {
      customToolId: 'CUSTOM_FORM_STEP_01',
      name: 'Custom Step Port Contour Form Cutter',
      revolvedProfile: customProfilePoints,
      cuttingZoneMaxZMm: 25,
      shankZoneMinZMm: 30
    });

    const customTool: CAMTool = {
      toolUUID: customToolUUID,
      toolId: 'T24',
      name: 'Custom Step Port Contour Form Cutter',
      type: 'CUSTOM_TOOL',
      category: 'SPECIAL',
      version: {
        versionString: '1.0.0',
        revisionNumber: 1,
        createdAtTimestamp: Date.now(),
        author: 'Advanced Form Tooling R&D',
        changeLog: 'Custom stepped revolved port profile definition.',
        versionHash: await generateDeterministicHash({ customToolUUID, v: '1.0.0' })
      },
      geometry: customGeom,
      material: 'CARBIDE',
      coating: 'ALCRN',
      coatingThicknessUm: 4.0,
      manufacturer: {
        manufacturer: 'Custom Tool Design Co.',
        orderCode: 'CTD-STEP-10-16-70'
      },
      cuttingParameters: [
        ToolCuttingCalculator.generateRecommendedParameters('CUSTOM_TOOL', 10.0, 3, 'CARBIDE', 'ISO_N_NON_FERROUS'),
        ToolCuttingCalculator.generateRecommendedParameters('CUSTOM_TOOL', 10.0, 3, 'CARBIDE', 'ISO_P_STEEL')
      ],
      compatibleHolders: ['BT40', 'HSK_A63'],
      defaultHolder,
      availability: 'AVAILABLE',
      libraryScope: 'GLOBAL',
      validationStatus: 'TOOL_VALID',
      validationMessages: ['Custom profile validated.'],
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entityHash: await generateDeterministicHash({ customToolUUID, geom: customGeom.geometryHash })
    };

    this.tools.set(customToolUUID, customTool);

    // Initial audit log
    await this.logAuditEvent('TOOL_CREATED', 'tool-em-10mm-4f', '1.0.0', 'SYSTEM', { count: this.tools.size });
  }

  /**
   * Retrieves all tools (filtering out archived by default)
   */
  public static getAllTools(includeArchived: boolean = false): CAMTool[] {
    const list = Array.from(this.tools.values());
    if (includeArchived) return list;
    return list.filter(t => !t.isArchived);
  }

  /**
   * Retrieves a tool by UUID
   */
  public static getToolByUUID(uuid: ToolUUID): CAMTool | undefined {
    return this.tools.get(uuid);
  }

  /**
   * Retrieves a tool by human-friendly Tool ID (e.g. "T01")
   */
  public static getToolById(toolId: string): CAMTool | undefined {
    return Array.from(this.tools.values()).find(t => t.toolId.toLowerCase() === toolId.toLowerCase());
  }

  /**
   * Searches and filters tools by criteria
   */
  public static searchTools(filters: {
    query?: string;
    type?: ToolType;
    category?: ToolCategory;
    material?: ToolMaterial;
    coating?: ToolCoating;
    minDiameterMm?: number;
    maxDiameterMm?: number;
    fluteCount?: number;
    holderInterface?: HolderInterfaceType;
    scope?: LibraryScope;
  }): CAMTool[] {
    return this.getAllTools(false).filter(tool => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const matchesName = tool.name.toLowerCase().includes(q);
        const matchesId = tool.toolId.toLowerCase().includes(q);
        const matchesManuf = tool.manufacturer?.manufacturer.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesId && !matchesManuf) return false;
      }
      if (filters.type && tool.type !== filters.type) return false;
      if (filters.category && tool.category !== filters.category) return false;
      if (filters.material && tool.material !== filters.material) return false;
      if (filters.coating && tool.coating !== filters.coating) return false;
      if (filters.minDiameterMm !== undefined && tool.geometry.dimensions.cuttingDiameterMm < filters.minDiameterMm) return false;
      if (filters.maxDiameterMm !== undefined && tool.geometry.dimensions.cuttingDiameterMm > filters.maxDiameterMm) return false;
      if (filters.fluteCount !== undefined && tool.geometry.dimensions.fluteCount !== filters.fluteCount) return false;
      if (filters.holderInterface && !tool.compatibleHolders.includes(filters.holderInterface)) return false;
      if (filters.scope && tool.libraryScope !== filters.scope) return false;
      return true;
    });
  }

  /**
   * Creates a new custom or catalog tool
   */
  public static async createTool(params: {
    toolId: string;
    name: string;
    type: ToolType;
    category: ToolCategory;
    dimensions: ToolDimensions;
    material: ToolMaterial;
    coating: ToolCoating;
    scope?: LibraryScope;
    projectId?: string;
    manufacturerName?: string;
  }): Promise<CAMTool> {
    const toolUUID = `tool-${params.type.toLowerCase().replace(/_/g, '-')}-${generateDeterministicHashSync({
      toolId: params.toolId,
      type: params.type,
      dimensions: params.dimensions,
      material: params.material
    }).substring(0, 16)}`;
    const geometry = await ToolGeometryEngine.createGeometryModel(params.type, params.dimensions);
    
    const cuttingParams = [
      ToolCuttingCalculator.generateRecommendedParameters(params.type, params.dimensions.cuttingDiameterMm, params.dimensions.fluteCount, params.material, 'ISO_N_NON_FERROUS', 'USER_DEFINED'),
      ToolCuttingCalculator.generateRecommendedParameters(params.type, params.dimensions.cuttingDiameterMm, params.dimensions.fluteCount, params.material, 'ISO_P_STEEL', 'USER_DEFINED')
    ];

    const version: ToolVersionInfo = {
      versionString: '1.0.0',
      revisionNumber: 1,
      createdAtTimestamp: Date.now(),
      author: 'Current User',
      changeLog: 'Initial tool creation.',
      versionHash: await generateDeterministicHash({ toolUUID, v: '1.0.0', geom: geometry.geometryHash })
    };

    const entityPayload = {
      toolUUID,
      toolId: params.toolId,
      type: params.type,
      dims: params.dimensions,
      version: version.versionString,
      geometryHash: geometry.geometryHash
    };

    const entityHash = await generateDeterministicHash(entityPayload);

    const standardHolders = ToolAssemblyEngine.getStandardHolders();

    const tool: CAMTool = {
      toolUUID,
      toolId: params.toolId,
      name: params.name,
      type: params.type,
      category: params.category,
      version,
      geometry,
      material: params.material,
      coating: params.coating,
      coatingThicknessUm: 3.0,
      manufacturer: {
        manufacturer: params.manufacturerName || 'Custom Manufacturing Shop',
        orderCode: `TOOL-${params.toolId}`
      },
      cuttingParameters: cuttingParams,
      compatibleHolders: ['BT40', 'HSK_A63', 'CAT40'],
      defaultHolder: standardHolders[0],
      availability: 'AVAILABLE',
      libraryScope: params.scope || 'GLOBAL',
      projectId: params.projectId,
      validationStatus: 'TOOL_VALID',
      validationMessages: [],
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entityHash
    };

    // Validate
    const validation = ToolValidator.validateTool(tool);
    tool.validationStatus = validation.status;
    tool.validationMessages = [...validation.errors, ...validation.warnings];

    this.tools.set(toolUUID, tool);
    await this.logAuditEvent('TOOL_CREATED', toolUUID, tool.version.versionString, 'USER', { name: tool.name });

    return tool;
  }

  /**
   * Updates an existing tool, automatically incrementing revision/version if geometry or critical parameters change
   */
  public static async updateTool(
    toolUUID: ToolUUID,
    updates: Partial<{
      name: string;
      dimensions: ToolDimensions;
      material: ToolMaterial;
      coating: ToolCoating;
      changeNote: string;
    }>
  ): Promise<CAMTool> {
    const existing = this.tools.get(toolUUID);
    if (!existing) throw new Error(`Tool with UUID ${toolUUID} not found.`);

    let geometry = existing.geometry;
    let geomChanged = false;

    if (updates.dimensions) {
      geometry = await ToolGeometryEngine.createGeometryModel(existing.type, updates.dimensions);
      geomChanged = geometry.geometryHash !== existing.geometry.geometryHash;
    }

    // Determine version revision
    let newVersion = existing.version;
    if (geomChanged || updates.material || updates.coating) {
      const revNum = existing.version.revisionNumber + 1;
      const [major, minor, patch] = existing.version.versionString.split('.').map(Number);
      const newVersionString = `${major}.${minor + 1}.0`;

      newVersion = {
        versionString: newVersionString,
        revisionNumber: revNum,
        createdAtTimestamp: Date.now(),
        author: 'Current User',
        changeLog: updates.changeNote || `Updated dimensions or coating (Rev ${revNum}).`,
        versionHash: await generateDeterministicHash({ toolUUID, v: newVersionString, geom: geometry.geometryHash }),
        parentVersionHash: existing.version.versionHash
      };

      await this.logAuditEvent('TOOL_VERSION_CREATED', toolUUID, newVersion.versionString, 'USER', { note: newVersion.changeLog });
    }

    const updatedTool: CAMTool = {
      ...existing,
      name: updates.name || existing.name,
      geometry,
      material: updates.material || existing.material,
      coating: updates.coating || existing.coating,
      version: newVersion,
      updatedAt: Date.now()
    };

    // Recompute entity hash
    updatedTool.entityHash = await generateDeterministicHash({
      toolUUID,
      name: updatedTool.name,
      v: updatedTool.version.versionString,
      geom: updatedTool.geometry.geometryHash
    });

    const validation = ToolValidator.validateTool(updatedTool);
    updatedTool.validationStatus = validation.status;
    updatedTool.validationMessages = [...validation.errors, ...validation.warnings];

    this.tools.set(toolUUID, updatedTool);
    await this.logAuditEvent('TOOL_UPDATED', toolUUID, updatedTool.version.versionString, 'USER', { updates });

    return updatedTool;
  }

  /**
   * Duplicates a tool into a new entity
   */
  public static async duplicateTool(sourceUUID: ToolUUID, newToolId?: string): Promise<CAMTool> {
    const source = this.tools.get(sourceUUID);
    if (!source) throw new Error(`Source tool ${sourceUUID} not found.`);

    const newId = newToolId || `${source.toolId}_COPY`;
    return this.createTool({
      toolId: newId,
      name: `${source.name} (Copy)`,
      type: source.type,
      category: source.category,
      dimensions: { ...source.geometry.dimensions },
      material: source.material,
      coating: source.coating,
      scope: source.libraryScope,
      projectId: source.projectId,
      manufacturerName: source.manufacturer?.manufacturer
    });
  }

  /**
   * Archives a tool
   */
  public static async archiveTool(toolUUID: ToolUUID): Promise<void> {
    const tool = this.tools.get(toolUUID);
    if (!tool) return;
    tool.isArchived = true;
    tool.updatedAt = Date.now();
    await this.logAuditEvent('TOOL_ARCHIVED', toolUUID, tool.version.versionString, 'USER', {});
  }

  /**
   * Restores an archived tool
   */
  public static async restoreTool(toolUUID: ToolUUID): Promise<void> {
    const tool = this.tools.get(toolUUID);
    if (!tool) return;
    tool.isArchived = false;
    tool.updatedAt = Date.now();
    await this.logAuditEvent('TOOL_RESTORED', toolUUID, tool.version.versionString, 'USER', {});
  }

  /**
   * Exports the entire or filtered tool library to JSON
   */
  public static exportLibraryJson(toolUUIDs?: ToolUUID[]): string {
    const toolsToExport = toolUUIDs
      ? toolUUIDs.map(id => this.tools.get(id)).filter(Boolean)
      : this.getAllTools(true);

    const exportPackage = {
      format: 'SECP_CAM_TOOL_LIBRARY_V3',
      exportedAt: Date.now(),
      toolCount: toolsToExport.length,
      tools: toolsToExport
    };

    return JSON.stringify(exportPackage, null, 2);
  }

  /**
   * Imports tool definitions from JSON
   */
  public static async importLibraryJson(jsonString: string): Promise<{ importedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let importedCount = 0;

    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.tools || !Array.isArray(parsed.tools)) {
        throw new Error('Invalid JSON format: missing "tools" array.');
      }

      for (const t of parsed.tools) {
        if (!t.toolUUID || !t.geometry || !t.type) {
          errors.push(`Tool record missing required fields.`);
          continue;
        }

        const validation = ToolValidator.validateTool(t);
        if (!validation.isValid) {
          errors.push(`Tool ${t.name || t.toolId} failed validation: ${validation.errors.join(', ')}`);
          continue;
        }

        this.tools.set(t.toolUUID, t);
        importedCount++;
        await this.logAuditEvent('TOOL_IMPORTED', t.toolUUID, t.version?.versionString || '1.0.0', 'SYSTEM', { name: t.name });
      }
    } catch (err: any) {
      errors.push(`Import parsing failed: ${err.message}`);
    }

    return { importedCount, errors };
  }

  /**
   * Logs an audit event with SHA-256 integrity digest
   */
  private static async logAuditEvent(
    eventType: ToolAuditEventType,
    toolUUID: ToolUUID,
    toolVersion: string,
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    const timestamp = Date.now();
    const eventId = `EVT_${generateDeterministicHashSync({ eventType, toolUUID, toolVersion, timestamp, details }).substring(0, 16)}`;
    const digest = await generateDeterministicHash({ eventId, eventType, toolUUID, toolVersion, timestamp, details });

    this.auditLogs.unshift({
      eventId,
      eventType,
      timestamp,
      toolUUID,
      toolVersion,
      userId,
      details,
      sha256Digest: digest
    });

    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  /**
   * Retrieves audit trail
   */
  public static getAuditTrail(toolUUID?: ToolUUID): ToolAuditEvent[] {
    if (toolUUID) {
      return this.auditLogs.filter(e => e.toolUUID === toolUUID);
    }
    return [...this.auditLogs];
  }
}
