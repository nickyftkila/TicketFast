'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
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
        // Convertir el error de Supabase a Error estándar
        const errorMessage = error.message || 'Error al iniciar sesión';
        return { data: null, error: new Error(errorMessage) };
      }

      return { data, error: null };
    } catch (error: unknown) {
      // Manejar errores inesperados
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Error desconocido al iniciar sesión';
      return { data: null, error: new Error(errorMessage) };
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
        // Convertir el error de Supabase a Error estándar
        const errorMessage = error.message || 'Error al registrar usuario';
        return { data: null, error: new Error(errorMessage) };
      }

      // Crear el registro en la tabla users después del registro exitoso
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            email: data.user.email!,
            full_name: fullName,
            role: 'user' // Por defecto todos son 'user'
          });

        if (profileError) {
          console.error('Error creando perfil de usuario:', profileError);
          // No fallamos el registro si solo falla la creación del perfil
          // El usuario puede actualizar su perfil después
        }
      }

      return { data, error: null };
    } catch (error: unknown) {
      // Manejar errores inesperados
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Error desconocido al registrar usuario';
      return { data: null, error: new Error(errorMessage) };
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
        // Detectar errores de conexión o autenticación
        let errorMessage = error.message || 'Error al enviar correo de recuperación';
        
        // Mensajes más descriptivos para errores comunes
        if (error.message?.includes('Invalid API key') || error.message?.includes('JWT')) {
          errorMessage = 'Error de configuración: Las credenciales de Supabase no son válidas. Por favor, verifica tu configuración.';
        } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
          errorMessage = 'Error de conexión: No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        } else if (error.message?.includes('Email rate limit')) {
          errorMessage = 'Demasiados intentos. Por favor, espera unos minutos antes de intentar nuevamente.';
        }
        
        console.error('Error en forgotPassword:', error);
        return { data: null, error: new Error(errorMessage) };
      }

      return { data, error: null };
    } catch (error: unknown) {
      // Manejar errores de red o conexión (especialmente "Failed to fetch")
      let errorMessage = 'Error desconocido al enviar correo de recuperación';
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = 'Error de conexión: No se pudo conectar con el servidor de Supabase. Esto puede deberse a:\n' +
          '1. Las credenciales de Supabase son incorrectas o el proyecto fue eliminado\n' +
          '2. Problemas de conexión a internet\n' +
          '3. El servidor de Supabase no está disponible\n\n' +
          'Por favor, verifica tus credenciales en el archivo .env.local y asegúrate de que tu proyecto de Supabase esté activo.';
      } else if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Error de conexión: No se pudo conectar con el servidor de Supabase. Verifica que las credenciales estén correctas y que tengas acceso a la base de datos.';
        } else {
          errorMessage = error.message;
        }
      }
      
      console.error('Error inesperado en forgotPassword:', error);
      return { data: null, error: new Error(errorMessage) };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        // Convertir el error de Supabase a Error estándar
        const errorMessage = error.message || 'Error al actualizar contraseña';
        return { data: null, error: new Error(errorMessage) };
      }

      return { data, error: null };
    } catch (error: unknown) {
      // Manejar errores inesperados
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Error desconocido al actualizar contraseña';
      return { data: null, error: new Error(errorMessage) };
    }
  };

  const logout = async () => {
    // Prevenir múltiples llamadas simultáneas
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
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
      setLoggingOut(false);
    }
  };

  return {
    user,
    loading,
    loggingOut,
    login,
    register,
    forgotPassword,
    updatePassword,
    logout,
  };
}
