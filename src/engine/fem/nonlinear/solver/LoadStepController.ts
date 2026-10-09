export class LoadStepController {
  constructor(opts: any) {}
  getNextStepTarget() { return { isCompleted: true, stepIndex: 0, targetLambda: 1, deltaLambda: 0.1, retryCount: 0 }; }
  recordStepSuccess(i: number) {}
  recordStepFailure() { return { canRetry: false, reason: 'Failed' }; }
}
