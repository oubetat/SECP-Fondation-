import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  updateDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ProductRecord } from './projectStorage';
import { sanitizeForFirestore } from '../services/FirestoreStorageService';

enum OperationType {
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

export class FirestoreStorageEngine {
  private static COLLECTION = 'products';

  public static async getProducts(): Promise<ProductRecord[]> {
    if (!auth.currentUser) return [];
    
    const path = FirestoreStorageEngine.COLLECTION;
    try {
      const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProductRecord));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  public static async saveProduct(product: ProductRecord): Promise<void> {
    if (!auth.currentUser) throw new Error('User must be authenticated to save products');
    
    const path = `${FirestoreStorageEngine.COLLECTION}/${product.id}`;
    try {
      const docRef = doc(db, FirestoreStorageEngine.COLLECTION, product.id);
      const rawPayload = {
        ...product,
        ownerId: auth.currentUser.uid,
        updatedAt: product.updatedAt || new Date().toISOString()
      };
      const sanitizedPayload = sanitizeForFirestore(rawPayload);
      await setDoc(docRef, sanitizedPayload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public static async deleteProduct(productId: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User must be authenticated to delete products');
    
    const path = `${FirestoreStorageEngine.COLLECTION}/${productId}`;
    try {
      const docRef = doc(db, FirestoreStorageEngine.COLLECTION, productId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public static async getProduct(productId: string): Promise<ProductRecord | null> {
    if (!auth.currentUser) return null;
    
    const path = `${FirestoreStorageEngine.COLLECTION}/${productId}`;
    try {
      const docRef = doc(db, FirestoreStorageEngine.COLLECTION, productId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return snapshot.data() as ProductRecord;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  }
}
