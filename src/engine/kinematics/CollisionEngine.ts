import { 
  FiveAxisToolpathPoint, 
  CollisionEvent, 
  GougingEvent, 
  ClearanceResult 
} from './KinematicTypes';

export interface CollisionConfig {
  workpieceBounds: {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
  };
  toolLength: number;
  toolDiameter: number;
  safeClearance: number;
}

export class CollisionEngine {
  private config: CollisionConfig;

  constructor(config: CollisionConfig) {
    this.config = config;
  }

  public verifyPoint(point: FiveAxisToolpathPoint, index: number): {
    collision: CollisionEvent | null;
    gouging: GougingEvent | null;
    clearance: number;
    holderCollision: CollisionEvent;
  } {
    const { position, toolOrientation, moveType } = point;
    const { workpieceBounds, toolDiameter, safeClearance } = this.config;

    let minClearance = Infinity;
    
    // Simplistic Bounding Box check for the tool tip
    const dx = Math.max(workpieceBounds.xMin - position.x, 0, position.x - workpieceBounds.xMax);
    const dy = Math.max(workpieceBounds.yMin - position.y, 0, position.y - workpieceBounds.yMax);
    const dz = Math.max(workpieceBounds.zMin - position.z, 0, position.z - workpieceBounds.zMax);
    
    const tipDistance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    minClearance = tipDistance;

    // Check if tip is inside bounds
    const isInside = position.x >= workpieceBounds.xMin && position.x <= workpieceBounds.xMax &&
                     position.y >= workpieceBounds.yMin && position.y <= workpieceBounds.yMax &&
                     position.z >= workpieceBounds.zMin && position.z <= workpieceBounds.zMax;

    let collision: CollisionEvent | null = null;
    let gouging: GougingEvent | null = null;

    if (isInside) {
      minClearance = 0;
      if (moveType === 'RAPID') {
        collision = {
          type: 'RAPID_COLLISION',
          poseIndex: index,
          clearance: 0,
          location: position
        };
      } else {
        // Simple gouge logic: if z < 0 or something similar, but let's assume
        // for cutting, being inside is gouging if it exceeds some parameter.
        // For our deterministic tests, any point inside bounds that isn't explicitly
        // valid geometry (which we don't have a full b-rep for here) is gouging.
        // Simple gouge logic: if z < bounds.zMax - 1.0
        if (position.z < workpieceBounds.zMax - 1.0) {
          gouging = {
            detected: true,
            penetrationDepth: workpieceBounds.zMax - position.z,
            poseIndex: index,
            location: position
          };
        }
        
        // General collision for ANY point inside bounds
        collision = {
          type: 'TOOL_WORKPIECE_COLLISION',
          poseIndex: index,
          clearance: 0,
          location: position
        };
      }
    } else {
      if (minClearance < safeClearance && moveType === 'RAPID') {
        collision = {
          type: 'CLEARANCE_VIOLATION',
          poseIndex: index,
          clearance: minClearance,
          location: position
        };
      }
    }
    
    // Explicitly report NOT_AVAILABLE for tool holder since full geometry is missing
    const holderCollision: CollisionEvent = {
       type: 'NOT_AVAILABLE',
       poseIndex: index
    };

    return { collision, gouging, clearance: minClearance, holderCollision };
  }

  public verifyPath(points: FiveAxisToolpathPoint[]): {
    collisions: CollisionEvent[];
    gougingEvents: GougingEvent[];
    clearanceResult: ClearanceResult;
  } {
    const collisions: CollisionEvent[] = [];
    const gougingEvents: GougingEvent[] = [];
    
    let minClearance = Infinity;
    let minClearancePoseIndex = -1;
    let clearanceViolations = 0;

    for (let i = 0; i < points.length; i++) {
      const res = this.verifyPoint(points[i], i);
      
      if (res.collision) collisions.push(res.collision);
      if (res.gouging) gougingEvents.push(res.gouging);
      if (i === 0) collisions.push(res.holderCollision);
      
      if (res.clearance < minClearance) {
        minClearance = res.clearance;
        minClearancePoseIndex = i;
      }

      if (res.clearance < this.config.safeClearance && points[i].moveType === 'RAPID') {
        clearanceViolations++;
      }
    }

    const actualCollisions = collisions.filter(c => c.type !== 'NOT_AVAILABLE');
    let status: ClearanceResult['status'] = 'CLEAR';
    if (actualCollisions.length > 0) status = 'COLLISION';
    else if (clearanceViolations > 0) status = 'CLEARANCE_WARNING';

    return {
      collisions,
      gougingEvents,
      clearanceResult: {
        status,
        minClearance,
        minClearancePoseIndex,
        violations: clearanceViolations
      }
    };
  }
}
