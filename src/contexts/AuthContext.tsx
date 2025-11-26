import React, {createContext, useContext, useEffect, useState} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {auth, db} from '../lib/firebase';
import {doc, onSnapshot} from 'firebase/firestore';

type Role = 'admin'|'user'|null;

type Profile = {
  email?: string;
  phone?: string;
  dob?: string;        // 'AAAA-MM-DD' - dob = date of birth
  carModel?: string;
  role?: 'admin'|'user';
  isActive?: boolean;
} | null;

type Ctx = {
  user: User|null;
  role: Role;
  profile: Profile;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutApp: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({} as any);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [user, setUser] = useState<User|null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setRole(null);
      setProfile(null);

      if (!u) { setLoading(false); return; }

      // Assina o documento de perfil do usuário logado
      const ref = doc(db, 'profiles', u.uid);
      const unsubProfile = onSnapshot(ref, (snap) => {
        const data = snap.data() as Profile;
        setProfile(data || null);
        const r = (data?.role as Role) ?? 'user';
        setRole(r);

        // Bloqueia se o perfil estiver desativado
        if (data && data.isActive === false) {
          signOut(auth).catch(()=>{});
        }
        setLoading(false);
      }, () => {
        // Se o doc não existir ainda, considera 'user'
        setRole('user');
        setProfile(null);
        setLoading(false);
      });

      // cleanup do snapshot quando trocar de usuário
      return unsubProfile;
    });

    return () => unsubAuth();
  }, []);

  const signInFn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // o snapshot do perfil ajusta role/profile automaticamente
  };

  const signOutApp = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{user, role, profile, loading, signIn: signInFn, signOutApp}}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
