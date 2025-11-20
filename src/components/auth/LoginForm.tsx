'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSwitchToForgotPassword: () => void;
}

export default function LoginForm({ onSwitchToForgotPassword }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    
    try {
      const { error } = await login(data.email, data.password);
      
      if (error) {
        setError('root', {
          type: 'manual',
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
      // Si no hay error, la redirección se maneja en el hook
    } catch (error: unknown) {
      console.error('Error inesperado al iniciar sesión:', error);
      setError('root', {
        type: 'manual',
        message: 'Error inesperado al iniciar sesión',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-black border border-[#00b41d] rounded-2xl shadow-card-soft p-4 sm:p-6 lg:p-8 text-white">
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
            Iniciar Sesión
          </h2>
          <p className="text-sm sm:text-base text-white/75">
            Ingresa para continuar gestionando tus tickets
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-white/50" />
              </div>
              <input
                {...register('email')}
                type="email"
                id="email"
                placeholder="tu@email.com"
                className="block w-full pl-10 pr-3 py-3 border border-[#367640] rounded-xl bg-black text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] hover:border-[#00b41d]/80 transition-all duration-200"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-white/50" />
              </div>
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
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
            {errors.password && (
              <p className="mt-1 text-sm text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-sm text-[#00b41d] hover:text-[#00d951] font-medium transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Error Message */}
          {errors.root && (
            <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4">
              <p className="text-sm text-red-300">
                {errors.root.message}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] border border-[#00b41d] hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,180,29,0.3)] disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center shadow-card-soft"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Iniciando Sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
