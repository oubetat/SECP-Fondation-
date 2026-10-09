import { PropertyProvenance, PropertySourceType } from "../../materials/types";
import {
  ArcDirection,
  ArcPlane,
  MachineAxisPoint,
  MachineAxisToolpath,
  NCProgram,
  SpindleDirection
} from "./types";

export class NCInterpreterReconstructor {
  public static reconstructTrajectoryFromProgram(program: NCProgram): MachineAxisToolpath {
    const points: MachineAxisPoint[] = [];

    let curX = 0;
    let curY = 0;
    let curZ = 0;
    let curA: number | undefined = undefined;
    let curB: number | undefined = undefined;
    let curC: number | undefined = undefined;

    let motionMode: "RAPID" | "LINEAR" | "ARC" = "RAPID";
    let arcDir: ArcDirection = ArcDirection.CW;
    let feedRate = 0;
    let spindleSpeed = 0;
    let spindleDir: SpindleDirection = SpindleDirection.STOP;
    let activeTool = 1;
    let floodCoolant = false;
    let seq = 1;

    for (const block of program.blocks) {
      let isMotionBlock = false;
      let targetX = curX;
      let targetY = curY;
      let targetZ = curZ;
      let targetA = curA;
      let targetB = curB;
      let targetC = curC;
      let radiusVal: number | undefined = undefined;
      let iOffset: number | undefined = undefined;
      let jOffset: number | undefined = undefined;

      for (const word of block.words) {
        const val = typeof word.value === "number" ? word.value : parseFloat(String(word.value));

        if (word.letter === "G") {
          const gNum = Math.round(val);
          if (gNum === 0) {
            motionMode = "RAPID";
          } else if (gNum === 1) {
            motionMode = "LINEAR";
          } else if (gNum === 2) {
            motionMode = "ARC";
            arcDir = ArcDirection.CW;
          } else if (gNum === 3) {
            motionMode = "ARC";
            arcDir = ArcDirection.CCW;
          }
        } else if (word.letter === "M") {
          const mNum = Math.round(val);
          if (mNum === 3) spindleDir = SpindleDirection.CW;
          else if (mNum === 4) spindleDir = SpindleDirection.CCW;
          else if (mNum === 5) spindleDir = SpindleDirection.STOP;
          else if (mNum === 8) floodCoolant = true;
          else if (mNum === 9) floodCoolant = false;
        } else if (word.letter === "T") {
          activeTool = Math.round(val);
        } else if (word.letter === "S") {
          spindleSpeed = val;
        } else if (word.letter === "F") {
          feedRate = val;
        } else if (word.letter === "X") {
          targetX = val;
          isMotionBlock = true;
        } else if (word.letter === "Y") {
          targetY = val;
          isMotionBlock = true;
        } else if (word.letter === "Z") {
          targetZ = val;
          isMotionBlock = true;
        } else if (word.letter === "A") {
          targetA = val;
          isMotionBlock = true;
        } else if (word.letter === "B") {
          targetB = val;
          isMotionBlock = true;
        } else if (word.letter === "C") {
          targetC = val;
          isMotionBlock = true;
        } else if (word.letter === "R") {
          radiusVal = val;
        } else if (word.letter === "I") {
          iOffset = val;
        } else if (word.letter === "J") {
          jOffset = val;
        }
      }

      if (isMotionBlock) {
        curX = targetX;
        curY = targetY;
        curZ = targetZ;
        curA = targetA;
        curB = targetB;
        curC = targetC;

        const rotaryAxes = (curA !== undefined || curB !== undefined || curC !== undefined)
          ? { a: curA, b: curB, c: curC }
          : undefined;

        const pt: MachineAxisPoint = {
          position: { x: curX, y: curY, z: curZ },
          rotaryAxes,
          feedRate,
          spindleSpeed,
          spindleDirection: spindleDir,
          coolantState: { flood: floodCoolant, mist: false, throughSpindle: false, air: false },
          sequenceNumber: seq++,
          toolNumber: activeTool,
          motionType: motionMode,
          operationId: block.sourceOperation
        };

        if (motionMode === "ARC") {
          pt.arcParameters = {
            plane: ArcPlane.XY_G17,
            center: {
              x: iOffset !== undefined ? curX + iOffset : curX,
              y: jOffset !== undefined ? curY + jOffset : curY,
              z: curZ
            },
            radius: radiusVal || Math.hypot(iOffset || 0, jOffset || 0),
            direction: arcDir
          };
        }

        points.push(pt);
      }
    }

    const provenance: PropertyProvenance = {
      sourceId: "PROV_RECON_" + program.programId,
      sourceType: PropertySourceType.STANDARD,
      reference: "NC Interpreter Reconstructed Trajectory",
      timestamp: new Date().toISOString(),
      author: "SECP NC Interpreter Engine",
      hash: "0xRECON" + program.programId.slice(0, 8)
    };

    return {
      toolpathId: `RECON_${program.programId}`,
      revision: program.revision,
      machineId: program.machineProfileId,
      points,
      tolerance: 0.001,
      coordinateSystem: "WORK_PIECE",
      provenance
    };
  }
}
