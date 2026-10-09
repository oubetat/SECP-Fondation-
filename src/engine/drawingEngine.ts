/**
 * PATCH-SECP-044 — Technical Drawing & 2D Documentation Engine
 * Re-export index bridge providing unified access to Drawing Document Core, Projection Engine,
 * HLR, Section Engine, Real Dimensions, GD&T, Standards, and Vector Exporters.
 */

export * from './drawing/DrawingTypes';
export * from './drawing/DrawingStandard';
export * from './drawing/HiddenLineRemoval';
export * from './drawing/ProjectionEngine';
export * from './drawing/SectionEngine';
export * from './drawing/DimensionEngine';
export * from './drawing/GdtEngine';
export * from './drawing/DrawingExporter';
export * from './drawing/ParametricAssociationEngine';
export * from './drawing/DrawingDocumentCore';

import { DrawingDocumentCore } from './drawing/DrawingDocumentCore';
import { DrawingDocument } from './drawing/DrawingTypes';

export class TechnicalDrawingEngine {
  public static createDocument(title?: string): DrawingDocumentCore {
    return new DrawingDocumentCore(title);
  }

  public static generateTechnicalDrawing(): DrawingDocument {
    const core = new DrawingDocumentCore();
    return core.getDocument();
  }
}
