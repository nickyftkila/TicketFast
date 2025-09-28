'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'support';
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Si no hay usuario autenticado, redirigir al login
      if (!user) {
        router.push(redirectTo);
        return;
      }

      // Si se requiere un rol específico y el usuario no lo tiene
      if (requiredRole && user.role !== requiredRole) {
        // Redirigir según el rol del usuario
        if (user.role === 'user') {
          router.push('/');
        } else if (user.role === 'support') {
          router.push('/tickets');
        }
        return;
      }
    }
  }, [user, loading, requiredRole, redirectTo, router]);

  // Mostrar loading mientras se verifica la autenticación
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
          <p className="text-gray-600 dark:text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario o no tiene el rol requerido, no mostrar nada (se redirigirá)
  if (!user || (requiredRole && user.role !== requiredRole)) {
    return null;
  }

  // Si todo está bien, mostrar el contenido
  return <>{children}</>;
}
