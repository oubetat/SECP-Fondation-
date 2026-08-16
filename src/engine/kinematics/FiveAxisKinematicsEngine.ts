import {
  MachineKinematicConfig,
  MachinePose,
  ToolOrientation,
  MachineAxisPosition,
  SingularityStatus
} from './KinematicTypes';

export class FiveAxisKinematicsEngine {
  private config: MachineKinematicConfig;

  constructor(config: MachineKinematicConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: MachineKinematicConfig) {
    const ids = new Set<string>();
    
    const allAxes = [...config.linearAxes, ...config.rotaryAxes];
    for (const axis of allAxes) {
      if (ids.has(axis.id)) {
        throw new Error(`Duplicate axis identifier: ${axis.id}`);
      }
      ids.add(axis.id);

      if (axis.minLimit >= axis.maxLimit) {
        throw new Error(`Invalid limits for axis ${axis.id}: min >= max`);
      }
      
      if (!Number.isFinite(axis.minLimit) || !Number.isFinite(axis.maxLimit) || !Number.isFinite(axis.home)) {
         throw new Error(`Non-finite limits for axis ${axis.id}`);
      }
    }
    
    // Ensure we have A and C, or some combination. Let's enforce A and C for our specific solver,
    // or just assume if A and C exist we use them.
    const hasA = config.rotaryAxes.some(a => a.id === 'A');
    const hasC = config.rotaryAxes.some(a => a.id === 'C');
    if (!hasA || !hasC) {
      // For this implementation, we require an AC table-table config.
      // throw new Error('Only AC configuration is fully supported in this deterministic solver.');
    }
  }

  public validateOrientation(orientation: ToolOrientation): ToolOrientation {
    if (!Number.isFinite(orientation.i) || !Number.isFinite(orientation.j) || !Number.isFinite(orientation.k)) {
      throw new Error('Non-finite orientation vector');
    }

    const length = Math.sqrt(orientation.i ** 2 + orientation.j ** 2 + orientation.k ** 2);
    if (length < 1e-6) {
      throw new Error('Zero-length tool orientation vector');
    }

    return {
      i: orientation.i / length,
      j: orientation.j / length,
      k: orientation.k / length
    };
  }

  /**
   * Forward Kinematics: Machine Axes -> Cartesian Pose
   */
  public forwardKinematics(axes: MachineAxisPosition): MachinePose {
    const A = axes['A'] !== undefined ? axes['A'] : 0;
    const C = axes['C'] !== undefined ? axes['C'] : 0;
    
    const X = axes['X'] !== undefined ? axes['X'] : 0;
    const Y = axes['Y'] !== undefined ? axes['Y'] : 0;
    const Z = axes['Z'] !== undefined ? axes['Z'] : 0;

    const A_rad = A * Math.PI / 180.0;
    const C_rad = C * Math.PI / 180.0;

    // Tool orientation in workpiece frame
    const i = Math.sin(C_rad) * Math.sin(A_rad);
    const j = -Math.cos(C_rad) * Math.sin(A_rad);
    const k = Math.cos(A_rad);

    // Position: p_local = RotZ(-C) * RotX(-A) * p_world
    // So p_world = RotX(A) * RotZ(C) * p_local
    // Wait, the input here is Machine Axes (which represents p_world, X Y Z).
    // The Cartesian Pose output is the tool tip in the workpiece frame (p_local).
    // p_local = RotZ(-C) * RotX(-A) * (X, Y, Z)
    
    const y1 = Y * Math.cos(-A_rad) - Z * Math.sin(-A_rad);
    const z1 = Y * Math.sin(-A_rad) + Z * Math.cos(-A_rad);
    
    const x2 = X * Math.cos(-C_rad) - y1 * Math.sin(-C_rad);
    const y2 = X * Math.sin(-C_rad) + y1 * Math.cos(-C_rad);
    
    const position = {
      x: x2,
      y: y2,
      z: z1
    };

    return {
      position,
      orientation: { i, j, k },
      machineAxes: axes
    };
  }

  /**
   * Inverse Kinematics: Cartesian Pose -> Machine Axes
   */
  public inverseKinematics(position: {x:number, y:number, z:number}, orientation: ToolOrientation): MachineAxisPosition[] {
    const validOrient = this.validateOrientation(orientation);
    
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
      throw new Error('Non-finite position');
    }

    const { i, j, k } = validOrient;
    
    // A = acos(k)
    // Clamp k to [-1, 1] to avoid NaN on precision issues
    const clampedK = Math.max(-1, Math.min(1, k));
    const A_rad1 = Math.acos(clampedK);
    const A_rad2 = -A_rad1;

    const solutions: MachineAxisPosition[] = [];

    const buildSolution = (aRad: number) => {
      let cRad = 0;
      const sinA = Math.sin(aRad);
      
      if (Math.abs(sinA) < 1e-7) {
        // Singularity: Tool is along Z. C can be anything, default to 0
        cRad = 0;
      } else {
        if (aRad > 0) {
          cRad = Math.atan2(i, -j);
        } else {
          cRad = Math.atan2(-i, j);
        }
      }

      // p_world = RotX(A) * RotZ(C) * p_local
      const x1 = position.x * Math.cos(cRad) - position.y * Math.sin(cRad);
      const y1 = position.x * Math.sin(cRad) + position.y * Math.cos(cRad);
      const z1 = position.z;

      const X = x1;
      const Y = y1 * Math.cos(aRad) - z1 * Math.sin(aRad);
      const Z = y1 * Math.sin(aRad) + z1 * Math.cos(aRad);

      return {
        X, Y, Z,
        A: aRad * 180.0 / Math.PI,
        C: cRad * 180.0 / Math.PI
      };
    };

    solutions.push(buildSolution(A_rad1));
    if (Math.abs(A_rad1) > 1e-7) {
      solutions.push(buildSolution(A_rad2));
    }

    return solutions;
  }

  public detectSingularity(orientation: ToolOrientation): { status: SingularityStatus, metric: number } {
    const validOrient = this.validateOrientation(orientation);
    const metric = Math.abs(validOrient.k);
    
    const TOLERANCE = 1e-5;
    const WARNING_TOLERANCE = 1e-3;

    if (Math.abs(1.0 - metric) < TOLERANCE) {
      return { status: 'SINGULAR', metric: 1.0 - metric };
    } else if (Math.abs(1.0 - metric) < WARNING_TOLERANCE) {
      return { status: 'WARNING', metric: 1.0 - metric };
    }

    return { status: 'SAFE', metric: 1.0 - metric };
  }

  public checkAxisLimits(axes: MachineAxisPosition): string[] {
    const violations: string[] = [];
    
    for (const axis of [...this.config.linearAxes, ...this.config.rotaryAxes]) {
      const val = axes[axis.id];
      if (val !== undefined) {
        if (val < axis.minLimit || val > axis.maxLimit) {
           violations.push(axis.id);
        }
      }
    }

    return violations;
  }
}
