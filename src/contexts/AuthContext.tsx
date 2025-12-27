import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, hasRoleOrHigher } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isSystemAdmin: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  hasRole: (requiredRole: AppRole) => boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, additionalData?: {
    employee_number?: string;
    national_id?: string;
    phone?: string;
    allow_whatsapp?: boolean;
    allow_telegram?: boolean;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role as AppRole | null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then(setRole);
          }, 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then(setRole);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string,
    additionalData?: {
      employee_number?: string;
      national_id?: string;
      phone?: string;
      allow_whatsapp?: boolean;
      allow_telegram?: boolean;
    }
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          employee_number: additionalData?.employee_number,
          national_id: additionalData?.national_id,
          phone: additionalData?.phone,
          allow_whatsapp: additionalData?.allow_whatsapp || false,
          allow_telegram: additionalData?.allow_telegram || false,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRoleCheck = (requiredRole: AppRole): boolean => {
    return hasRoleOrHigher(role, requiredRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isSystemAdmin: role === 'system_admin',
        isAdmin: hasRoleOrHigher(role, 'admin'),
        isSupervisor: hasRoleOrHigher(role, 'supervisor'),
        isEmployee: role === 'employee',
        hasRole: hasRoleCheck,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
