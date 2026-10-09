/**
 * SECP CAD Kernel — Canonical Drawing Types
 * PROMPT-043: Drawing Canonicalization
 */

import { Point, Vector } from '../../cad-kernel/geometry/GeometryContracts';

export type DrawingViewType = 
  | 'FRONT' | 'BACK' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' 
  | 'ISOMETRIC' | 'SECTION' | 'DETAIL' | 'AUXILIARY' | 'PROJECTED';

export type LineClassification = 'VISIBLE' | 'HIDDEN' | 'SILHOUETTE' | 'SECTION' | 'CENTER' | 'CONSTRUCTION';

export interface DrawingLine {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  classification: LineClassification;
  sourceGeometryId?: string; // Reference to B-Rep Edge ID
}

export interface SectionDefinition {
  planePoint: Point;
  planeNormal: Vector;
  depth?: number;
}

export interface DetailDefinition {
  center: { x: number; y: number };
  radius: number;
}

export interface DrawingViewDefinition {
  viewId: string;
  sourceDocumentId: string;
  sourceModelRevision: string | number;
  viewType: DrawingViewType;
  projectionDirection: Vector;
  upDirection: Vector;
  origin: { x: number; y: number };
  scale: number;
  section?: SectionDefinition;
  detail?: DetailDefinition;
  lineage: string;
}

export interface DrawingDimension {
  id: string;
  type: 'LINEAR' | 'ANGULAR' | 'DIAMETER' | 'RADIUS';
  sourceEntityIds: string[]; // B-Rep Edge/Face IDs
  value: number;
  textOverride?: string;
  placement: { x: number; y: number };
  precision: number;
}

export interface DrawingSheet {
  sheetId: string;
  size: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'LETTER';
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  views: DrawingViewDefinition[];
  dimensions: DrawingDimension[];
  annotations: any[];
}

export interface DrawingDefinition {
  drawingId: string;
  sourceDocumentId: string;
  sourceModelRevision: string | number;
  sheets: DrawingSheet[];
  revision: string | number;
}
