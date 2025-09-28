'use client';

import AuthContainer from '@/components/auth/AuthContainer';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/components/dashboard/Dashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function Home() {
  const { user, loading } = useAuth();

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

  // Si hay usuario autenticado, mostrar el dashboard protegido
  if (user) {
    return (
      <ProtectedRoute requiredRole="user">
        <Dashboard />
      </ProtectedRoute>
    );
  }

  // Si no hay usuario, mostrar el formulario de login
  return <AuthContainer />;
}
