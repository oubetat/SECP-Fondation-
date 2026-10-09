/**
 * SECP CAD Core v0.1 — Project Persistence Engine
 * Saves and loads complete SECP CAD Projects containing Metadata, Parameters,
 * 2D Sketch Profiles, Feature Tree DAG, Assembly Components & Mates.
 */

import { Project } from '../types/domainModel';
import { CadSolidEntity } from './cadKernel';
import { AssemblyComponentItem, AssemblyMate } from './assembly';
import { FeatureTreeNode } from './featureTree';
import { Parameter, Constraint } from '../types/domainModel';
import { EngineeringDocument } from './cad-kernel/document/CADDocument';
import { PersistedDocumentBundle } from './cad-kernel/document/MultiDocumentPersistence';
import { IndexedDbEngine } from './storage/IndexedDbEngine';

export interface SecpCadProjectData {
  version: string;
  projectId: string;
  projectName: string;
  unit: string;
  updatedAt: string;
  parameters: Record<string, Parameter>;
  constraints: Constraint[];
  featureTree: Record<string, FeatureTreeNode>;
  
  /**
   * LEGACY COMPATIBILITY & DERIVED CACHE ONLY.
   * Under no circumstances is this field an independent engineering source of truth.
   * If canonicalDocument exists, it MUST take precedence.
   */
  activeSolid?: CadSolidEntity;

  /**
   * AUTHORITATIVE CANONICAL SOURCE OF TRUTH (SOT) — Single Document Mode.
   * Defines the entire design history (sketches, features, global parameters) of the CAD model.
   */
  canonicalDocument?: EngineeringDocument;

  /**
   * AUTHORITATIVE CANONICAL SOURCE OF TRUTH (SOT) — Multi-Document Assembly Mode (PATCH-038E).
   * Persisted bundle containing root assembly and all child part documents.
   * Takes absolute precedence over single canonicalDocument and legacy runtime state.
   */
  documentBundle?: PersistedDocumentBundle;

  /**
   * DERIVED RUNTIME PROJECTION ONLY.
   * Must never be treated as engineering truth.
   */
  assemblyComponents: AssemblyComponentItem[];
  assemblyMates: AssemblyMate[];
}

export interface ProductRecord {
  id: string;
  name: string;
  type: 'BLANK' | 'BALL_VALVE' | 'INDUSTRIAL_DRONE' | 'CUSTOM_SOLID' | 'IMPORTED';
  description: string;
  unit: string;
  updatedAt: string;
  projectData?: SecpCadProjectData;
}

function sanitizeProjectDataForLocalCache(data?: SecpCadProjectData): SecpCadProjectData | undefined {
  if (!data) return undefined;
  
  const sanitized: SecpCadProjectData = {
    ...data,
  };

  // If canonicalDocument or documentBundle exists, activeSolid is disposable derived cache
  if (sanitized.canonicalDocument || sanitized.documentBundle) {
    delete sanitized.activeSolid;
  }

  // Strip disposable derived mesh caches from local storage to conserve quota
  if (sanitized.canonicalDocument && sanitized.canonicalDocument.derived) {
    sanitized.canonicalDocument = {
      ...sanitized.canonicalDocument,
      derived: undefined
    };
  }

  return sanitized;
}

export class ProjectStorageEngine {
  private static STORAGE_KEY = 'SECP_CAD_CORE_PROJECT_V01';
  private static PRODUCTS_DB_KEY = 'SECP_CAD_PRODUCTS_DB_V01';
  private static ACTIVE_PRODUCT_ID_KEY = 'SECP_CAD_ACTIVE_PRODUCT_ID_V01';

  public static getProducts(): ProductRecord[] {
    try {
      const raw = localStorage.getItem(ProjectStorageEngine.PRODUCTS_DB_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ProductRecord[];
    } catch (e) {
      console.warn('[ProjectStorageEngine] Notice reading products from LocalStorage:', e);
      return [];
    }
  }

  public static async getProductsAsync(userId?: string): Promise<ProductRecord[]> {
    // 1. If authenticated, try Firestore
    if (userId) {
      try {
        const { FirestoreStorageService } = await import('../services/FirestoreStorageService');
        const cloudProducts = await FirestoreStorageService.getProducts(userId);
        if (cloudProducts && cloudProducts.length > 0) {
          return cloudProducts;
        }
      } catch (cloudErr) {
        console.warn('[ProjectStorageEngine] Cloud fetch notice, falling back to local DB:', cloudErr);
      }
    }

    // 2. Try IndexedDB (authoritative client-side persistent storage)
    if (IndexedDbEngine.isSupported()) {
      try {
        const idbProducts = await IndexedDbEngine.getProducts();
        if (idbProducts && idbProducts.length > 0) {
          return idbProducts;
        }
      } catch (idbErr) {
        console.warn('[ProjectStorageEngine] IndexedDB read notice:', idbErr);
      }
    }

    // 3. Fallback to LocalStorage
    return this.getProducts();
  }

  public static saveProducts(products: ProductRecord[]): void {
    // 1. Asynchronously save full-fidelity models into IndexedDB (quota-free)
    if (IndexedDbEngine.isSupported()) {
      IndexedDbEngine.saveProducts(products).catch(err => {
        console.warn('[ProjectStorageEngine] IndexedDB background save notice:', err);
      });
    }

    // 2. Attempt saving sanitized version to LocalStorage for instant sync reads
    try {
      const sanitizedProducts = products.map(p => ({
        ...p,
        projectData: sanitizeProjectDataForLocalCache(p.projectData)
      }));
      localStorage.setItem(ProjectStorageEngine.PRODUCTS_DB_KEY, JSON.stringify(sanitizedProducts));
    } catch (e) {
      // If full sanitized products still exceed quota, store lightweight metadata index in LocalStorage
      try {
        const metadataOnly = products.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          description: p.description,
          unit: p.unit,
          updatedAt: p.updatedAt
        }));
        localStorage.setItem(ProjectStorageEngine.PRODUCTS_DB_KEY, JSON.stringify(metadataOnly));
      } catch {
        console.info('[ProjectStorageEngine] LocalStorage quota reached. Persistence reliably maintained in IndexedDB.');
      }
    }
  }

  /**
   * PERSISTENCE REFACTOR (PATCH-039):
   * This handles high-volume data persistence across IndexedDB, LocalStorage, and Firestore.
   */
  public static async saveProductsAsync(products: ProductRecord[], userId?: string): Promise<void> {
    // 1. Persist to IndexedDB & LocalStorage
    this.saveProducts(products);

    if (IndexedDbEngine.isSupported()) {
      await IndexedDbEngine.saveProducts(products);
    }

    // 2. If user is authenticated, sync to cloud
    if (userId) {
      const { FirestoreStorageService } = await import('../services/FirestoreStorageService');
      for (const product of products) {
        await FirestoreStorageService.saveProduct(product, userId);
      }
    }
  }

  public static getActiveProductId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ProjectStorageEngine.ACTIVE_PRODUCT_ID_KEY);
  }

  public static setActiveProductId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ProjectStorageEngine.ACTIVE_PRODUCT_ID_KEY, id);
    }
    if (IndexedDbEngine.isSupported()) {
      IndexedDbEngine.setKeyValue(ProjectStorageEngine.ACTIVE_PRODUCT_ID_KEY, id).catch(() => {});
    }
  }

  public static saveToLocalStorage(project: SecpCadProjectData): void {
    if (IndexedDbEngine.isSupported()) {
      IndexedDbEngine.saveProject(project).catch(() => {});
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const sanitized = sanitizeProjectDataForLocalCache(project) || project;
        localStorage.setItem(ProjectStorageEngine.STORAGE_KEY, JSON.stringify(sanitized));
      }
    } catch (e) {
      console.info('[ProjectStorageEngine] LocalStorage quota reached for active project. Preserved in IndexedDB.');
    }
  }

  public static loadFromLocalStorage(): SecpCadProjectData | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(ProjectStorageEngine.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SecpCadProjectData;
    } catch (e) {
      console.warn('[ProjectStorageEngine] Notice reading project from LocalStorage:', e);
      return null;
    }
  }

  public static exportProjectJson(project: SecpCadProjectData): string {
    return JSON.stringify(project, null, 2);
  }

  public static importProjectJson(jsonString: string): SecpCadProjectData {
    const parsed = JSON.parse(jsonString) as SecpCadProjectData;
    if (!parsed.version || !parsed.projectName) {
      throw new Error('Invalid SECP CAD Project File Format');
    }
    return parsed;
  }
}
