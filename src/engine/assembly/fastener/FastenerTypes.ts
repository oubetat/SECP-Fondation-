/**
 * SECP FASTENER ENGINEERING TYPES (PATCH-226)
 * 
 * Standard-compliant data structures and interfaces for parametric fasteners:
 * Bolts, Screws, Studs, Threaded Rods, Nuts, Washers, Bolted Joint Stacks,
 * Hole Configurations, Real Thread Geometry, Torque/Preload, Tool Access, and BOM.
 */

export type FastenerStandardType = 'ISO' | 'DIN' | 'ANSI_ASME' | 'JIS' | 'CUSTOM';

export type FastenerCategory = 
  | 'HEX_BOLT'
  | 'SOCKET_HEAD_CAP_SCREW'
  | 'COUNTERSUNK_SCREW'
  | 'PAN_HEAD_SCREW'
  | 'FLAT_HEAD_SCREW'
  | 'MACHINE_SCREW'
  | 'SET_SCREW'
  | 'STUD'
  | 'THREADED_ROD'
  | 'HEX_NUT'
  | 'LOCK_NUT'
  | 'FLANGE_NUT'
  | 'SQUARE_NUT'
  | 'PLAIN_WASHER'
  | 'LOCK_WASHER'
  | 'FLANGE_BOLT'
  | 'BELLEVILLE_WASHER';

export type FastenerHeadType =
  | 'HEX'
  | 'SOCKET_CYLINDRICAL'
  | 'COUNTERSUNK_90'
  | 'COUNTERSUNK_82'
  | 'PAN'
  | 'BUTTON'
  | 'FLANGE_HEX'
  | 'SET_CUP_POINT'
  | 'SET_CONE_POINT'
  | 'SET_FLAT_POINT'
  | 'NONE_STUD'
  | 'NUT_HEX'
  | 'NUT_FLANGE'
  | 'WASHER_FLAT'
  | 'WASHER_SPRING';

export type FastenerDriveType =
  | 'HEX_EXTERNAL'
  | 'ALLEN_HEX_INTERNAL'
  | 'TORX'
  | 'PHILLIPS'
  | 'SLOTTED'
  | 'POZIDRIV'
  | 'SQUARE_INTERNAL'
  | 'NONE';

export type ThreadSystem = 'METRIC_COARSE' | 'METRIC_FINE' | 'UNC' | 'UNF' | 'WHITWORTH';

export type ThreadHand = 'RIGHT_HAND' | 'LEFT_HAND';

export type ThreadGender = 'EXTERNAL' | 'INTERNAL';

export type ToleranceClass = '6g' | '6H' | '6e' | '4h' | '2A' | '2B' | '3A' | '3B';

export type PropertyClass = 
  | 'CLASS_4_6'
  | 'CLASS_4_8'
  | 'CLASS_8_8'
  | 'CLASS_10_9'
  | 'CLASS_12_9'
  | 'STAINLESS_A2_70'
  | 'STAINLESS_A4_80'
  | 'BRASS_MS58'
  | 'TITANIUM_GRADE5'
  | 'ALUMINUM_7075_T6';

export type SurfaceTreatment =
  | 'PLAIN_BLACK_OXIDE'
  | 'ZINC_PLATED_CLEAR'
  | 'ZINC_PLATED_YELLOW'
  | 'HOT_DIP_GALVANIZED'
  | 'PASSIVATED_STAINLESS'
  | 'ANODIZED'
  | 'PTFE_XYLAN'
  | 'CADMIUM_PLATED';

export type HoleType = 
  | 'THROUGH_HOLE'
  | 'BLIND_HOLE'
  | 'COUNTERBORE'
  | 'COUNTERSINK'
  | 'TAPPED_HOLE'
  | 'CLEARANCE_HOLE';

export type ClearanceFitClass = 'FINE' | 'MEDIUM' | 'COARSE';

export interface FastenerMaterialProperties {
  id: PropertyClass;
  name: string;
  nominalYieldStrength_MPa: number; // Rp0.2 or Re
  nominalTensileStrength_MPa: number; // Rm
  youngsModulus_GPa: number;
  poissonsRatio: number;
  density_kg_m3: number;
  hardness: string; // e.g. "22-32 HRC"
  shearStrength_MPa: number;
  elongationAtFracture_pct: number;
}

export interface FastenerSurfaceProperties {
  treatment: SurfaceTreatment;
  name: string;
  threadFrictionCoeff_mu_th: number; // Friction in threads
  bearingFrictionCoeff_mu_b: number; // Friction under head / nut face
  corrosionResistanceHours_SaltSpray: number;
  coatingThickness_um: number;
}

export interface ThreadSpecification {
  system: ThreadSystem;
  nominalDiameter_d_mm: number;
  pitch_P_mm: number;
  threadsPerInch?: number;
  majorDiameter_d_mm: number; // d (external) or D (internal)
  pitchDiameter_d2_mm: number; // d2 or D2
  minorDiameter_d1_mm: number; // d1 or D1
  rootRadius_r_mm: number;
  threadAngle_deg: number; // 60° for Metric/UN, 55° for Whitworth
  hand: ThreadHand;
  gender: ThreadGender;
  toleranceClass: ToleranceClass;
  isRealGeometry: boolean; // True for true B-Rep helical model, false for cosmetic
  threadLength_b_mm: number;
}

export interface FastenerDimensions {
  nominalDiameter_d_mm: number;
  overallLength_L_mm: number;
  threadLength_b_mm: number;
  shankLength_ls_mm: number; // unthreaded portion
  shankDiameter_ds_mm: number;
  headDiameter_dk_mm: number;
  headHeight_k_mm: number;
  widthAcrossFlats_s_mm: number; // Hex key or wrench size
  widthAcrossCorners_e_mm: number;
  driveSize_mm: number; // Socket size (e.g. 6mm hex key)
  driveDepth_t_mm: number;
  flangeDiameter_dc_mm?: number;
  countersinkAngle_deg?: number;
  chamferLength_z_mm: number;
  
  // Nut specific
  nutHeight_m_mm?: number;
  
  // Washer specific
  washerInsideDiameter_d1_mm?: number;
  washerOutsideDiameter_d2_mm?: number;
  washerThickness_h_mm?: number;
  washerChamfer_mm?: number;
}

export interface HoleConfiguration {
  holeType: HoleType;
  nominalBoltDiameter_mm: number;
  fitClass: ClearanceFitClass;
  holeDiameter_dh_mm: number;
  holeDepth_mm: number;
  counterboreDiameter_dcb_mm?: number;
  counterboreDepth_tcb_mm?: number;
  countersinkDiameter_dcs_mm?: number;
  countersinkAngle_deg?: number;
  tapDrillDiameter_dt_mm?: number;
  tapThreadDepth_mm?: number;
  standardReference: string; // e.g. "ISO 273 Medium Fit"
}

export interface FastenerMechanicalAnalysis {
  tensileStressArea_As_mm2: number;
  proofLoad_Fp_N: number;
  maxYieldClampLoad_F02_N: number;
  recommendedPreload_Fm_N: number; // 90% of proof load
  tighteningTorque_Ma_Nm: number; // VDI 2230 tightening torque
  torqueCoefficient_K: number; // K-factor approx 0.15-0.20
  yieldUtilization_pct: number;
  threadShearArea_female_mm2: number;
  threadShearArea_male_mm2: number;
  minimumRequiredEngagementLength_Le_mm: number;
  safetyFactorYield: number;
  status: 'VERIFIED' | 'UNPROVEN' | 'CRITICAL_RISK';
}

export interface ToolAccessEnvelope {
  driveType: FastenerDriveType;
  toolType: 'SOCKET_WRENCH' | 'ALLEN_KEY' | 'SCREWDRIVER' | 'OPEN_WRENCH';
  toolOuterDiameter_mm: number;
  toolClearanceRadius_mm: number;
  toolAxialClearance_mm: number;
  isAccessFeasible: boolean;
  clearanceMargin_mm: number;
  diagnostic: string;
}

export interface ClampedPly {
  id: string;
  name: string;
  thickness_mm: number;
  materialName: string;
  tensileStrength_MPa: number;
  holeDiameter_mm: number;
}

export interface BoltedJointStack {
  stackId: string;
  name: string;
  fastener: FastenerSpecification;
  topWashers: FastenerSpecification[];
  clampedPlies: ClampedPly[];
  bottomWashers: FastenerSpecification[];
  nuts: FastenerSpecification[];
  
  // Calculated stack metrics
  totalGripLength_Lg_mm: number; // sum of plies + washers
  requiredFastenerLength_Lreq_mm: number;
  actualFastenerLength_L_mm: number;
  threadProtrusionPastNut_P_mm: number; // excess thread sticking out
  availableThreadEngagement_mm: number;
  engagementRatio: number; // actual / required
  
  diagnosticVerdict: 'SAFE_CLAMPED' | 'INSUFFICIENT_ENGAGEMENT' | 'EXCESSIVE_PROTRUSION' | 'BOTTOMING_BEFORE_CLAMPING' | 'FASTENER_TOO_SHORT' | 'UNVERIFIED';
  diagnosticMessage: string;
}

export interface FastenerPattern {
  patternId: string;
  type: 'CIRCULAR_PCD' | 'LINEAR_ARRAY' | 'RECTANGULAR_GRID' | 'HOLE_ASSOCIATIVE';
  sourceFastenerId: string;
  instanceCount: number;
  
  // Circular parameters
  pitchCircleDiameter_PCD_mm?: number;
  centerPoint?: { x: number; y: number; z: number };
  startAngle_deg?: number;
  angularSpacing_deg?: number;
  
  // Linear / Grid parameters
  spacingX_mm?: number;
  spacingY_mm?: number;
  countX?: number;
  countY?: number;
  
  instancePositions: Array<{
    instanceIndex: number;
    position: { x: number; y: number; z: number };
    rotationAngle_deg: number;
  }>;
}

export interface FastenerFeatureNode {
  id: string;
  name: string;
  type: 
    | 'STANDARD_DEFINITION'
    | 'SHANK_CYLINDER'
    | 'HELICAL_THREAD'
    | 'HEAD_PRISM'
    | 'DRIVE_RECESS'
    | 'CHAMFER_ROOT'
    | 'WASHER_BODY'
    | 'NUT_BODY'
    | 'MATERIAL_BINDING'
    | 'SURFACE_FINISH';
  parameters: Record<string, any>;
  status: 'VALID' | 'SUPPRESSED' | 'MODIFIED' | 'FAILED';
  dependencies: string[];
}

export interface FastenerBRepSolid {
  solidId: string;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  shellCount: number;
  isWatertight: boolean;
  isManifold: boolean;
  eulerPoincareFormula: string; // "V - E + F = 2"
  eulerValid: boolean;
  volume_mm3: number;
  surfaceArea_mm2: number;
  mass_grams: number;
  centerOfGravity_mm: { x: number; y: number; z: number };
  boundingMin_mm: { x: number; y: number; z: number };
  boundingMax_mm: { x: number; y: number; z: number };
  meshTrianglesCount: number;
  vertices3D: Float32Array;
  indices3D: Uint32Array;
  normals3D: Float32Array;
}

export interface FastenerSpecification {
  id: string;
  partNumber: string;
  standard: FastenerStandardType;
  standardCode: string; // e.g. "ISO 4017", "DIN 912", "ASME B18.3"
  category: FastenerCategory;
  headType: FastenerHeadType;
  driveType: FastenerDriveType;
  
  // Core Parametric Geometry
  dimensions: FastenerDimensions;
  thread: ThreadSpecification;
  
  // Material & Surface Treatment
  material: FastenerMaterialProperties;
  surfaceTreatment: FastenerSurfaceProperties;
  
  // Engineering Engines
  mechanical: FastenerMechanicalAnalysis;
  holeRecommendation: HoleConfiguration;
  toolAccess: ToolAccessEnvelope;
  
  // CAD & B-Rep
  featureTree: FastenerFeatureNode[];
  brepSolid?: FastenerBRepSolid;
  
  // PLM & Quality Metadata
  revision: string;
  supplierCode: string;
  inspectionRequirements: string;
  evidenceHashSha256?: string;
  createdAt: string;
}

export interface FastenerBOMItem {
  itemNumber: number;
  partNumber: string;
  standardCode: string;
  description: string;
  category: FastenerCategory;
  nominalSize: string; // e.g. "M10 x 45"
  materialName: string;
  surfaceFinish: string;
  quantity: number;
  unitMass_grams: number;
  totalMass_grams: number;
  torqueSpecification_Nm: number;
  status: 'APPROVED' | 'PENDING_AUDIT' | 'REJECTED';
}
