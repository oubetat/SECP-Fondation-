import { GCodeParser } from './GCodeParser';
import { GCodeVerificationEngine } from './GCodeVerificationEngine';
import { MachinePostProfile } from './PostProcessorTypes';
import { FiveAxisToolpath } from '../kinematics/KinematicTypes';

export class GCodeAdversarialSuite {
  public static async runSuiteAsync(): Promise<{ passes: string[], failures: string[] }> {
    const results = { passes: [] as string[], failures: [] as string[] };
    const parser = new GCodeParser();
    
    const profile: MachinePostProfile = {
      id: 'ADV-PROFILE',
      hasA: true, hasC: true,
      limits: { X: [-500, 500], Y: [-500, 500], Z: [0, 500], A: [-120, 120], C: [-360, 360] },
      feedRange: [1, 10000], spindleRange: [1, 24000], toolRange: [1, 100]
    };
    const verifier = new GCodeVerificationEngine(profile);

    const testParse = (code: string, expectError: string, name: string) => {
       const res = parser.parse(code.split('\n'));
       if (res.errors.some(e => e.includes(expectError))) {
         results.passes.push(name);
       } else {
         results.failures.push(`Failed to detect: ${name}`);
       }
    };

    // 1. Malformed G-code
    testParse('G1 X10 Y-\nM30', 'Malformed', 'Reject malformed G-code');
    // 2. Reject NaN
    testParse('G1 XNaN Y10\nM30', 'NaN', 'Reject NaN');
    // 3. Reject Infinity
    testParse('G1 XInfinity Y10\nM30', 'Infinity', 'Reject Infinity');
    // 4. Unsupported G-code
    testParse('G999 X10\nM30', 'Unsupported G-code', 'Reject unsupported G-code');
    // 5. Unsupported M-code
    testParse('M999\nM30', 'Unsupported M-code', 'Reject unsupported M-code');
    
    // Limits and Verifier tests require toolpath and full run
    const buildTp = (x:number, y:number, z:number, a:number, c:number, rapid:boolean=false): FiveAxisToolpath => ({
       operationId: 'test',
       points: [{
         position: {x:0,y:0,z:0}, toolOrientation: {i:0,j:0,k:1}, feed: 100, moveType: rapid?'RAPID':'CUTTING', sourceIndex: 0,
         machinePose: { position: {x:0,y:0,z:0}, orientation: {i:0,j:0,k:1}, machineAxes: {'X':x, 'Y':y, 'Z':z, 'A':a, 'C':c} }
       }],
       provenance: {}
    });

    const testVerify = async (docStr: string, tp: FiveAxisToolpath, expectError: string, name: string) => {
       const doc = { lines: docStr.split('\n'), byteLength: 0, provenance: {} };
       const res = await verifier.verify(tp, doc);
       if (res.errors.some(e => e.includes(expectError))) {
          results.passes.push(name);
       } else {
          results.failures.push(`Failed to detect: ${name}. Errors were: ${res.errors.join(', ')}`);
       }
    };

    // Limits
    await testVerify('G1 X600\nM30', buildTp(600,0,10,0,0), 'X limit', 'Reject X-axis limit violation');
    await testVerify('G1 Y600\nM30', buildTp(0,600,10,0,0), 'Y limit', 'Reject Y-axis limit violation');
    await testVerify('G1 Z-10\nM30', buildTp(0,0,-10,0,0), 'Z limit', 'Reject Z-axis limit violation');
    await testVerify('G1 A150\nM30', buildTp(0,0,10,150,0), 'A limit', 'Reject A-axis limit violation');
    await testVerify('G1 C400\nM30', buildTp(0,0,10,0,400), 'C limit', 'Reject C-axis limit violation');

    // 14. Modal state corruption
    testParse('M3\nM30', 'Spindle started with 0 speed', 'Detect modal-state corruption');
    
    // 15, 16. Discontinuities
    const tpDisc = {
       operationId: 'test',
       points: [
         { position: {x:0,y:0,z:0}, toolOrientation: {i:0,j:0,k:1}, feed: 100, moveType: 'CUTTING' as any, sourceIndex: 0,
           machinePose: { position: {x:0,y:0,z:0}, orientation: {i:0,j:0,k:1}, machineAxes: {'X':0, 'Y':0, 'Z':10, 'A':0, 'C':0} } },
         { position: {x:0,y:0,z:0}, toolOrientation: {i:0,j:0,k:1}, feed: 100, moveType: 'CUTTING' as any, sourceIndex: 1,
           machinePose: { position: {x:0,y:0,z:0}, orientation: {i:0,j:0,k:1}, machineAxes: {'X':50, 'Y':0, 'Z':10, 'A':50, 'C':0} } }
       ],
       provenance: {}
    };
    await testVerify('G1 X0 Z10 A0\nG1 X50 A50\nM30', tpDisc, 'Cartesian discontinuity', 'Detect Cartesian discontinuity');
    await testVerify('G1 X0 Z10 A0\nG1 X50 A50\nM30', tpDisc, 'Rotary discontinuity', 'Detect rotary discontinuity');

    // 17. Unexpected rapid movement
    const tpRapid = buildTp(0,0,10,0,0, false);
    await testVerify('G0 X0 Y0 Z10\nM30', tpRapid, 'Unexpected rapid', 'Detect unexpected rapid movement');

    // 18. Motion after program termination
    testParse('M30\nG1 X10', 'after program termination', 'Detect motion after program termination');

    // 19. Premature termination
    testParse('G1 X10', 'Premature program termination', 'Detect premature program termination');

    // 6. Invalid feed, 7. Invalid spindle, 8. Invalid tool
    // Handled in GCodePostProcessor throw, so we mock test it here
    try {
       const { GCodePostProcessor } = await import('./GCodePostProcessor');
       const pp = new GCodePostProcessor(profile);
       pp.generate(buildTp(0,0,0,0,0), -10, 1000, 1);
       results.failures.push('Failed to reject invalid feed');
    } catch(e) { results.passes.push('Reject invalid feed'); }

    try {
       const { GCodePostProcessor } = await import('./GCodePostProcessor');
       const pp = new GCodePostProcessor(profile);
       pp.generate(buildTp(0,0,0,0,0), 100, -1000, 1);
       results.failures.push('Failed to reject invalid spindle');
    } catch(e) { results.passes.push('Reject invalid spindle speed'); }

    try {
       const { GCodePostProcessor } = await import('./GCodePostProcessor');
       const pp = new GCodePostProcessor(profile);
       pp.generate(buildTp(0,0,0,0,0), 100, 1000, -1);
       results.failures.push('Failed to reject invalid tool');
    } catch(e) { results.passes.push('Reject invalid tool number'); }

    // 20. Deterministic replay
    try {
       const { GCodePostProcessor } = await import('./GCodePostProcessor');
       const pp = new GCodePostProcessor(profile);
       const tpValid = buildTp(10,10,10,10,10);
       const doc1 = pp.generate(tpValid, 100, 1000, 1);
       const doc2 = pp.generate(tpValid, 100, 1000, 1);
       
       const ver1 = await verifier.verify(tpValid, doc1);
       const ver2 = await verifier.verify(tpValid, doc2);

       if (doc1.lines.join('\n') === doc2.lines.join('\n') && ver1.provenanceHash === ver2.provenanceHash) {
         results.passes.push('Verify deterministic replay');
       } else {
         results.failures.push('Failed: Verify deterministic replay');
       }
    } catch(e) { results.failures.push(`Replay errored: ${e}`); }

    return results;
  }
}
