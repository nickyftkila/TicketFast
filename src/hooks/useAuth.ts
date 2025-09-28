'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay parámetros de recovery en la URL
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      // Redirigir a la página de reset de contraseña
      router.push('/reset-password');
      return;
    }

    // Obtener sesión inicial
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.email!);
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    getInitialSession();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user.email!);
          // Redirigir según el tipo de usuario después del login exitoso
          if (session.user.email === 'kei.martinez@duocuc.cl') {
            router.push('/');
          } else if (session.user.email === 'l.garciadelahu@duocuc.cl') {
            router.push('/tickets');
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          // Redirigir al login cuando se cierra sesión
          router.push('/');
        } else if (event === 'PASSWORD_RECOVERY') {
          // Durante el reset de contraseña, no hacer nada especial
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Actualizar perfil cuando se refresca el token
          await fetchUserProfile(session.user.email!);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchUserProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setLoading(false);
        return;
      }

      setUser(data);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error: error instanceof Error ? error : new Error('Error desconocido') };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error: error instanceof Error ? error : new Error('Error desconocido') };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error: error instanceof Error ? error : new Error('Error desconocido') };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error: error instanceof Error ? error : new Error('Error desconocido') };
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      // El estado se actualizará automáticamente por el listener de auth
      // No necesitamos hacer router.push aquí porque se maneja en el listener
    } catch (error) {
      console.error('Error logging out:', error);
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    login,
    register,
    forgotPassword,
    updatePassword,
    logout,
  };
}
