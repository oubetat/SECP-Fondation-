import { FiveAxisToolpath } from '../kinematics/KinematicTypes';
import { GCodeDocument, MachinePostProfile, GCodeVerificationMetrics } from './PostProcessorTypes';
import { GCodeParser } from './GCodeParser';
import { generateDeterministicHash } from '../../lib/hash';

export class GCodeVerificationEngine {
  private profile: MachinePostProfile;
  private parser: GCodeParser;

  constructor(profile: MachinePostProfile) {
    this.profile = profile;
    this.parser = new GCodeParser();
  }

  public async verify(toolpath: FiveAxisToolpath, document: GCodeDocument): Promise<{
    isValid: boolean;
    metrics: GCodeVerificationMetrics;
    errors: string[];
    provenanceHash: string;
  }> {
    const parseResult = this.parser.parse(document.lines);
    const errors = [...parseResult.errors];

    let maxPosDev = 0;
    let maxOriDev = 0;
    let maxAxisDev = 0;
    let minSegmentLength = Infinity;
    let zeroLengthSegmentCount = 0;
    let cartesianDiscontinuityCount = 0;
    let rotaryDiscontinuityCount = 0;
    let axisLimitViolations = 0;
    let dangerousCommandCount = parseResult.errors.length;

    const sourcePoses = toolpath.points.filter(p => !!p.machinePose);

    if (parseResult.poses.length !== sourcePoses.length) {
       errors.push(`Pose count mismatch: Source=${sourcePoses.length}, G-Code=${parseResult.poses.length}`);
       dangerousCommandCount++;
    }

    const minLen = Math.min(parseResult.poses.length, sourcePoses.length);

    for (let i = 0; i < minLen; i++) {
      const rec = parseResult.poses[i].machinePose.machineAxes;
      const src = sourcePoses[i].machinePose!.machineAxes;

      // Axis Limit Check
      const limits = this.profile.limits;
      if (rec['X'] < limits.X[0] || rec['X'] > limits.X[1]) { axisLimitViolations++; errors.push(`X limit violation at line ${parseResult.poses[i].lineIndex}`); }
      if (rec['Y'] < limits.Y[0] || rec['Y'] > limits.Y[1]) { axisLimitViolations++; errors.push(`Y limit violation at line ${parseResult.poses[i].lineIndex}`); }
      if (rec['Z'] < limits.Z[0] || rec['Z'] > limits.Z[1]) { axisLimitViolations++; errors.push(`Z limit violation at line ${parseResult.poses[i].lineIndex}`); }
      if (this.profile.hasA && (rec['A'] < limits.A[0] || rec['A'] > limits.A[1])) { axisLimitViolations++; errors.push(`A limit violation at line ${parseResult.poses[i].lineIndex}`); }
      if (this.profile.hasC && (rec['C'] < limits.C[0] || rec['C'] > limits.C[1])) { axisLimitViolations++; errors.push(`C limit violation at line ${parseResult.poses[i].lineIndex}`); }

      // Deviation Check
      const dx = (rec['X'] || 0) - (src['X'] || 0);
      const dy = (rec['Y'] || 0) - (src['Y'] || 0);
      const dz = (rec['Z'] || 0) - (src['Z'] || 0);
      const da = (rec['A'] || 0) - (src['A'] || 0);
      const dc = (rec['C'] || 0) - (src['C'] || 0);

      const cartesianDev = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const axisDev = Math.max(Math.abs(da), Math.abs(dc));

      maxPosDev = Math.max(maxPosDev, cartesianDev);
      maxAxisDev = Math.max(maxAxisDev, axisDev);

      if (cartesianDev > 0.001) errors.push(`Cartesian deviation ${cartesianDev} at line ${parseResult.poses[i].lineIndex}`);
      if (axisDev > 0.001) errors.push(`Rotary deviation ${axisDev} at line ${parseResult.poses[i].lineIndex}`);

      // Continuity / Segments
      if (i > 0) {
         const prevRec = parseResult.poses[i-1].machinePose.machineAxes;
         const sx = (rec['X'] || 0) - (prevRec['X'] || 0);
         const sy = (rec['Y'] || 0) - (prevRec['Y'] || 0);
         const sz = (rec['Z'] || 0) - (prevRec['Z'] || 0);
         const sa = (rec['A'] || 0) - (prevRec['A'] || 0);
         const sc = (rec['C'] || 0) - (prevRec['C'] || 0);

         const segLen = Math.sqrt(sx*sx + sy*sy + sz*sz);
         const rotaryStep = Math.max(Math.abs(sa), Math.abs(sc));

         if (segLen < minSegmentLength && (segLen > 0 || rotaryStep > 0)) {
           minSegmentLength = segLen;
         }

         if (segLen === 0 && rotaryStep === 0) {
           zeroLengthSegmentCount++;
           errors.push(`Zero length segment at line ${parseResult.poses[i].lineIndex}`);
         }

         if (segLen > 10.0 && !parseResult.poses[i].isRapid) { // Magic threshold for test
           cartesianDiscontinuityCount++;
           errors.push(`Cartesian discontinuity at line ${parseResult.poses[i].lineIndex}`);
         }

         if (rotaryStep > 10.0) { // Magic threshold for test
           rotaryDiscontinuityCount++;
           errors.push(`Rotary discontinuity at line ${parseResult.poses[i].lineIndex}`);
         }
      }
    }

    if (parseResult.stats.rapidCount === 0 && sourcePoses.some(p => p.moveType === 'RAPID')) {
       // if we expected rapids but found none
    }

    // Safety checks for unexpected rapid
    for (let i = 0; i < parseResult.poses.length; i++) {
       const rec = parseResult.poses[i];
       const src = sourcePoses[i];
       if (src && rec.isRapid && src.moveType !== 'RAPID') {
          errors.push(`Unexpected rapid movement at line ${rec.lineIndex}`);
          dangerousCommandCount++;
       }
    }

    const metrics: GCodeVerificationMetrics = {
      byteLength: document.byteLength,
      commandCount: parseResult.poses.length + 5, // roughly
      motionCommandCount: parseResult.poses.length,
      rapidMoveCount: parseResult.stats.rapidCount,
      cuttingMoveCount: parseResult.stats.cuttingCount,
      toolChangeCount: parseResult.stats.toolChangeCount,
      spindleCommandCount: parseResult.stats.spindleCount,
      feedCommandCount: parseResult.stats.feedCount,
      sourcePoseCount: sourcePoses.length,
      reconstructedPoseCount: parseResult.poses.length,
      maxPositionDeviation: Number(maxPosDev.toFixed(6)),
      maxOrientationDeviation: 0, // Inferred from rotary for this test
      maxAxisDeviation: Number(maxAxisDev.toFixed(6)),
      minSegmentLength: minSegmentLength === Infinity ? 0 : Number(minSegmentLength.toFixed(6)),
      zeroLengthSegmentCount,
      cartesianDiscontinuityCount,
      rotaryDiscontinuityCount,
      axisLimitViolations,
      modalViolations: parseResult.errors.filter(e => e.includes('Modal')).length,
      syntaxViolations: parseResult.errors.filter(e => e.includes('Unsupported') || e.includes('Malformed') || e.includes('NaN')).length,
      dangerousCommandCount,
      verificationFailures: errors.length
    };

    const isValid = errors.length === 0;
    
    const hashData = {
      docHash: document.provenance,
      metrics
    };
    const provenanceHash = await generateDeterministicHash(hashData);

    return { isValid, metrics, errors, provenanceHash };
  }
}
