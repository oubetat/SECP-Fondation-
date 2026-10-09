/**
 * SECP Engineering OS — Canonical Engineering Telemetry Engine
 * Phase 1 & 2 Core (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Serves as the central Telemetry Layer managing EngineeringToolContext generation,
 *   memoized caching, and invalidation notifications for all 185 UI workbench tools.
 * - Enforces zero fake/hardcoded strings. All UI tabs receive projections computed from EngineeringDocument SOT.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { EngineeringToolContext, EngineeringInvalidation } from './EngineeringToolContext';
import { ToolContextResolver } from './ToolContextResolver';
import { TelemetryHasher } from './TelemetryHasher';

type TelemetryListener = (context: EngineeringToolContext) => void;

export class EngineeringTelemetryEngine {
  private static instance: EngineeringTelemetryEngine;
  private listeners: Set<TelemetryListener> = new Set();
  private cachedContexts = new Map<string, EngineeringToolContext>();

  private constructor() {}

  public static getInstance(): EngineeringTelemetryEngine {
    if (!EngineeringTelemetryEngine.instance) {
      EngineeringTelemetryEngine.instance = new EngineeringTelemetryEngine();
    }
    return EngineeringTelemetryEngine.instance;
  }

  /**
   * Primary entry point: Evaluates or retrieves memoized EngineeringToolContext.
   */
  public getToolContext(
    doc: EngineeringDocument,
    activeSolid?: any,
    solvedStates?: {
      solvedFemRevision?: number;
      solvedCfdRevision?: number;
      toolpathCamRevision?: number;
      drawingRevision?: number;
      bomRevision?: number;
    }
  ): EngineeringToolContext {
    if (!doc) {
      return ToolContextResolver.createNullContext();
    }

    const docHash = doc.documentHash || TelemetryHasher.hashObject(doc);
    const cacheKey = `${doc.documentId}_r${doc.revision}_${docHash}_fem${solvedStates?.solvedFemRevision}_cam${solvedStates?.toolpathCamRevision}`;

    if (this.cachedContexts.has(cacheKey)) {
      return this.cachedContexts.get(cacheKey)!;
    }

    const context = ToolContextResolver.resolveContext(doc, activeSolid, solvedStates);
    this.cachedContexts.set(cacheKey, context);

    // Notify active subscribers
    this.listeners.forEach(fn => fn(context));

    return context;
  }

  /**
   * Subscribe to telemetry updates.
   */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clears all cached telemetry.
   */
  public clearCache(): void {
    this.cachedContexts.clear();
  }
}

export const canonicalTelemetryEngine = EngineeringTelemetryEngine.getInstance();
