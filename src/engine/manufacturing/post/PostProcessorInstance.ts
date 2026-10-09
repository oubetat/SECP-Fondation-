import { PropertyProvenance, PropertySourceType } from "../../materials/types";
import { CollisionModel } from "../collision/types";
import { ControllerProfileEngine } from "./ControllerProfileEngine";
import { MachineProfileEngine } from "./MachineProfileEngine";
import { NCFormatter } from "./NCFormatter";
import { NCIntermediateRepresentationEngine } from "./NCIntermediateRepresentation";
import { NCSemanticValidator } from "./NCSemanticValidator";
import { NCSyntaxValidator } from "./NCSyntaxValidator";
import { RoundTripVerifier } from "./RoundTripVerifier";
import {
  AxisMapping,
  CollisionReverificationResult,
  ControllerProfile,
  KinematicReconstructionResult,
  MachineAxisToolpath,
  MachineProfile,
  NCDialect,
  NCProgram,
  NCProgramFingerprint,
  NCProgramStatus,
  NCSafetyStatus,
  NCSyntaxValidationResult,
  NCSemanticValidationResult,
  PostErrorCode,
  PostProcessingTrace,
  PostProcessingTraceEntry,
  PostProcessorContract,
  PostProcessorLifecycleState,
  PostTrueVerdict,
  ProgramFooterPolicy,
  ProgramHeaderPolicy,
  RoundTripVerificationResult,
  SafeStartPolicy
} from "./types";

export class PostProcessorInstance {
  public state: PostProcessorLifecycleState = PostProcessorLifecycleState.UNINITIALIZED;
  public contract!: PostProcessorContract;
  public machineProfile!: MachineProfile;
  public controllerProfile!: ControllerProfile;
  public trace: PostProcessingTrace = {
    postProcessorId: "",
    machineProfileId: "",
    controllerProfileId: "",
    sourceToolpathId: "",
    startedAt: "",
    completedAt: "",
    entries: [],
    totalBlocksGenerated: 0,
    totalConversionsApplied: 0,
    errorsFound: []
  };

  public static createDefaultContract(
    postProcessorId = "POST_FANUC_5AXIS_V1",
    machineProfile: MachineProfile = MachineProfileEngine.createStandard5AxisMachineProfile(),
    controllerProfile: ControllerProfile = ControllerProfileEngine.createFanucLikeProfile()
  ): PostProcessorContract {
    const axisMapping: AxisMapping = {
      x: "X",
      y: "Y",
      z: "Z",
      a: "A",
      c: "C"
    };

    const provenance: PropertyProvenance = {
      sourceId: "PROV_CONTRACT_" + postProcessorId,
      sourceType: PropertySourceType.STANDARD,
      reference: "SECP Manufacturing Post Contract ISO/ASME Standard",
      timestamp: new Date().toISOString(),
      author: "SECP Post Group",
      hash: "0xPOSTCONTRACT"
    };

    return {
      postProcessorId,
      revision: 1,
      machineId: machineProfile.machineId,
      machineRevision: machineProfile.machineRevision,
      controllerId: controllerProfile.controllerId,
      controllerRevision: controllerProfile.controllerRevision,
      inputTrajectoryVersion: "SECP_TRAJ_V2",
      outputDialect: controllerProfile.dialect,
      units: machineProfile.axisUnits,
      coordinateConvention: "ABSOLUTE",
      axisMapping,
      rotaryConvention: machineProfile.rotaryAxes,
      feedConvention: {
        defaultFeedMode: "FEED_PER_MINUTE" as any,
        maxFeedRate: 25000,
        minFeedRate: 1,
        feedPerMinCode: "G94",
        feedPerRevCode: "G95",
        inverseTimeCode: "G93"
      },
      spindleConvention: {
        maxRPM: machineProfile.spindle.maxRPM,
        minRPM: machineProfile.spindle.minRPM,
        cwMCode: "M03",
        ccwMCode: "M04",
        stopMCode: "M05",
        cssGCode: "G96",
        rpmGCode: "G97",
        maxSpindleSpeedGCode: "G50"
      },
      formatPolicy: controllerProfile.formatRules,
      safetyPolicy: {
        maxLinearVelocityMMMin: 25000,
        maxRotaryVelocityDegMin: 7200,
        enforceAxisLimits: true,
        requireSafeStartBlock: true,
        requireProgramFooter: true,
        chordalToleranceMM: 0.005,
        orientationToleranceDeg: 0.05
      },
      provenance
    };
  }

  public initialize(
    contract: PostProcessorContract,
    machineProfile: MachineProfile,
    controllerProfile: ControllerProfile
  ): { ready: boolean; errors: string[] } {
    this.state = PostProcessorLifecycleState.UNINITIALIZED;
    const errors: string[] = [];

    // Validate profiles
    const machVal = MachineProfileEngine.validateMachineProfile(machineProfile);
    if (!machVal.valid) errors.push(...machVal.errors);

    const ctrlVal = ControllerProfileEngine.validateControllerProfile(controllerProfile);
    if (!ctrlVal.valid) errors.push(...ctrlVal.errors);

    if (errors.length > 0) {
      this.state = PostProcessorLifecycleState.INVALID;
      return { ready: false, errors };
    }

    this.contract = contract;
    this.machineProfile = machineProfile;
    this.controllerProfile = controllerProfile;
    this.state = PostProcessorLifecycleState.READY;

    this.trace = {
      postProcessorId: contract.postProcessorId,
      machineProfileId: machineProfile.machineId,
      controllerProfileId: controllerProfile.controllerId,
      sourceToolpathId: "",
      startedAt: new Date().toISOString(),
      completedAt: "",
      entries: [
        {
          step: "INITIALIZATION",
          inputSummary: `Contract: ${contract.postProcessorId} | Machine: ${machineProfile.machineId} | Controller: ${controllerProfile.controllerId}`,
          transformation: "Initialize Post Processor Instance",
          decision: "Profiles validated and instance set to READY",
          outputSummary: "Post processor ready for execution"
        }
      ],
      totalBlocksGenerated: 0,
      totalConversionsApplied: 0,
      errorsFound: []
    };

    return { ready: true, errors: [] };
  }

  public validateInputTrajectory(trajectory: MachineAxisToolpath): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!trajectory || !trajectory.points || trajectory.points.length === 0) {
      errors.push("Input trajectory is empty or undefined (POST_INPUT_INVALID)");
      return { valid: false, errors };
    }

    // Check axis limits on input points
    for (let i = 0; i < trajectory.points.length; i++) {
      const pt = trajectory.points[i];
      if (Number.isNaN(pt.position.x) || Number.isNaN(pt.position.y) || Number.isNaN(pt.position.z)) {
        errors.push(`Point ${i} contains NaN coordinate values`);
      }
      const xLim = this.machineProfile.axisLimits.X;
      if (xLim && (pt.position.x < xLim.min || pt.position.x > xLim.max)) {
        errors.push(`Point ${i}: X position ${pt.position.x} exceeds machine limit [${xLim.min}, ${xLim.max}]`);
      }
      const yLim = this.machineProfile.axisLimits.Y;
      if (yLim && (pt.position.y < yLim.min || pt.position.y > yLim.max)) {
        errors.push(`Point ${i}: Y position ${pt.position.y} exceeds machine limit [${yLim.min}, ${yLim.max}]`);
      }
      const zLim = this.machineProfile.axisLimits.Z;
      if (zLim && (pt.position.z < zLim.min || pt.position.z > zLim.max)) {
        errors.push(`Point ${i}: Z position ${pt.position.z} exceeds machine limit [${zLim.min}, ${zLim.max}]`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public process(
    trajectory: MachineAxisToolpath,
    programName = "PART_107_NC",
    programNumber = 1001
  ): { program: NCProgram | null; errors: string[] } {
    if (this.state !== PostProcessorLifecycleState.READY) {
      return { program: null, errors: [`Post processor not in READY state (Current state: ${this.state})`] };
    }

    this.state = PostProcessorLifecycleState.PROCESSING;
    this.trace.sourceToolpathId = trajectory.toolpathId;

    // 1. Input validation
    const inputVal = this.validateInputTrajectory(trajectory);
    if (!inputVal.valid) {
      this.state = PostProcessorLifecycleState.FAILED;
      this.trace.errorsFound.push(...inputVal.errors);
      return { program: null, errors: inputVal.errors };
    }

    // 2. Synthesize Intermediate NC Representation
    const irRes = NCIntermediateRepresentationEngine.buildIntermediateRepresentation(
      trajectory,
      this.machineProfile,
      this.controllerProfile,
      this.trace.entries
    );

    if (irRes.errors.length > 0) {
      this.state = PostProcessorLifecycleState.FAILED;
      this.trace.errorsFound.push(...irRes.errors);
      return { program: null, errors: irRes.errors };
    }

    // 3. Setup Header, Footer, and Safe Start Policies
    const headerPolicy: ProgramHeaderPolicy = {
      programName,
      programNumber,
      includeDateStamp: true,
      includeAuthorStamp: true,
      unitsCode: this.machineProfile.axisUnits === "METRIC_MM" ? "G21" : "G20",
      customPreambleComments: [
        `Part Program: ${programName}`,
        `Source Toolpath: ${trajectory.toolpathId} Rev ${trajectory.revision}`
      ]
    };

    const footerPolicy: ProgramFooterPolicy = {
      coolantOffMCode: "M09",
      spindleStopMCode: "M05",
      retractHomeGCode: ["G28 G91 Z0", "G90"],
      programEndMCode: "M30"
    };

    const safeStartPolicy: SafeStartPolicy = {
      startupBlocks: ["G90 G80 G40 G49"],
      safePlane: "XY_G17" as any,
      absoluteCoordinates: true,
      cancelCycles: true,
      cancelCompensation: true
    };

    // 4. Format to NC Blocks & Raw G-Code
    const formatRes = NCFormatter.formatRepresentation(
      irRes.ir,
      this.machineProfile,
      this.controllerProfile,
      headerPolicy,
      footerPolicy,
      safeStartPolicy,
      this.contract.axisMapping,
      this.trace.entries
    );

    if (formatRes.errors.length > 0) {
      this.state = PostProcessorLifecycleState.FAILED;
      this.trace.errorsFound.push(...formatRes.errors);
      return { program: null, errors: formatRes.errors };
    }

    // 5. Compute Deterministic Merkle Fingerprint
    const sourceToolpathFingerprint = trajectory.provenance.hash || "0xTRAJ";
    const machineFingerprint = this.machineProfile.provenance.hash;
    const controllerFingerprint = this.controllerProfile.provenance.hash;
    const postProcessorFingerprint = this.contract.provenance.hash;
    const formatPolicyFingerprint = "0xPREC4";

    const merkleCombined = `${sourceToolpathFingerprint}|${machineFingerprint}|${controllerFingerprint}|${postProcessorFingerprint}|${formatPolicyFingerprint}`;
    let hashSum = 0;
    for (let k = 0; k < merkleCombined.length; k++) {
      hashSum = ((hashSum << 5) - hashSum + merkleCombined.charCodeAt(k)) & 0xffffffff;
    }
    const merkleRootHash = "0x" + Math.abs(hashSum).toString(16).padStart(8, "0");

    const fingerprint: NCProgramFingerprint = {
      sourceToolpathFingerprint,
      machineFingerprint,
      controllerFingerprint,
      postProcessorFingerprint,
      formatPolicyFingerprint,
      merkleRootHash
    };

    this.trace.completedAt = new Date().toISOString();
    this.trace.totalBlocksGenerated = formatRes.blocks.length;

    const program: NCProgram = {
      programId: `NC_${programName}_${trajectory.toolpathId}`,
      revision: 1,
      name: programName,
      blocks: formatRes.blocks,
      rawGCodeText: formatRes.rawText,
      machineProfileId: this.machineProfile.machineId,
      controllerProfileId: this.controllerProfile.controllerId,
      postProcessorId: this.contract.postProcessorId,
      sourceToolpathId: trajectory.toolpathId,
      fingerprint,
      status: NCProgramStatus.GENERATED,
      safetyStatus: NCSafetyStatus.UNVERIFIED,
      trace: this.trace,
      createdAt: new Date().toISOString()
    };

    this.state = PostProcessorLifecycleState.GENERATED;
    return { program, errors: [] };
  }

  public validateOutputAndQualify(
    program: NCProgram,
    originalTrajectory: MachineAxisToolpath,
    collisionObstacles: CollisionModel[] = []
  ): {
    qualified: boolean;
    syntaxResult: NCSyntaxValidationResult;
    semanticResult: NCSemanticValidationResult;
    roundTripResult: RoundTripVerificationResult;
    kinematicResult: KinematicReconstructionResult;
    collisionResult: CollisionReverificationResult;
    safetyStatus: NCSafetyStatus;
    programStatus: NCProgramStatus;
    errors: string[];
  } {
    const errors: string[] = [];

    // 1. Syntax Validation
    const syntaxResult = NCSyntaxValidator.validateProgram(program, this.controllerProfile);
    if (!syntaxResult.isValid) {
      errors.push(...syntaxResult.errors);
    }

    // 2. Semantic Validation
    const semanticResult = NCSemanticValidator.validateProgram(program, this.machineProfile);
    if (!semanticResult.isValid) {
      errors.push(...semanticResult.errors);
    }

    // 3. Round-Trip Interpretation & Kinematic Reconstruction
    const { roundTripResult, reconstructedTrajectory, kinematicResult } = RoundTripVerifier.verifyRoundTrip(
      originalTrajectory,
      program
    );
    if (!roundTripResult.isIdenticalWithinTolerance) {
      errors.push(
        `Round-trip position delta (${roundTripResult.maxObservedPositionDeltaMM.toFixed(4)} mm) exceeds allowable tolerance (${roundTripResult.positionToleranceMM} mm)`
      );
    }

    // 4. Collision Re-Verification
    const collisionResult = RoundTripVerifier.reverifyCollisions(
      reconstructedTrajectory,
      collisionObstacles
    );
    if (collisionResult.verdict !== PostTrueVerdict.COLLISION_FREE) {
      errors.push(`NC collision re-verification detected collisions (${collisionResult.collisionEventsCount} events)`);
    }

    const qualified =
      syntaxResult.isValid &&
      semanticResult.isValid &&
      roundTripResult.isIdenticalWithinTolerance &&
      collisionResult.verdict === PostTrueVerdict.COLLISION_FREE;

    const safetyStatus = qualified
      ? NCSafetyStatus.QUALIFIED
      : errors.length > 0
      ? NCSafetyStatus.INVALID
      : NCSafetyStatus.COLLISION_VALIDATED;

    const programStatus = qualified ? NCProgramStatus.QUALIFIED : NCProgramStatus.INVALID;

    program.safetyStatus = safetyStatus;
    program.status = programStatus;
    this.state = qualified ? PostProcessorLifecycleState.VALIDATED : PostProcessorLifecycleState.FAILED;

    return {
      qualified,
      syntaxResult,
      semanticResult,
      roundTripResult,
      kinematicResult,
      collisionResult,
      safetyStatus,
      programStatus,
      errors
    };
  }
}
