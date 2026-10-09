import {
  ClearanceRequirement,
  ClearanceState,
  CollisionHierarchyType,
  CollisionObject,
  CollisionObjectType,
  CollisionSeverity,
  CollisionTolerancePolicy,
  ContactClassification,
  DistanceQueryResult,
  TrueCollisionVerdict
} from "./types";

export interface ClassificationResult {
  hierarchy: CollisionHierarchyType;
  severity: CollisionSeverity;
  contactClassification: ContactClassification;
  clearanceState: ClearanceState;
  verdict: TrueCollisionVerdict;
  message: string;
}

export class CollisionClassifier {
  /**
   * Classifies an interaction between two collision objects based on exact distance, tolerances, and machining context.
   */
  public static classifyInteraction(
    objA: CollisionObject,
    objB: CollisionObject,
    distResult: DistanceQueryResult,
    clearanceReq: ClearanceRequirement,
    tolerancePolicy: CollisionTolerancePolicy,
    isCuttingFeed: boolean = true
  ): ClassificationResult {
    const dist = distResult.minimumDistance;
    const isPenetrating = dist <= tolerancePolicy.collisionTolerance;
    const isMarginalClearance = dist > tolerancePolicy.collisionTolerance && dist < clearanceReq.minimumDistance;

    // Determine clearance state
    let clearanceState = ClearanceState.CLEAR;
    if (isPenetrating) {
      clearanceState = ClearanceState.VIOLATED;
    } else if (isMarginalClearance) {
      clearanceState = ClearanceState.MARGINAL;
    }

    // 1. Tool vs Workpiece
    if (
      (objA.type === CollisionObjectType.TOOL && objB.type === CollisionObjectType.WORKPIECE) ||
      (objB.type === CollisionObjectType.TOOL && objA.type === CollisionObjectType.WORKPIECE)
    ) {
      if (isPenetrating) {
        if (Math.abs(dist) <= tolerancePolicy.contactTolerance && isCuttingFeed) {
          return {
            hierarchy: CollisionHierarchyType.CONTACT,
            severity: CollisionSeverity.NONE,
            contactClassification: ContactClassification.VALID_CONTACT,
            clearanceState: ClearanceState.CLEAR,
            verdict: TrueCollisionVerdict.CONTACT_ONLY,
            message: "Valid cutting engagement between Tool tip and Workpiece surface."
          };
        } else {
          return {
            hierarchy: CollisionHierarchyType.GOUGE,
            severity: CollisionSeverity.CRITICAL,
            contactClassification: ContactClassification.UNINTENDED_CONTACT,
            clearanceState: ClearanceState.VIOLATED,
            verdict: TrueCollisionVerdict.GOUGE,
            message: `Gouge detected: Tool penetrating workpiece by ${Math.abs(dist).toFixed(4)} mm exceeding contact tolerance.`
          };
        }
      }
    }

    // 2. Tool vs Stock
    if (
      (objA.type === CollisionObjectType.TOOL && objB.type === CollisionObjectType.STOCK) ||
      (objB.type === CollisionObjectType.TOOL && objA.type === CollisionObjectType.STOCK)
    ) {
      if (isPenetrating) {
        if (isCuttingFeed) {
          return {
            hierarchy: CollisionHierarchyType.CONTACT,
            severity: CollisionSeverity.NONE,
            contactClassification: ContactClassification.INTENDED_MATERIAL_REMOVAL,
            clearanceState: ClearanceState.CLEAR,
            verdict: TrueCollisionVerdict.CONTACT_ONLY,
            message: "Intended cutting material removal in Stock."
          };
        } else {
          return {
            hierarchy: CollisionHierarchyType.INTERFERENCE,
            severity: CollisionSeverity.CRITICAL,
            contactClassification: ContactClassification.UNINTENDED_INTERFERENCE,
            clearanceState: ClearanceState.VIOLATED,
            verdict: TrueCollisionVerdict.STOCK_INTERFERENCE,
            message: "Rapid feed interference into raw stock volume without cutting feed."
          };
        }
      }
    }

    // 3. Tool Holder Collisions (Holder vs Workpiece, Stock, Fixture, Check Surface)
    if (objA.type === CollisionObjectType.TOOL_HOLDER || objB.type === CollisionObjectType.TOOL_HOLDER) {
      if (isPenetrating) {
        return {
          hierarchy: CollisionHierarchyType.CRITICAL,
          severity: CollisionSeverity.CRITICAL,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.VIOLATED,
          verdict: TrueCollisionVerdict.HOLDER_COLLISION,
          message: `CRITICAL: Tool Holder collision with ${objA.type === CollisionObjectType.TOOL_HOLDER ? objB.type : objA.type} (Penetration: ${Math.abs(dist).toFixed(4)} mm).`
        };
      } else if (isMarginalClearance) {
        return {
          hierarchy: CollisionHierarchyType.CLEARANCE_VIOLATION,
          severity: CollisionSeverity.WARNING,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.MARGINAL,
          verdict: TrueCollisionVerdict.CLEARANCE_VIOLATION,
          message: `WARNING: Tool Holder clearance margin violated (${dist.toFixed(3)} mm < required ${clearanceReq.minimumDistance} mm).`
        };
      }
    }

    // 4. Spindle Collisions
    if (objA.type === CollisionObjectType.SPINDLE || objB.type === CollisionObjectType.SPINDLE) {
      if (isPenetrating) {
        return {
          hierarchy: CollisionHierarchyType.CRITICAL,
          severity: CollisionSeverity.CRITICAL,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.VIOLATED,
          verdict: TrueCollisionVerdict.SPINDLE_COLLISION,
          message: `CRITICAL: Spindle body collision detected with ${objA.type === CollisionObjectType.SPINDLE ? objB.type : objA.type}.`
        };
      } else if (isMarginalClearance) {
        return {
          hierarchy: CollisionHierarchyType.CLEARANCE_VIOLATION,
          severity: CollisionSeverity.WARNING,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.MARGINAL,
          verdict: TrueCollisionVerdict.CLEARANCE_VIOLATION,
          message: `Spindle clearance margin violated (${dist.toFixed(3)} mm < ${clearanceReq.minimumDistance} mm).`
        };
      }
    }

    // 5. Fixture Collisions
    if (objA.type === CollisionObjectType.FIXTURE || objB.type === CollisionObjectType.FIXTURE) {
      if (isPenetrating) {
        return {
          hierarchy: CollisionHierarchyType.CRITICAL,
          severity: CollisionSeverity.CRITICAL,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.VIOLATED,
          verdict: TrueCollisionVerdict.FIXTURE_COLLISION,
          message: `CRITICAL: Collision with fixture component/clamp.`
        };
      }
    }

    // 6. Machine Head / Table Collisions
    if (
      objA.type === CollisionObjectType.MACHINE_HEAD || objB.type === CollisionObjectType.MACHINE_HEAD ||
      objA.type === CollisionObjectType.MACHINE_TABLE || objB.type === CollisionObjectType.MACHINE_TABLE
    ) {
      if (isPenetrating) {
        return {
          hierarchy: CollisionHierarchyType.CRITICAL,
          severity: CollisionSeverity.CRITICAL,
          contactClassification: ContactClassification.UNINTENDED_CONTACT,
          clearanceState: ClearanceState.VIOLATED,
          verdict: TrueCollisionVerdict.MACHINE_COLLISION,
          message: `CRITICAL: Machine structural component collision detected.`
        };
      }
    }

    // 7. General clearance or disjoint state
    if (isPenetrating) {
      return {
        hierarchy: CollisionHierarchyType.CRITICAL,
        severity: CollisionSeverity.CRITICAL,
        contactClassification: ContactClassification.UNINTENDED_CONTACT,
        clearanceState: ClearanceState.VIOLATED,
        verdict: TrueCollisionVerdict.COLLISION_DETECTED,
        message: `Collision detected between ${objA.name} and ${objB.name}.`
      };
    } else if (isMarginalClearance) {
      return {
        hierarchy: CollisionHierarchyType.CLEARANCE_VIOLATION,
        severity: CollisionSeverity.WARNING,
        contactClassification: ContactClassification.UNINTENDED_CONTACT,
        clearanceState: ClearanceState.MARGINAL,
        verdict: TrueCollisionVerdict.CLEARANCE_VIOLATION,
        message: `Clearance margin violated (${dist.toFixed(3)} mm < required ${clearanceReq.minimumDistance} mm).`
      };
    }

    return {
      hierarchy: CollisionHierarchyType.CONTACT,
      severity: CollisionSeverity.NONE,
      contactClassification: ContactClassification.VALID_CONTACT,
      clearanceState: ClearanceState.CLEAR,
      verdict: TrueCollisionVerdict.COLLISION_FREE,
      message: "Clear: minimum clearance maintained."
    };
  }
}
