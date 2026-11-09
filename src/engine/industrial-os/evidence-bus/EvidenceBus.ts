import { createHash } from "crypto";
import { EvidenceEnvelope, EvidencePublishRequest } from "./types";
import { EvidenceVerifier } from "./EvidenceVerifier";
import { EvidenceEnvelopeFactory } from "./EvidenceEnvelopeFactory";

export class EvidenceBus {
  private static instance: EvidenceBus;
  private storage: EvidenceEnvelope[] = [];
  private subscribers: Array<{
    filter?: Partial<EvidenceEnvelope> & Record<string, any>;
    handler: (envelope: EvidenceEnvelope) => Promise<void> | void;
  }> = [];

  public constructor() {}

  public static getInstance(): EvidenceBus {
    if (!this.instance) {
      this.instance = new EvidenceBus();
    }
    return this.instance;
  }

  public subscribe(
    filter: Partial<EvidenceEnvelope> & Record<string, any> = {},
    handler: (envelope: EvidenceEnvelope) => Promise<void> | void
  ): () => void {
    const sub = { filter, handler };
    this.subscribers.push(sub);
    return () => {
      const idx = this.subscribers.indexOf(sub);
      if (idx >= 0) {
        this.subscribers.splice(idx, 1);
      }
    };
  }

  public unsubscribe(handler: (envelope: EvidenceEnvelope) => Promise<void> | void): void {
    const idx = this.subscribers.findIndex(sub => sub.handler === handler);
    if (idx >= 0) {
      this.subscribers.splice(idx, 1);
    }
  }

  public route(envelope: EvidenceEnvelope): void {
    for (const sub of this.subscribers) {
      try {
        let match = true;
        if (sub.filter) {
          for (const key in sub.filter) {
            if (key === 'correlationId') {
              if (envelope.correlation?.correlationId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'targetObjectId') {
              if (envelope.correlation?.engineeringObjectId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'evidenceId') {
              if (envelope.evidenceId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'sourceCapability') {
              if (envelope.provenance?.sourceCapability !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if ((envelope as any)[key] !== sub.filter[key]) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          sub.handler(envelope);
        }
      } catch (e) {
        // Safe dispatch
      }
    }
  }

  public correlate(arg: string | { correlationId?: string; subjectIdentityId?: string }): EvidenceEnvelope[] {
    const id = typeof arg === 'string' ? arg : arg.correlationId || arg.subjectIdentityId || '';
    return this.query({ correlationId: id } as any);
  }

  public verify(envelope: EvidenceEnvelope): any {
    return EvidenceVerifier.verify(envelope);
  }

  public publishSync(request: EvidencePublishRequest): EvidenceEnvelope {
    const sequence = this.storage.length + 1;
    const previousEnvelope = this.storage[this.storage.length - 1];
    const previousEvidenceHash = previousEnvelope ? previousEnvelope.integrity.envelopeHash : undefined;

    const fullEnvelope = EvidenceEnvelopeFactory.createEnvelope(
      request,
      sequence,
      (request as any).runSequence || sequence,
      previousEvidenceHash,
      sequence - 1
    );

    const proxyEnvelope = new Proxy(fullEnvelope, {
      get(target, prop, receiver) {
        if (prop === 'envelope') {
          return proxyEnvelope;
        }
        if (prop === 'id') {
          return target.evidenceId;
        }
        return Reflect.get(target, prop, receiver);
      },
      has(target, prop) {
        if (prop === 'id' || prop === 'envelope') {
          return true;
        }
        return Reflect.has(target, prop);
      }
    });

    this.storage.push(proxyEnvelope);

    for (const sub of this.subscribers) {
      try {
        let match = true;
        if (sub.filter) {
          for (const key in sub.filter) {
            if (key === 'correlationId') {
              if (proxyEnvelope.correlation?.correlationId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'targetObjectId') {
              if (proxyEnvelope.correlation?.engineeringObjectId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'evidenceId') {
              if (proxyEnvelope.evidenceId !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if (key === 'sourceCapability') {
              if (proxyEnvelope.provenance?.sourceCapability !== sub.filter[key]) {
                match = false;
                break;
              }
              continue;
            }
            if ((proxyEnvelope as any)[key] !== sub.filter[key]) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          sub.handler(proxyEnvelope);
        }
      } catch (e) {
        // Safe dispatch
      }
    }

    return proxyEnvelope;
  }

  public async publish(request: EvidencePublishRequest): Promise<EvidenceEnvelope> {
    return this.publishSync(request);
  }

  public query(filter: Partial<EvidenceEnvelope> & Record<string, any>): EvidenceEnvelope[] {
    return this.storage.filter(env => {
      for (const key in filter) {
        if (key === 'correlationId') {
          if (env.correlation?.correlationId !== filter[key]) {
            return false;
          }
          continue;
        }
        if (key === 'targetObjectId') {
          if (env.correlation?.engineeringObjectId !== filter[key]) {
            return false;
          }
          continue;
        }
        if (key === 'evidenceId') {
          if (env.evidenceId !== filter[key]) {
            return false;
          }
          continue;
        }
        if (key === 'sourceCapability') {
          if (env.provenance?.sourceCapability !== filter[key]) {
            return false;
          }
          continue;
        }
        if ((env as any)[key] !== filter[key]) {
          return false;
        }
      }
      return true;
    });
  }

  public getStorage(): EvidenceEnvelope[] {
    return [...this.storage];
  }

  public clear(): void {
    this.storage = [];
    this.subscribers = [];
  }
}
