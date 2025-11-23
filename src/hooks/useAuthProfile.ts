'use client';

import { useEffect, useState } from 'react';
import { supabase, User } from '@/lib/supabase';
import { safeLog } from '@/utils/logger';

/**
 * Hook para gestionar el perfil de usuario autenticado
 * Compatible con Supabase-js v2 + Next.js 15 + React 19
 * 
 * Asegura que:
 * 1. Espera a que la sesión esté disponible antes de consultar el perfil
 * 2. Usa supabase-js correctamente para evitar errores 406
 * 3. Maneja correctamente los cambios de autenticación
 */
export function useAuthProfile() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let isFetching = false; // Bandera para evitar llamadas concurrentes
    let fetchProfileTimeout: NodeJS.Timeout | null = null; // Timeout para debounce de fetchProfile

    // Función auxiliar para limpiar timeout y establecer loading
    const finishLoading = (clearTimeoutFlag = true) => {
      if (clearTimeoutFlag && timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (mounted) {
        setLoading(false);
        isFetching = false; // Liberar la bandera cuando termine
      }
    };

    const fetchProfile = async () => {
      // Evitar llamadas concurrentes
      if (isFetching) {
        safeLog('⚠️ [useAuthProfile] fetchProfile ya está en ejecución, ignorando llamada concurrente');
        return;
      }

      try {
        isFetching = true; // Establecer bandera ANTES de cualquier operación asíncrona
        setLoading(true);
        setError(null);

        // Timeout de seguridad: si después de 8 segundos no se ha cargado el perfil,
        // establecer loading como false para evitar bloqueo infinito
        timeoutId = setTimeout(() => {
          if (mounted) {
            safeLog('⏰ [useAuthProfile] Timeout: el perfil tardó más de 8 segundos en cargar');
            finishLoading(false); // No limpiar timeout aquí porque ya se ejecutó
            setError('El perfil tardó demasiado en cargar. Por favor, recarga la página.');
          }
        }, 8000);

        // 1) PRIMERO: Obtener sesión actual y verificar que tenga token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          safeLog('⚠️ [useAuthProfile] Error al obtener sesión:', sessionError);
          if (mounted) {
            setProfile(null);
            setError(sessionError.message);
            finishLoading();
          }
          return;
        }

        if (!mounted) return;

        if (!session?.user?.id || !session?.access_token) {
          safeLog('⚠️ [useAuthProfile] No hay sesión activa o falta token');
          if (mounted) {
            setProfile(null);
            finishLoading();
          }
          return;
        }

        const uid = session.user.id;
        
        safeLog('🔄 [useAuthProfile] Obteniendo perfil de usuario', {
          userId: uid,
          email: session.user.email,
          hasToken: !!session.access_token
        });

        // 2) Función auxiliar para reintentos con backoff exponencial (optimizado para velocidad)
        const tryGetProfile = async (attempts = [200, 400, 800]) => {
          for (let i = 0; i <= attempts.length; i++) {
            if (!mounted) {
              return { data: null, error: new Error('unmounted') };
            }

            const { data: pData, error: pErr } = await supabase
              .from('users')
              .select('id, email, full_name, role, created_at, updated_at')
              .eq('id', uid)
              .maybeSingle();

            if (!mounted) {
              return { data: null, error: new Error('unmounted') };
            }

            // Si hay datos, éxito
            if (pData) {
              safeLog(`✅ [useAuthProfile] Perfil obtenido en intento ${i + 1}`);
              return { data: pData, error: null };
            }

            // Si hay error, retornarlo (excepto si es 403 que manejamos después)
            if (pErr) {
              const errorStatus = (pErr as any).status || (pErr as any).statusCode || null;
              // Si es 403, continuar con los reintentos
              if (errorStatus === 403 && i < attempts.length) {
                safeLog(`⚠️ [useAuthProfile] Error 403 en intento ${i + 1}, reintentando...`);
              } else {
                // Otro error o último intento con 403
                return { data: null, error: pErr };
              }
            }

            // Si no hay data ni error, esperar y reintentar según backoff
            const delay = attempts[i] ?? null;
            if (delay) {
              safeLog(`🔄 [useAuthProfile] Reintento ${i + 1} en ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            break;
          }

          return { data: null, error: null };
        };

        // 3) Intentar obtener perfil con backoff
        safeLog('🔄 [useAuthProfile] Haciendo GET (select) para obtener perfil', {
          userId: uid
        });

        const { data: profileData, error: profileError } = await tryGetProfile();

        if (!mounted) return;

        // Si hay datos, éxito - retornar
        if (profileData) {
          safeLog('✅ [useAuthProfile] Perfil obtenido exitosamente (GET)', {
            userId: profileData.id,
            email: profileData.email,
            role: profileData.role
          });
          if (mounted) {
            setProfile(profileData);
            setError(null);
            finishLoading();
          }
          return;
        }

        // Si hay error, manejarlo
        if (profileError) {
          const errorStatus = (profileError as any).status || (profileError as any).statusCode || null;
          
          safeLog('❌ [useAuthProfile] Error en GET (select) después de todos los reintentos:', {
            message: profileError.message,
            code: 'code' in profileError ? (profileError as any).code : undefined,
            status: errorStatus
          });
          
          // Error 406: problema de cabeceras o formato
          if (errorStatus === 406) {
            setError('Error de comunicación con el servidor. Por favor, recarga la página.');
            if (mounted) {
              setProfile(null);
              finishLoading();
            }
            return;
          }
          
          // Error 403: problema de permisos RLS persistente
          if (errorStatus === 403) {
            safeLog('❌ [useAuthProfile] Error 403 persiste después de todos los reintentos');
            setError('No tienes permisos para acceder a tu perfil. Contacta al administrador.');
            if (mounted) {
              setProfile(null);
              finishLoading();
            }
            return;
          }
          
          // Otros errores
          setError(profileError.message || 'Error al cargar perfil de usuario');
          if (mounted) {
            setProfile(null);
            finishLoading();
          }
          return;
        }

        // 4) Si no hay datos ni error después de todos los reintentos, el usuario puede no existir
        // O puede existir pero RLS está bloqueando el acceso
        // Intentar crearlo automáticamente como respaldo del trigger
        // PERO: Si ya intentamos crear antes y recibimos 409, NO intentar de nuevo
        safeLog('⚠️ [useAuthProfile] Usuario no encontrado después de todos los reintentos', {
          userId: uid,
          email: session.user.email,
          hint: 'El usuario puede no existir o RLS está bloqueando el acceso'
        });
        
        // Verificar una vez más con GET antes de intentar crear (última verificación)
        safeLog('🔄 [useAuthProfile] Última verificación con GET antes de intentar crear');
        const { data: finalCheck, error: finalCheckError } = await supabase
          .from('users')
          .select('id, email, full_name, role, created_at, updated_at')
          .eq('id', uid)
          .maybeSingle();
        
        if (!mounted) return;
        
        if (!finalCheckError && finalCheck) {
          safeLog('✅ [useAuthProfile] Usuario encontrado en verificación final');
          setProfile(finalCheck);
          setError(null);
          finishLoading();
          return;
        }
        
        if (finalCheckError) {
          const finalErrorStatus = (finalCheckError as any).status || (finalCheckError as any).statusCode || null;
          safeLog('❌ [useAuthProfile] Error en verificación final:', {
            message: finalCheckError.message,
            code: finalCheckError.code,
            status: finalErrorStatus
          });
          
          // Si es 403, es problema de RLS - no intentar crear
          if (finalErrorStatus === 403) {
            safeLog('❌ [useAuthProfile] Error 403 persistente - problema de RLS, no se puede crear ni leer');
            setError('No tienes permisos para acceder a tu perfil. Por favor, contacta al administrador.');
            if (mounted) {
              setProfile(null);
              finishLoading();
            }
            return;
          }
        }
        
        // Si llegamos aquí, el usuario no se encontró por ID
        // ANTES de intentar crear, buscar por email (puede existir con ID diferente)
        safeLog('🔄 [useAuthProfile] Usuario no encontrado por ID, buscando por email antes de crear', {
          userId: uid,
          email: session.user.email
        });
        
        const { data: emailData, error: emailError } = await supabase
          .from('users')
          .select('id, email, full_name, role, created_at, updated_at')
          .eq('email', session.user.email || '')
          .maybeSingle();
        
        if (!mounted) return;
        
        if (!emailError && emailData) {
          // El usuario existe pero con ID diferente - problema de sincronización
          safeLog('⚠️ [useAuthProfile] Usuario encontrado por email pero con ID diferente', {
            foundId: emailData.id,
            expectedId: uid,
            email: emailData.email,
            hint: 'Ejecutar fix-user-ids.sql en Supabase para sincronizar IDs'
          });
          
          // Si el ID encontrado coincide con el esperado, usarlo
          if (emailData.id === uid) {
            safeLog('✅ [useAuthProfile] ID coincide, usando perfil encontrado');
            setProfile(emailData);
            setError(null);
            finishLoading();
            return;
          } else {
            // ID diferente - no podemos usarlo porque RLS lo bloqueará
            setError('Tu perfil existe pero está desincronizado. Ejecuta fix-user-ids.sql en Supabase para corregirlo.');
            if (mounted) {
              setProfile(null);
              finishLoading();
            }
            return;
          }
        }
        
        // Si no se encontró por email, el usuario realmente no existe - intentar crearlo
        // PERO: Si el trigger no funcionó, puede ser que el usuario exista pero con un ID diferente
        // Intentar una búsqueda más amplia antes de crear
        safeLog('🔄 [useAuthProfile] Usuario no encontrado por ID ni email, intentando crear en public.users', {
          userId: uid,
          email: session.user.email,
          hint: 'Si el trigger no funcionó, el usuario puede existir con ID diferente'
        });
        
        // IMPORTANTE: .insert() hace POST, NO usar .select() después para evitar POST con select=
        // NOTA: Si hay una política RLS para INSERT, esto funcionará. Si no, dará error 403.
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: uid,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
            role: 'user' // Por defecto todos son 'user'
          });

        if (!mounted) return;

        if (createError) {
          // Extraer propiedades del error
          const createErrorCode = 'code' in createError ? (createError as any).code : undefined;
          const createErrorStatus = (createError as any).status || (createError as any).statusCode || null;
          
          // Error 403: No hay permisos para INSERT (falta política RLS)
          if (createErrorStatus === 403) {
            safeLog('❌ [useAuthProfile] Error 403 al crear usuario - falta política RLS para INSERT', {
              message: createError.message,
              hint: 'Ejecutar fix-users-insert-policy.sql en Supabase'
            });
            setError('No tienes permisos para crear tu perfil. Por favor, contacta al administrador.');
            if (mounted) {
              setProfile(null);
              finishLoading();
            }
            return;
          }
          
          // Error 409: El usuario ya existe (conflicto) - buscar por email porque puede tener ID diferente
          if (createErrorCode === '23505' || createErrorStatus === 409) {
            safeLog('⚠️ [useAuthProfile] Usuario ya existe (409 Conflict) - buscando por email', {
              userId: uid,
              email: session.user.email
            });
            
            // Esperar un momento antes de intentar obtener (reducido para mayor velocidad)
            await new Promise(resolve => setTimeout(resolve, 150));
            
            if (!mounted) return;
            
            // PRIMERO: Intentar obtener por email (puede tener ID diferente)
            const { data: emailData, error: emailError } = await supabase
              .from('users')
              .select('id, email, full_name, role, created_at, updated_at')
              .eq('email', session.user.email || '')
              .maybeSingle();
            
            if (!mounted) return;
            
            if (!emailError && emailData) {
              // Usuario encontrado por email
              if (emailData.id === uid) {
                // ID coincide - usar el perfil
                safeLog('✅ [useAuthProfile] Usuario encontrado por email con ID correcto después de 409');
                setProfile(emailData);
                setError(null);
                finishLoading();
                return;
              } else {
                // ID diferente - problema de sincronización
                safeLog('❌ [useAuthProfile] Usuario encontrado por email pero con ID diferente después de 409', {
                  foundId: emailData.id,
                  expectedId: uid,
                  hint: 'Ejecutar fix-user-ids.sql en Supabase para sincronizar IDs'
                });
                setError('Tu perfil existe pero está desincronizado. Ejecuta fix-user-ids.sql en Supabase para corregirlo.');
                if (mounted) {
                  setProfile(null);
                  finishLoading();
                }
                return;
              }
            }
            
            // Si no se encontró por email, intentar por ID con reintentos
            let existingData = null;
            let fetchError = null;
            const fetchRetries = [150, 300, 500];
            
            for (let retry = 0; retry <= fetchRetries.length; retry++) {
              const { data, error } = await supabase
                .from('users')
                .select('id, email, full_name, role, created_at, updated_at')
                .eq('id', uid)
                .maybeSingle();

              if (!mounted) return;

              if (!error && data) {
                existingData = data;
                fetchError = null;
                safeLog(`✅ [useAuthProfile] Usuario obtenido por ID después de 409 en intento ${retry + 1}`);
                break;
              }
              
              fetchError = error;
              
              if (error) {
                const errorStatus = (error as any).status || null;
                safeLog(`⚠️ [useAuthProfile] Error al obtener por ID después de 409 (intento ${retry + 1}):`, {
                  status: errorStatus
                });
              }
              
              const delay = fetchRetries[retry] ?? null;
              if (delay) {
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                break;
              }
            }

            if (!mounted) return;

            if (!fetchError && existingData) {
              safeLog('✅ [useAuthProfile] Usuario obtenido después de conflicto 409');
              setProfile(existingData);
              setError(null);
              finishLoading();
              return;
            } else {
              // No se pudo obtener - el usuario existe pero no se puede acceder
              safeLog('❌ [useAuthProfile] Usuario existe (409) pero no se puede leer', {
                userId: uid,
                email: session.user.email,
                hint: 'Ejecutar fix-user-ids.sql en Supabase para sincronizar IDs'
              });
              setError('El usuario existe pero no se puede acceder. Ejecuta fix-user-ids.sql en Supabase.');
              if (mounted) {
                setProfile(null);
                finishLoading();
              }
              return;
            }
          }
          
          safeLog('❌ [useAuthProfile] Error al crear usuario:', {
            message: createError.message,
            code: createErrorCode,
            status: createErrorStatus
          });
          
          setError('No se pudo crear ni cargar el perfil de usuario. Por favor, recarga la página.');
          if (mounted) {
            setProfile(null);
            finishLoading();
          }
          return;
        }

        // 5) Usuario creado exitosamente, hacer GET separado para obtenerlo
        safeLog('✅ [useAuthProfile] Usuario creado exitosamente, obteniendo perfil');
        
        const { data: newProfileData, error: fetchNewError } = await supabase
          .from('users')
          .select('id, email, full_name, role, created_at, updated_at')
          .eq('id', uid)
          .maybeSingle();

        if (!mounted) return;

        if (fetchNewError || !newProfileData) {
          safeLog('❌ [useAuthProfile] Error al obtener perfil después de crear usuario:', fetchNewError);
          setError('Usuario creado pero no se pudo obtener el perfil. Por favor, recarga la página.');
          if (mounted) {
            setProfile(null);
            finishLoading();
          }
          return;
        }

        safeLog('✅ [useAuthProfile] Perfil obtenido después de crear usuario');
        if (mounted) {
          setProfile(newProfileData);
          setError(null);
          finishLoading();
        }
        return;
      } catch (err) {
        safeLog('❌ [useAuthProfile] Error inesperado:', err);
        if (mounted) {
          setProfile(null);
          setError(err instanceof Error ? err.message : 'Error desconocido');
          finishLoading();
        }
      } finally {
        // Asegurar que isFetching se libere siempre, incluso si hay error
        if (mounted) {
          isFetching = false;
        }
      }
    };


    // Inicializar al montar
    fetchProfile();

    // 5) Listener para cambios de autenticación (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        safeLog('🔄 [useAuthProfile] Auth event:', event, {
          email: session?.user?.email,
          userId: session?.user?.id,
          hasToken: !!session?.access_token
        });

        // Función helper para llamar a fetchProfile con debounce (optimizado para velocidad)
        const scheduleFetchProfile = (delay: number = 100) => {
          if (fetchProfileTimeout) {
            clearTimeout(fetchProfileTimeout);
          }
          fetchProfileTimeout = setTimeout(() => {
            if (mounted && !isFetching) {
              fetchProfile();
            }
          }, delay);
        };

        // Solo recargar perfil si hay sesión válida
        if (event === 'SIGNED_IN' && session?.user?.id && session?.access_token) {
          safeLog('✅ [useAuthProfile] Usuario autenticado (SIGNED_IN), programando recarga de perfil', {
            userId: session.user.id,
            email: session.user.email
          });
          scheduleFetchProfile(50); // Delay mínimo para evitar llamadas múltiples
        } else if (event === 'SIGNED_OUT') {
          safeLog('👋 [useAuthProfile] Usuario cerró sesión');
          if (fetchProfileTimeout) {
            clearTimeout(fetchProfileTimeout);
            fetchProfileTimeout = null;
          }
          // Limpiar inmediatamente sin esperar
          if (mounted) {
            setProfile(null);
            setError(null);
            setLoading(false);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.id && session?.access_token) {
          safeLog('🔄 [useAuthProfile] Token refrescado, programando recarga de perfil');
          scheduleFetchProfile(50);
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user?.id && session?.access_token) {
            safeLog('🔄 [useAuthProfile] Sesión inicial detectada, programando carga de perfil', {
              userId: session.user.id,
              email: session.user.email
            });
            scheduleFetchProfile(50);
          } else {
            safeLog('⚠️ [useAuthProfile] INITIAL_SESSION sin usuario o token');
            if (mounted) {
              setProfile(null);
              setLoading(false);
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (fetchProfileTimeout) {
        clearTimeout(fetchProfileTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  return { profile, loading, error };
}

