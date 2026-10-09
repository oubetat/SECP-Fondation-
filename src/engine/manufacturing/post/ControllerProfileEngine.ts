import { 
  ControllerProfile, 
  NCDialect, 
  DialectImplementationStatus, 
  ArcPlane, 
  MacroSupportStatus,
  CannedCycleType
} from "./types";

export class ControllerProfileEngine {
  public static createFanucLikeProfile(): ControllerProfile {
    return {
      controllerId: "FANUC_31i_B5",
      controllerRevision: 1,
      name: "Fanuc Series 31i-B5",
      dialect: NCDialect.FANUC_LIKE,
      dialectStatus: DialectImplementationStatus.IMPLEMENTED,
      supportedWords: ["G", "M", "X", "Y", "Z", "A", "B", "C", "F", "S", "T", "H", "D", "I", "J", "K", "R", "P", "Q", "L", "O", "N"],
      supportedCommands: ["G00", "G01", "G02", "G03", "G04", "G17", "G18", "G19", "G20", "G21", "G28", "G40", "G41", "G42", "G43", "G49", "G54", "G55", "G56", "G57", "G58", "G59", "G80", "G81", "G83", "G90", "G91", "G93", "G94", "G95", "M00", "M01", "M02", "M03", "M04", "M05", "M06", "M08", "M09", "M30"],
      supportedCycles: [CannedCycleType.DRILL, CannedCycleType.PECK_DRILL, CannedCycleType.TAP, CannedCycleType.BORE],
      supportedAxes: ["X", "Y", "Z", "A", "C"],
      formatRules: {
        linearPrecision: 4,
        rotaryPrecision: 3,
        feedPrecision: 1,
        spindlePrecision: 0,
        stripTrailingZeros: false,
        forceExplicitSign: false,
        decimalSeparator: "."
      },
      capabilities: {
        supports3AxisLinear: true,
        supports5AxisSimultaneous: true,
        supportsArcs: true,
        supportedArcPlanes: [ArcPlane.XY_G17, ArcPlane.XZ_G18, ArcPlane.YZ_G19],
        supportsSplines: false,
        supportsNURBS: true,
        supportsTCP: true,
        supportsRTCP: true,
        supportsSubprograms: true,
        supportsMacros: MacroSupportStatus.SUPPORTED,
        supportsCutterComp2D: true,
        supportsCutterComp3D: true,
        supportsCannedCycles: true,
        supportsInverseTimeFeed: true,
        maxBlockLength: 512,
        modalGCodeSupport: true
      },
      provenance: {
        sourceId: "SYSTEM_CONTROLLER_LIB",
        sourceType: "STANDARD" as any,
        reference: "Industrial Controller Database",
        timestamp: new Date().toISOString(),
        author: "SECP Manufacturing Team",
        hash: "0xFANUC31IB5"
      }
    };
  }

  public static validateControllerProfile(profile: ControllerProfile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!profile) {
      return { valid: false, errors: ["Null or undefined controller profile"] };
    }
    if (!profile.controllerId) errors.push("Missing controllerId");
    if (!profile.dialect) errors.push("Missing dialect");
    if (!profile.supportedCommands) errors.push("Missing supportedCommands");
    if (!profile.formatRules) errors.push("Missing formatRules");

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
