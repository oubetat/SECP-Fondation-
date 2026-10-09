import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ProductRecord } from '../engine/projectStorage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively removes all undefined values and sanitizes payloads for Firestore
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

export const FirestoreStorageService = {
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  },

  async saveProduct(product: ProductRecord, userId: string): Promise<void> {
    const path = `products/${product.id}`;
    try {
      const nowIso = new Date().toISOString();
      
      // Clean and sanitize project data
      let sanitizedProjectData = product.projectData ? { ...product.projectData } : undefined;
      if (sanitizedProjectData) {
        if (!sanitizedProjectData.updatedAt) {
          sanitizedProjectData.updatedAt = product.updatedAt || nowIso;
        }
        if (!sanitizedProjectData.projectId) {
          sanitizedProjectData.projectId = product.id;
        }
        // Strip heavy transient mesh buffers to keep document within 1MB
        if (sanitizedProjectData.canonicalDocument?.derived) {
          sanitizedProjectData.canonicalDocument = {
            ...sanitizedProjectData.canonicalDocument,
            derived: {}
          };
        }
        if (sanitizedProjectData.canonicalDocument || sanitizedProjectData.documentBundle) {
          delete sanitizedProjectData.activeSolid;
        }
      }

      const rawPayload = {
        ...product,
        userId,
        updatedAt: product.updatedAt || nowIso,
        projectData: sanitizedProjectData
      };

      const sanitizedPayload = sanitizeForFirestore(rawPayload);

      await setDoc(doc(db, 'products', product.id), sanitizedPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getProducts(userId: string): Promise<ProductRecord[]> {
    const path = 'products';
    try {
      const q = query(collection(db, 'products'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ProductRecord);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async deleteProduct(productId: string): Promise<void> {
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
