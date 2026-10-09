/**
 * SECP Industrial OS v3 — PROMPT-053: useCapabilityMirror Hook
 * Custom React hook allowing UI components to dynamically query capability mirror projections
 * directly from the Canonical Capability Mirror store.
 */

import { useState, useEffect } from 'react';
import { FrontendCapabilityMirror } from './FrontendCapabilityMirror';
import { CapabilityMirrorProjection, WorkplaceContext } from './CapabilityMirrorTypes';

export function useCapabilityMirror(
  capabilityId: string,
  context?: WorkplaceContext,
  componentName: string = 'UIComponent'
): CapabilityMirrorProjection {
  const mirrorStore = FrontendCapabilityMirror.getInstance();

  const [projection, setProjection] = useState<CapabilityMirrorProjection>(() => {
    // Register claim on initial mount
    mirrorStore.registerClaim({
      capabilityId,
      claimedBy: componentName,
      claimedExposed: true,
      claimedEnabled: true
    });
    return mirrorStore.projectTool(capabilityId, context);
  });

  useEffect(() => {
    const update = () => {
      setProjection(mirrorStore.projectTool(capabilityId, context));
    };

    // Subscribe to mirror store updates
    const unsubscribe = mirrorStore.subscribe(update);
    update();

    return () => {
      unsubscribe();
    };
  }, [capabilityId, JSON.stringify(context)]);

  return projection;
}
