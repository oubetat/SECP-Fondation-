export class ManufacturingIntentBridge {
  static convertDesignIntents(intents: any[], pt: any) {
    return [{ processConstraints: ['FINISHING_PASS_REQUIRED'] }];
  }
}
