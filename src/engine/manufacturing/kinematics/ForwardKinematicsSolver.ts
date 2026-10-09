import { HomogeneousTransform, MachineKinematicModel, Vector3D } from "./types";
import { KinematicMath } from "./KinematicMath";

export class ForwardKinematicsSolver {
  /**
   * Computes the forward kinematic poses for the tool tip and workpiece.
   */
  public static solve(
    machine: MachineKinematicModel,
    axisPositions: Record<string, number>
  ): { toolPose: HomogeneousTransform; workpiecePose: HomogeneousTransform; isConsistent: boolean } {
    let toolPose = KinematicMath.createIdentity();
    let workpiecePose = KinematicMath.createIdentity();

    // Fill missing axis values with zero or home position
    const positions: Record<string, number> = {};
    for (const axis of machine.axes) {
      positions[axis.axisId] = axisPositions[axis.axisId] !== undefined 
        ? axisPositions[axis.axisId] 
        : axis.homePosition;
    }

    const type = machine.machineType;
    const config = machine.kinematicChain;

    // We solve based on machine architecture
    switch (type) {
      case "MILL_3_AXIS": {
        // Standard 3-axis: tool moves in Z, table in X and Y (or head moves in X, Y, Z)
        // Let's compose standard linear motion:
        const tx = (positions["X"] || 0);
        const ty = (positions["Y"] || 0);
        const tz = (positions["Z"] || 0);

        // Tool pose relative to base (typically Z axis vertical offset)
        toolPose = KinematicMath.createTranslation(0, 0, tz);
        // Workpiece/Table pose relative to base
        workpiecePose = KinematicMath.createTranslation(tx, ty, 0);
        break;
      }

      case "MILL_4_AXIS": {
        // 3 linear axes + 1 rotary axis (A, B or C)
        const tx = positions["X"] || 0;
        const ty = positions["Y"] || 0;
        const tz = positions["Z"] || 0;
        
        // Find which rotary axis is active (A, B, or C)
        const rotaryAxisId = "A" in positions ? "A" : ("B" in positions ? "B" : "C");
        const angleDeg = positions[rotaryAxisId] || 0;
        const angleRad = (angleDeg * Math.PI) / 180;

        // Tool pose: Moves in Z
        toolPose = KinematicMath.createTranslation(0, 0, tz);

        // Table/Workpiece pose: Moves in X, Y and rotates around A/B/C
        let rot = KinematicMath.createIdentity();
        if (rotaryAxisId === "A") {
          rot = KinematicMath.createRotationX(angleRad);
        } else if (rotaryAxisId === "B") {
          rot = KinematicMath.createRotationY(angleRad);
        } else {
          rot = KinematicMath.createRotationZ(angleRad);
        }

        const trans = KinematicMath.createTranslation(tx, ty, 0);
        workpiecePose = KinematicMath.multiply(trans, rot);
        break;
      }

      case "MILL_5_AXIS": {
        // 5-axis: 3 linear + 2 rotary. We must distinguish architectures
        const tx = positions["X"] || 0;
        const ty = positions["Y"] || 0;
        const tz = positions["Z"] || 0;

        // Find active rotary axes
        const r1 = "A" in positions ? "A" : "B";
        const r2 = "C";

        const angle1 = ((positions[r1] || 0) * Math.PI) / 180;
        const angle2 = ((positions[r2] || 0) * Math.PI) / 180;

        // Base geometry configuration
        const architecture = machine.kinematicChain.chainId || "TABLE-TABLE";

        if (architecture === "TABLE-TABLE") {
          // Base -> X -> Y -> Z -> Tool
          toolPose = KinematicMath.createTranslation(0, 0, tz);

          // Base -> A/B -> C -> Workpiece
          // Table-table pivot compensation math
          const rotA_or_B = r1 === "A" ? KinematicMath.createRotationX(angle1) : KinematicMath.createRotationY(angle1);
          const rotC = KinematicMath.createRotationZ(angle2);

          const linearTrans = KinematicMath.createTranslation(tx, ty, 0);
          const tableRot = KinematicMath.multiply(rotA_or_B, rotC);
          workpiecePose = KinematicMath.multiply(linearTrans, tableRot);

        } else if (architecture === "HEAD-HEAD") {
          // Base -> X -> Y -> Z -> A/B -> C -> Tool
          const linearTrans = KinematicMath.createTranslation(tx, ty, tz);
          const rotA_or_B = r1 === "A" ? KinematicMath.createRotationX(angle1) : KinematicMath.createRotationY(angle1);
          const rotC = KinematicMath.createRotationZ(angle2);

          const headRot = KinematicMath.multiply(rotA_or_B, rotC);
          toolPose = KinematicMath.multiply(linearTrans, headRot);

          workpiecePose = KinematicMath.createIdentity(); // static on bed

        } else {
          // HEAD-TABLE (Mixed)
          // Base -> X -> Y -> Z -> A/B -> Tool
          const linearTrans = KinematicMath.createTranslation(tx, ty, tz);
          const rotA_or_B = r1 === "A" ? KinematicMath.createRotationX(angle1) : KinematicMath.createRotationY(angle1);
          toolPose = KinematicMath.multiply(linearTrans, rotA_or_B);

          // Base -> C -> Workpiece
          workpiecePose = KinematicMath.createRotationZ(angle2);
        }
        break;
      }

      default: {
        // Fallback for Turning, Lathe, etc.
        const z = positions["Z"] || 0;
        const x = positions["X"] || 0;
        toolPose = KinematicMath.createTranslation(x, 0, z);
        workpiecePose = KinematicMath.createIdentity();
        break;
      }
    }

    const isConsistent = KinematicMath.validateRotation(toolPose) && KinematicMath.validateRotation(workpiecePose);

    return {
      toolPose,
      workpiecePose,
      isConsistent
    };
  }
}
