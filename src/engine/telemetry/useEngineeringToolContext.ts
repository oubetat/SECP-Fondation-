/**
 * SECP Engineering OS — React Tool Context Hook & Provider
 * Phase 3 & 4 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Provides all 185 UI Workbench tools with live, memoized access to EngineeringToolContext.
 * - Supports both direct call with `doc` AND React Context consumption via `useEngineeringToolContext()`.
 * - Zero hardcoded or isolated fake numbers across all UI tools.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { EngineeringToolContext } from './EngineeringToolContext';
import { EngineeringTelemetryEngine } from './EngineeringTelemetryEngine';
import { ToolContextResolver } from './ToolContextResolver';

export const EngineeringToolReactContext = createContext<EngineeringToolContext | null>(null);

export interface EngineeringToolContextProviderProps {
  children: React.ReactNode;
  doc?: EngineeringDocument | null;
  activeSolid?: any;
  solvedStates?: {
    solvedFemRevision?: number;
    solvedCfdRevision?: number;
    toolpathCamRevision?: number;
    drawingRevision?: number;
    bomRevision?: number;
  };
}

export const EngineeringToolContextProvider: React.FC<EngineeringToolContextProviderProps> = ({
  children,
  doc,
  activeSolid,
  solvedStates
}) => {
  const contextValue = useMemo(() => {
    if (!doc) {
      return ToolContextResolver.createNullContext();
    }
    return EngineeringTelemetryEngine.getInstance().getToolContext(doc, activeSolid, solvedStates);
  }, [
    doc,
    doc?.revision,
    (doc as any)?.documentHash,
    doc?.features?.length,
    doc?.parameters?.length,
    activeSolid,
    solvedStates?.solvedFemRevision,
    solvedStates?.solvedCfdRevision,
    solvedStates?.toolpathCamRevision,
    solvedStates?.drawingRevision,
    solvedStates?.bomRevision
  ]);

  return React.createElement(
    EngineeringToolReactContext.Provider,
    { value: contextValue },
    children
  );
};

export function useEngineeringToolContext(
  doc?: EngineeringDocument | null,
  activeSolid?: any,
  solvedStates?: {
    solvedFemRevision?: number;
    solvedCfdRevision?: number;
    toolpathCamRevision?: number;
    drawingRevision?: number;
    bomRevision?: number;
  }
): EngineeringToolContext {
  const contextFromReact = useContext(EngineeringToolReactContext);

  const directContext = useMemo(() => {
    if (!doc) return null;
    return EngineeringTelemetryEngine.getInstance().getToolContext(doc, activeSolid, solvedStates);
  }, [
    doc,
    doc?.revision,
    (doc as any)?.documentHash,
    doc?.features?.length,
    doc?.parameters?.length,
    activeSolid,
    solvedStates?.solvedFemRevision,
    solvedStates?.solvedCfdRevision,
    solvedStates?.toolpathCamRevision,
    solvedStates?.drawingRevision,
    solvedStates?.bomRevision
  ]);

  if (directContext) return directContext;
  if (contextFromReact) return contextFromReact;

  return ToolContextResolver.createNullContext();
}
