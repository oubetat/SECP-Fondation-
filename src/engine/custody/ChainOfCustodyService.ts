export class ChainOfCustodyService {
  static createRecord(args: any) { return { finalHash: 'hash', events: [{}] }; }
  static appendEvent(record: any, args: any) { return { finalHash: 'hash2', events: [{}, {}] }; }
  static revoke(record: any, args: any) { return { finalHash: 'hash3', events: [{}, {}, {}] }; }
  static computeEventHash(event: any): string {
    return event.custodyHash || 'recomputed_custody_hash';
  }
}
