export class NonlinearStepController {
  public stepIndex = 0;
  constructor(opts: any) {}
  getNextStepTarget() { return { isCompleted: true, targetLambda: 1.0, deltaLambda: 0.1 }; }
  recordStepSuccess(i: number) {}
  recordStepFailure() { return { canRetry: false }; }
}
