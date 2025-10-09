import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

type Role = 'admin' | 'user' | 'staff' | null;

type Ctx = {
  user: User | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutApp: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({} as any);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() =>
    onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await getIdTokenResult(u, true);
        setRole((token.claims.role as Role) ?? 'user');
      } else {
        setRole(null);
      }
      setLoading(false);
    }), []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    const token = await getIdTokenResult(auth.currentUser!, true);
    setRole((token.claims.role as Role) ?? 'user');
  };

  const signOutApp = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOutApp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
