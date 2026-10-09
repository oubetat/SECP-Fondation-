/**
 * SECP Industrial OS v2 — CAD Kernel Qualification Engine
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { CADForensicRunner } from './CADForensicRunner';
import { CADForensicReport } from './CADForensicTypes';
import { GeometryBattery } from './batteries/GeometryBattery';
import { TopologyBattery } from './batteries/TopologyBattery';
import { ModelingBattery } from './batteries/ModelingBattery';
import { AssemblyBattery } from './batteries/AssemblyBattery';
import { BooleanBattery } from './batteries/BooleanBattery';
import { GCSBattery } from './batteries/GCSBattery';
import { BRepBattery } from './batteries/BRepBattery';
import { ToleranceBattery } from './batteries/ToleranceBattery';
import { InteropBattery } from './batteries/InteropBattery';
import { ForensicCaseEvaluator } from './CADForensicCase';

export class CADKernelQualificationEngine {
  public static async runFullQualification(): Promise<CADForensicReport> {
    const evaluators: ForensicCaseEvaluator[] = [
      ...GeometryBattery.getCases(),
      ...TopologyBattery.getCases(),
      ...ModelingBattery.getCases(),
      ...AssemblyBattery.getCases(),
      ...BooleanBattery.getCases(),
      ...GCSBattery.getCases(),
      ...BRepBattery.getCases(),
      ...ToleranceBattery.getCases(),
      ...InteropBattery.getCases(),
    ];

    const runner = new CADForensicRunner(evaluators);
    const report = await runner.runQualification();

    return report;
  }
}
