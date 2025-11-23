'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { safeLog } from '@/utils/logger';
import { logSecurityEvent } from '@/utils/securityLogger';
import { useAuthProfile } from './useAuthProfile';

export function useAuth() {
  // Usar el hook useAuthProfile para obtener el perfil de forma segura
  const { profile, loading: profileLoading, error: profileError } = useAuthProfile();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  // Sincronizar el perfil del hook con el estado local
  useEffect(() => {
    safeLog('🔄 [useAuth] Sincronizando perfil:', {
      profileLoading,
      hasProfile: !!profile,
      profileId: profile?.id,
      profileError: profileError || null
    });
    
    // Si hay error en el perfil, verificar si es un error recuperable
    if (profileError) {
      const errorMessage = profileError || '';
      
      // Si el error indica que el usuario existe pero está desincronizado, 
      // NO establecer user como null - dejar que el usuario vea el error pero mantenga la sesión
      if (errorMessage.includes('desincronizado') || errorMessage.includes('fix-user-ids.sql')) {
        safeLog('⚠️ [useAuth] Error de sincronización - usuario necesita ejecutar script SQL');
        // Mantener user como null pero mostrar el error claramente
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Para otros errores, también establecer como null
      safeLog('⚠️ [useAuth] Error al cargar perfil:', profileError);
      setUser(null);
      setLoading(false);
      return;
    }
    
    // Si ya terminó de cargar (ya sea con o sin perfil)
    if (!profileLoading) {
      setUser(profile);
      setLoading(false);
      safeLog('✅ [useAuth] Perfil sincronizado:', {
        userId: profile?.id,
        email: profile?.email,
        role: profile?.role,
        hasUser: !!profile
      });
    } else {
      // Si aún está cargando, mantener el estado de loading
      safeLog('⏳ [useAuth] Perfil aún cargando...');
    }
  }, [profile, profileLoading, profileError]);

  useEffect(() => {
    // Verificar si hay parámetros de recovery en la URL
    if (typeof window === 'undefined') return;
    
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      // Redirigir a la página de reset de contraseña
      router.push('/reset-password');
      return;
    }

    // Escuchar cambios de autenticación para redirecciones
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        safeLog('🔄 [useAuth] Auth event:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user?.email) {
          // Redirigir según el tipo de usuario después del login exitoso
          if (session.user.email === 'kei.martinez@duocuc.cl') {
            router.push('/');
          } else if (session.user.email === 'l.garciadelahu@duocuc.cl') {
            router.push('/tickets');
          }
        } else if (event === 'SIGNED_OUT') {
          safeLog('👋 [useAuth] Usuario cerró sesión');
          // Redirigir al login cuando se cierra sesión
          router.push('/');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // La función fetchUserProfile ya no es necesaria
  // useAuthProfile se encarga de obtener el perfil de forma segura

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Mensaje genérico para evitar information disclosure
        // No revelar si el email existe o no, ni el tipo específico de error
        const genericErrorMessage = 'Email o contraseña incorrectos';
        
        // Log del error real para debugging (solo en desarrollo)
        safeLog('Login error:', { 
          code: error.status, 
          message: error.message,
          email: email.substring(0, 3) + '***' // Solo primeros 3 caracteres para logs
        });
        
        // Registrar evento de seguridad (asíncrono para no bloquear)
        logSecurityEvent('login_failed', {
          email,
          details: {
            errorCode: error.status,
            errorMessage: error.message,
          },
        });
        
        setLoading(false);
        return { data: null, error: new Error(genericErrorMessage) };
      }

      // Log de login exitoso (solo en desarrollo, sin información sensible)
      safeLog('Login exitoso para:', email.substring(0, 3) + '***');
      
      // Registrar evento de seguridad (asíncrono para no bloquear)
      logSecurityEvent('login_success', {
        email,
        userId: data.user?.id,
      });
      
      // No esperar a que el perfil se cargue - dejar que useAuthProfile lo maneje
      // Esto hace que el login responda más rápido
      setLoading(false);
      return { data, error: null };
    } catch (error: unknown) {
      // Manejar errores inesperados con mensaje genérico
      safeLog('Error inesperado en login:', error);
      setLoading(false);
      return { data: null, error: new Error('Error al iniciar sesión. Por favor, intenta nuevamente.') };
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

      // NOTA: NO intentamos crear el usuario manualmente aquí porque hay un trigger
      // en Supabase (`handle_new_user()`) que crea automáticamente el registro en la tabla
      // `users` cuando se registra un usuario en `auth.users`. Intentar crear manualmente
      // causaría un error 409 Conflict porque el usuario ya existe.
      // El hook `useAuthProfile` se encargará de obtener el perfil cuando esté disponible.

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
      // Verificar que estamos en el cliente antes de usar window
      if (typeof window === 'undefined') {
        return { data: null, error: new Error('Este método solo está disponible en el cliente'), waitSeconds: undefined };
      }
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Detectar errores de conexión o autenticación
        let errorMessage = error.message || 'Error al enviar correo de recuperación';
        let waitSeconds: number | undefined = undefined;
        
        // Obtener el status del error (puede estar en diferentes propiedades)
        const errorStatus = (error as any).status || (error as any).statusCode || (error as any).code;
        const errorMsg = error.message || '';
        
        // Detectar error 429 (rate limit) de múltiples formas
        const isRateLimit = 
          errorStatus === 429 || 
          errorMsg.includes('For security purposes') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('too many requests') ||
          errorMsg.toLowerCase().includes('429');
        
        if (isRateLimit) {
          // Intentar extraer el número de segundos del mensaje de múltiples formas:
          // "you can only request this after X seconds"
          // "For security purposes, you can only request this after X seconds"
          // "wait X seconds"
          const patterns = [
            /(\d+)\s*seconds?/i,
            /after\s+(\d+)\s*seconds?/i,
            /wait\s+(\d+)\s*seconds?/i,
            /(\d+)\s*segundos?/i,
            /espera\s+(\d+)\s*segundos?/i,
          ];
          
          for (const pattern of patterns) {
            const match = errorMsg.match(pattern);
            if (match) {
              waitSeconds = parseInt(match[1], 10);
              if (waitSeconds > 0 && waitSeconds < 3600) { // Validar que sea un número razonable
                errorMessage = `Por seguridad, debes esperar ${waitSeconds} segundos antes de solicitar otro enlace de recuperación.`;
                break;
              }
            }
          }
          
          // Si no se pudo extraer el tiempo, usar un mensaje genérico
          if (waitSeconds === undefined) {
            errorMessage = 'Demasiados intentos. Por favor, espera unos minutos antes de intentar nuevamente.';
            // Establecer un tiempo de espera por defecto de 60 segundos si no se puede extraer
            waitSeconds = 60;
          }
        } else if (errorMsg.includes('Invalid API key') || errorMsg.includes('JWT')) {
          errorMessage = 'Error de configuración: Las credenciales de Supabase no son válidas. Por favor, verifica tu configuración.';
        } else if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
          errorMessage = 'Error de conexión: No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        } else if (errorMsg.includes('Email rate limit')) {
          errorMessage = 'Demasiados intentos. Por favor, espera unos minutos antes de intentar nuevamente.';
          waitSeconds = 60; // Tiempo por defecto
        }
        
        console.error('Error en forgotPassword:', {
          error,
          status: errorStatus,
          message: errorMsg,
          waitSeconds
        });
        
        return { data: null, error: new Error(errorMessage), waitSeconds };
      }

      return { data, error: null, waitSeconds: undefined };
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
      return { data: null, error: new Error(errorMessage), waitSeconds: undefined };
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
