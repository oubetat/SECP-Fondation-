/**
 * PATCH-SECP-044 — Technical Drawing & 2D Documentation Engine
 * Formal Data Model for 2D Engineering Drawings, Sheets, Views, Dimensions, GD&T, and Standards.
 */

export type ProjectionStandard = 'FIRST_ANGLE' | 'THIRD_ANGLE';
export type DrawingStandardType = 'ISO_128' | 'ASME_Y14_5' | 'DIN' | 'JIS';
export type SheetSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'LETTER' | 'TABLOID' | 'ANSI_D';
export type DrawingUnit = 'mm' | 'inch';

export type LineType = 'VISIBLE' | 'HIDDEN' | 'CENTER' | 'CONSTRUCTION' | 'DIMENSION' | 'HATCH' | 'SECTION_CUT';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Box2D {
  min: Vector2D;
  max: Vector2D;
}

export interface DrawingSegment2D {
  id: string;
  type: 'LINE';
  lineType: LineType;
  p1: Vector2D;
  p2: Vector2D;
  sourceEdgeId?: string;
  sourceFaceId?: string;
}

export interface DrawingArc2D {
  id: string;
  type: 'ARC' | 'CIRCLE';
  lineType: LineType;
  center: Vector2D;
  radius: number;
  startAngleRad: number;
  endAngleRad: number;
  sourceEdgeId?: string;
}

export interface DrawingPolyline2D {
  id: string;
  type: 'POLYLINE';
  lineType: LineType;
  points: Vector2D[];
  closed: boolean;
}

export interface DrawingHatchPolygon2D {
  id: string;
  boundary: Vector2D[];
  lines: { p1: Vector2D; p2: Vector2D }[];
  materialName: string;
  angleDeg: number;
  spacingMm: number;
}

export type DrawingGeometry2D = DrawingSegment2D | DrawingArc2D | DrawingPolyline2D;

export type ViewOrientation = 
  | 'FRONT' 
  | 'BACK' 
  | 'TOP' 
  | 'BOTTOM' 
  | 'LEFT' 
  | 'RIGHT' 
  | 'ISOMETRIC' 
  | 'SECTION' 
  | 'DETAIL';

export interface ViewTransform {
  cameraDirection: { x: number; y: number; z: number };
  upDirection: { x: number; y: number; z: number };
  scale: number; // e.g. 1.0 for 1:1, 0.5 for 1:2, 2.0 for 2:1
  positionOnSheet: Vector2D; // center point in mm on sheet
  rotationDeg: number;
}

export interface DrawingViewBase {
  id: string;
  name: string;
  type: ViewOrientation;
  scaleRatio: string; // e.g. "1:1", "1:2", "2:1"
  transform: ViewTransform;
  visible: boolean;
  sourceModelId: string;
  sourceRevision: number;
  boundingBox: Box2D;
  
  // Projected 2D Geometry
  visibleGeometry: DrawingGeometry2D[];
  hiddenGeometry: DrawingGeometry2D[];
  centerlines: DrawingGeometry2D[];
  silhouettes: DrawingGeometry2D[];
  
  // Annotations belonging directly to view
  dimensions: DrawingDimension[];
  gdtFrames: GdtFeatureControlFrame[];
  datums: DrawingDatum[];
  surfaceFinishes: SurfaceFinishSymbol[];
}

export interface OrthographicView extends DrawingViewBase {
  type: 'FRONT' | 'BACK' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
}

export interface IsometricView extends DrawingViewBase {
  type: 'ISOMETRIC';
  isoAngleDeg: number;
}

export type SectionType = 'FULL' | 'HALF' | 'OFFSET' | 'ALIGNED';

export interface SectionPlaneDef {
  origin: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  cuttingPolyline3D?: { x: number; y: number; z: number }[];
}

export interface SectionView extends DrawingViewBase {
  type: 'SECTION';
  sectionType: SectionType;
  sectionIdentifier: string; // e.g. "A-A", "B-B"
  parentViewId: string;
  plane: SectionPlaneDef;
  hatches: DrawingHatchPolygon2D[];
}

export interface DetailView extends DrawingViewBase {
  type: 'DETAIL';
  detailIdentifier: string; // e.g. "B", "C"
  parentViewId: string;
  detailCircleCenter: Vector2D;
  detailCircleRadiusMm: number;
  magnificationScale: number; // e.g. 4.0 for 4:1
}

export type DrawingView = OrthographicView | IsometricView | SectionView | DetailView;

// Dimension Engine Models
export type DimensionType = 
  | 'LINEAR' 
  | 'ALIGNED' 
  | 'ANGULAR' 
  | 'RADIAL' 
  | 'DIAMETER' 
  | 'ARC_LENGTH' 
  | 'BASELINE' 
  | 'CHAIN' 
  | 'ORDINATE';

export interface DimensionTolerance {
  type: 'SYMMETRIC' | 'DEVIATION' | 'LIMITS' | 'BASIC' | 'REFERENCE';
  upperMm: number;
  lowerMm: number;
  precision: number;
}

export interface DrawingDimension {
  id: string;
  type: DimensionType;
  viewId: string;
  measuredValue: number; // Exact measured geometric value from real 3D B-Rep
  overrideText?: string;
  prefix?: string; // e.g. "Ø ", "R ", "4x Ø "
  suffix?: string; // e.g. " THRU", " DEEP 15"
  tolerance?: DimensionTolerance;
  
  // Geometric anchor points in sheet coordinates (mm)
  startPoint: Vector2D;
  endPoint: Vector2D;
  textPosition: Vector2D;
  extensionLine1: { p1: Vector2D; p2: Vector2D };
  extensionLine2: { p1: Vector2D; p2: Vector2D };
  dimensionLine: { p1: Vector2D; p2: Vector2D };
  
  // Associative geometric link
  sourceEntityRefs?: {
    entityType: 'EDGE' | 'VERTEX' | 'FACE' | 'CYLINDER_AXIS';
    entityId: string;
    featureId: string;
  }[];
}

// GD&T Foundation Models
export type GdtCharacteristic = 
  | 'POSITION' 
  | 'FLATNESS' 
  | 'PARALLELISM' 
  | 'PERPENDICULARITY' 
  | 'CONCENTRICITY' 
  | 'CYLINDRICITY' 
  | 'CIRCULAR_RUNOUT';

export type MaterialConditionModifier = 'NONE' | 'MMC' | 'LMC' | 'RFS'; // MMC: Ⓜ, LMC: Ⓛ, RFS: Ⓢ

export interface GdtFeatureControlFrame {
  id: string;
  viewId: string;
  characteristic: GdtCharacteristic;
  diameterSymbol: boolean; // Ø
  toleranceValue: number; // e.g. 0.05
  materialCondition: MaterialConditionModifier;
  primaryDatum: string; // e.g. "A"
  primaryMaterialCondition?: MaterialConditionModifier;
  secondaryDatum?: string; // e.g. "B"
  secondaryMaterialCondition?: MaterialConditionModifier;
  tertiaryDatum?: string; // e.g. "C"
  tertiaryMaterialCondition?: MaterialConditionModifier;
  position: Vector2D;
  leaderAnchor?: Vector2D;
  status: 'SUPPORTED' | 'NOT_YET_VERIFIED';
}

export interface DrawingDatum {
  id: string;
  viewId: string;
  datumLabel: string; // "A", "B", "C", "D"
  position: Vector2D;
  targetNormal: Vector2D;
  attachedToFeatureId?: string;
}

export interface SurfaceFinishSymbol {
  id: string;
  viewId: string;
  raMicrons: number; // e.g. 1.6
  rzMicrons?: number; // e.g. 6.3
  machiningAllowanceMm?: number;
  position: Vector2D;
}

export interface DrawingCenterline {
  id: string;
  viewId: string;
  p1: Vector2D;
  p2: Vector2D;
  type: 'LINEAR_CENTER' | 'CIRCULAR_CROSS' | 'BOLT_CIRCLE';
  centerPoint?: Vector2D;
  radius?: number;
}

export interface TitleBlock {
  title: string;
  drawingNumber: string;
  revision: string;
  author: string;
  checker?: string;
  approver?: string;
  companyName: string;
  creationDate: string;
  material: string;
  finish: string;
  sheetScale: string;
  massKg: number;
  status: 'PRELIMINARY' | 'APPROVED' | 'RELEASED';
}

export interface RevisionTableEntry {
  revision: string;
  description: string;
  date: string;
  approvedBy: string;
}

export interface BomTableRow {
  itemNumber: number;
  partNumber: string;
  description: string;
  quantity: number;
  material: string;
  massPerItemKg: number;
}

export interface DrawingTable {
  id: string;
  title: string;
  type: 'REVISION_TABLE' | 'BOM_TABLE' | 'HOLE_TABLE';
  position: Vector2D;
  columns: { header: string; widthMm: number }[];
  rows: string[][];
}

export interface DrawingNote {
  id: string;
  number: number;
  text: string;
  position: Vector2D;
}

export interface DrawingSheet {
  id: string;
  name: string;
  size: SheetSize;
  widthMm: number;
  heightMm: number;
  standard: DrawingStandardType;
  projection: ProjectionStandard;
  units: DrawingUnit;
  views: DrawingView[];
  dimensions: DrawingDimension[];
  gdtFrames: GdtFeatureControlFrame[];
  datums: DrawingDatum[];
  surfaceFinishes: SurfaceFinishSymbol[];
  centerlines: DrawingCenterline[];
  tables: DrawingTable[];
  titleBlock: TitleBlock;
  revisionHistory: RevisionTableEntry[];
  notes: DrawingNote[];
}

export interface DrawingRevisionRecord {
  drawingId: string;
  partRevision: number;
  assemblyRevision: number;
  drawingRevision: number;
  kernelVersion: string;
  projectionVersion: string;
  timestamp: string;
  author: string;
  notes: string;
}

export interface DrawingDocument {
  id: string;
  name: string;
  sourceModelId: string;
  sourceModelType: 'PART' | 'ASSEMBLY';
  standard: DrawingStandardType;
  projection: ProjectionStandard;
  activeSheetId: string;
  sheets: DrawingSheet[];
  revisions: DrawingRevisionRecord[];
  createdAt: string;
  updatedAt: string;
}
