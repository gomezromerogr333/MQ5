import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import type { Role, StudentProfile } from '../lib/types';

interface Profile {
  userId: string;
  role: Role;
  student: StudentProfile | null;
}

interface AuthContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  session: Session | null;
  isAnonymous: boolean;
  role: Role | null;
  student: StudentProfile | null;
  /** Vuelve a leer el rol/perfil. Úsalo tras registrar a un estudiante o docente. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile> {
  // Las dos lecturas van en paralelo (antes en serie: un viaje de red más en cada entrada).
  // get_my_student devuelve vacío si la persona no es estudiante, así que es seguro pedirla ya.
  const [roleRes, studentRes] = await Promise.all([supabase.rpc('get_my_role'), supabase.rpc('get_my_student')]);
  if (roleRes.error) throw roleRes.error;
  const role = roleRes.data;

  let student: StudentProfile | null = null;
  if (role === 'student') {
    if (studentRes.error) throw studentRes.error;
    student = ((studentRes.data as StudentProfile[] | null) ?? [])[0] ?? null;
  }
  return { userId, role: (role as Role) ?? 'none', student };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Solo la lectura de perfil más reciente puede guardar su resultado.
  const loadSeq = useRef(0);

  // 1. Sesión de Supabase (el listener solo actualiza estado, sin llamar a Supabase).
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setSessionReady(true);
      })
      .catch(() => active && setSessionReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (userId: string) => {
    const seq = ++loadSeq.current;
    try {
      const next = await fetchProfile(userId);
      if (seq !== loadSeq.current) return;
      setProfile(next);
      setError(null);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(friendlyError(err));
    }
  }, []);

  // 2. Rol y perfil cada vez que cambia el usuario.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!sessionReady) return;
    if (!userId) {
      loadSeq.current++;
      setProfile(null);
      setError(null);
      return;
    }
    setProfile(null);
    setError(null);
    void load(userId);
  }, [sessionReady, userId, load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    setError(null);
    await load(uid);
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const current = profile && profile.userId === userId ? profile : null;
    const loading = !sessionReady || (userId !== null && current === null && error === null);
    return {
      status: error ? 'error' : loading ? 'loading' : 'ready',
      error,
      session,
      isAnonymous: session?.user.is_anonymous ?? false,
      role: userId ? (current?.role ?? null) : 'none',
      student: current?.student ?? null,
      refresh,
      signOut,
    };
  }, [profile, userId, sessionReady, error, session, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
