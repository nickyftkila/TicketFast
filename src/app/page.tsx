'use client';

import AuthContainer from '@/components/auth/AuthContainer';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/components/dashboard/Dashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const { error: profileError } = useAuthProfile();
  const router = useRouter();

  // Redirigir según el rol del usuario - DEBE estar antes de cualquier return
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'supervisor') {
        router.push('/supervisor');
      } else if (user.role === 'support') {
        router.push('/tickets');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <span className="animate-spin inline-block h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-4">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          </span>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si hay error de perfil relacionado con desincronización, mostrar mensaje claro
  if (profileError && (profileError.includes('desincronizado') || profileError.includes('fix-user-ids.sql'))) {
    return (
      <div className="page-shell overflow-hidden">
        <div className="page-safe-area min-h-screen flex items-center justify-center py-10">
          <div className="w-full max-w-3xl mx-auto px-4">
            <div className="bg-black border border-[#00b41d] rounded-2xl shadow-card-soft p-6 sm:p-8 text-white">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-900/20 border border-yellow-600/40 rounded-2xl mb-4">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Perfil Desincronizado
                </h2>
                <p className="text-white/70">
                  Tu cuenta existe pero necesita sincronización. Ejecuta el script SQL en Supabase para corregirlo.
                </p>
              </div>
              
              <div className="bg-black/50 border border-[#367640] rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-white mb-4 text-lg">Pasos para solucionar:</h3>
                <ol className="list-decimal list-inside space-y-3 text-sm text-white/80 mb-4">
                  <li>Abre el SQL Editor en Supabase</li>
                  <li>Copia y pega el script SQL que aparece abajo</li>
                  <li>Ejecútalo en Supabase</li>
                  <li>Recarga esta página</li>
                </ol>
                <div className="mt-4 p-4 bg-black border border-[#367640] rounded-lg overflow-x-auto">
                  <pre className="text-xs text-[#00b41d] font-mono leading-relaxed">
                    <code>{`-- Script para sincronizar IDs
BEGIN;

-- PASO 1: Actualizar referencias ANTES de eliminar usuarios
UPDATE tickets t SET created_by = au.id
FROM auth.users au
INNER JOIN public.users pu_old ON pu_old.email = au.email
WHERE t.created_by = pu_old.id AND pu_old.id != au.id;

UPDATE ticket_responses tr SET created_by = au.id
FROM auth.users au
INNER JOIN public.users pu_old ON pu_old.email = au.email
WHERE tr.created_by = pu_old.id AND pu_old.id != au.id;

-- PASO 2: Eliminar usuarios con IDs incorrectos
DELETE FROM public.users pu
WHERE EXISTS (
  SELECT 1 FROM auth.users au 
  WHERE au.email = pu.email AND au.id != pu.id
);

-- PASO 3: Crear usuarios con IDs correctos
INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
SELECT au.id, au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1), 'Usuario'),
  COALESCE((SELECT role FROM public.users WHERE email = au.email LIMIT 1), 'user'),
  au.created_at, NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

COMMIT;`}</code>
                  </pre>
                </div>
              </div>
              
              <div className="text-center">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 text-white font-semibold py-3 px-4 rounded-xl border border-[#00b41d] transition-opacity duration-200"
                >
                  Recargar Página
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si hay usuario autenticado, mostrar el dashboard correspondiente
  if (user) {
    // Si es supervisor o support, mostrar loading mientras redirige
    if (user.role === 'supervisor' || user.role === 'support') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <span className="animate-spin inline-block h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-4">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            </span>
            <p className="text-gray-600 dark:text-gray-400">Redirigiendo...</p>
          </div>
        </div>
      );
    }
    // Si es usuario normal, mostrar su dashboard
    return (
      <ProtectedRoute requiredRole="user">
        <Dashboard />
      </ProtectedRoute>
    );
  }

  // Si no hay usuario pero tampoco está cargando, mostrar el formulario de login
  // (esto puede pasar si el perfil no se pudo cargar)
  return <AuthContainer />;
}
