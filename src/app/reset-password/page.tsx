'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isValidSession, setIsValidSession] = useState(false);
  const router = useRouter();
  const { updatePassword } = useAuth();

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Función para verificar sesión y procesar tokens de recuperación
    const checkSession = async () => {
      try {
        // Verificar si hay un código de recuperación en los query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const recoveryCode = urlParams.get('code');
        
        // También verificar si hay un hash en la URL (token de recuperación)
        const hash = window.location.hash;
        const hasRecoveryHash = hash.includes('access_token') || hash.includes('type=recovery');
        
        console.log('🔍 Verificando sesión:', { 
          hasCode: !!recoveryCode, 
          hasHash: hasRecoveryHash,
          code: recoveryCode?.substring(0, 20) + '...'
        });

        // Si hay un código de recuperación en los query parameters, 
        // Supabase debería procesarlo automáticamente con detectSessionInUrl: true
        // Solo necesitamos esperar a que lo procese
        if (recoveryCode) {
          console.log('🔄 Código de recuperación detectado, esperando procesamiento...');
          // Esperar a que Supabase procese el código automáticamente
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar si se creó la sesión
          const { data: { session: codeSession } } = await supabase.auth.getSession();
          if (codeSession?.user && mounted) {
            console.log('✅ Sesión obtenida del código');
            setIsValidSession(true);
            setMessage('');
            // Limpiar el código de la URL
            window.history.replaceState({}, '', '/reset-password');
            return;
          }
        }

        // Obtener sesión actual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Hay una sesión válida
          console.log('✅ Sesión válida encontrada');
          if (mounted) {
            setIsValidSession(true);
            setMessage('');
          }
          return;
        }

        // Si hay hash de recuperación pero no hay sesión aún, esperar un poco
        // porque Supabase puede estar procesando el hash
        if (hasRecoveryHash && !session) {
          console.log('⏳ Esperando procesamiento del hash...');
          // Esperar un momento para que Supabase procese el hash
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar nuevamente después de esperar
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user && mounted) {
            console.log('✅ Sesión obtenida después de esperar');
            setIsValidSession(true);
            setMessage('');
            return;
          }
        }

        // Si no hay sesión ni token de recuperación, mostrar error
        if (!recoveryCode && !hasRecoveryHash && !session && mounted) {
          console.log('❌ No hay token de recuperación ni sesión');
          setMessage('Enlace expirado o inválido. Por favor, solicita un nuevo enlace de recuperación.');
        }
      } catch (error) {
        console.error('❌ Error al verificar sesión:', error);
        if (mounted) {
          setMessage('Error al verificar el enlace. Por favor, intenta nuevamente.');
        }
      }
    };

    // Esperar un momento antes de verificar para dar tiempo a que Supabase procese la URL
    const initialDelay = setTimeout(() => {
      checkSession();
    }, 300);

    // Escuchar cambios de autenticación para detectar cuando el usuario llega desde el email
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.id);
        
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          console.log('✅ PASSWORD_RECOVERY detectado');
          if (mounted) {
            setIsValidSession(true);
            setMessage('');
          }
        } else if (event === 'SIGNED_IN' && session?.user) {
          // También verificar si hay sesión después de SIGNED_IN
          // (puede ser que el enlace haya iniciado sesión)
          console.log('✅ SIGNED_IN detectado');
          if (mounted) {
            setIsValidSession(true);
            setMessage('');
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Si se refrescó el token, verificar si es válido
          console.log('✅ TOKEN_REFRESHED detectado');
          if (mounted) {
            setIsValidSession(true);
            setMessage('');
          }
        }
      }
    );

    // Timeout de seguridad: si después de 5 segundos no hay sesión válida,
    // verificar una última vez
    timeoutId = setTimeout(async () => {
      if (mounted) {
        console.log('⏰ Timeout: verificando sesión una última vez...');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          console.log('✅ Sesión encontrada en timeout');
          setIsValidSession(true);
          setMessage('');
        } else {
          console.log('❌ No se pudo obtener sesión después del timeout');
        }
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(initialDelay);
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await updatePassword(password);
      
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Contraseña actualizada exitosamente. Redirigiendo al login...');
        // Esperar un poco más para que el usuario vea el mensaje
        setTimeout(async () => {
          // Cerrar sesión primero para limpiar el estado
          await supabase.auth.signOut();
          // Luego redirigir al login
          router.push('/');
        }, 3000);
      }
    } catch (error: unknown) {
      console.error('Error al actualizar la contraseña:', error);
      setMessage('Error al actualizar la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-shell overflow-hidden">
      <div className="page-safe-area min-h-screen flex items-center justify-center py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-black border border-[#00b41d] rounded-2xl shadow-card-soft p-8 text-white">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00b41d] rounded-2xl mb-4">
                <Lock className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Restablecer Contraseña
              </h2>
              <p className="text-white/70">
                Ingresa tu nueva contraseña
              </p>
            </div>

            {!isValidSession ? (
              <div className="text-center">
                <div className="p-4 rounded-xl bg-red-900/20 border border-red-600/40 mb-4">
                  <p className="text-sm text-red-300">
                    {message}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 text-white font-semibold py-3 px-4 rounded-xl border border-[#00b41d] transition-opacity duration-200"
                >
                  Volver al Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
                {/* Nueva Contraseña */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-white/50" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-12 py-3 border border-[#367640] rounded-xl bg-black text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] hover:border-[#00b41d]/80 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirmar Contraseña */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-white mb-2">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-white/50" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-12 py-3 border border-[#367640] rounded-xl bg-black text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] hover:border-[#00b41d]/80 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mensaje */}
                {message && (
                  <div className={`p-4 rounded-xl ${
                    message.includes('exitosamente') 
                      ? 'bg-green-900/20 border border-green-600/40' 
                      : 'bg-red-900/20 border border-red-600/40'
                  }`}>
                    <p className={`text-sm ${
                      message.includes('exitosamente') 
                        ? 'text-green-300' 
                        : 'text-red-300'
                    }`}>
                      {message}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl border border-[#00b41d] transition-opacity duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                      Actualizando...
                    </>
                  ) : (
                    'Actualizar Contraseña'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}