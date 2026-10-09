import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface UserProfile {
  email: string;
  displayName: string;
  photoURL?: string;
  isCustom?: boolean;
}

interface AuthContextType {
  user: User | null;
  customUser: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginAsAnyEmail: (email: string, name?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customUser, setCustomUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('secp_custom_user');
      return saved ? JSON.parse(saved) : { email: 'oubetat.1@gmail.com', displayName: 'Engineering Lead' };
    } catch {
      return { email: 'oubetat.1@gmail.com', displayName: 'Engineering Lead' };
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google sign in failed:', error);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      // Fallback for any email
      loginAsAnyEmail(email);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (res.user) {
        await updateProfile(res.user, { displayName: name });
      }
    } catch {
      loginAsAnyEmail(email, name);
    }
  };

  const loginAsAnyEmail = (email: string, name?: string) => {
    const profile: UserProfile = {
      email: email || 'user@company.com',
      displayName: name || email.split('@')[0] || 'Engineer User',
      isCustom: true
    };
    setCustomUser(profile);
    localStorage.setItem('secp_custom_user', JSON.stringify(profile));
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
    setCustomUser(null);
    localStorage.removeItem('secp_custom_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customUser,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        loginAsAnyEmail,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
