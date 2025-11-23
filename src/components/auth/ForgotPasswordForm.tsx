  'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export default function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const { forgotPassword } = useAuth();

  // Contador regresivo para el tiempo de espera
  useEffect(() => {
    if (waitSeconds === null || waitSeconds <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setWaitSeconds((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [waitSeconds]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    if (waitSeconds !== null && waitSeconds > 0) {
      console.log('⏸️ Bloqueado: tiempo de espera activo', waitSeconds);
      return; // No permitir envío si hay tiempo de espera activo
    }

    setIsSubmitting(true);
    setError('root', { type: 'manual', message: '' }); // Limpiar errores previos
    setWaitSeconds(null); // Limpiar tiempo de espera previo
    
    try {
      const result = await forgotPassword(data.email);
      console.log('📧 Resultado de forgotPassword:', { 
        hasError: !!result.error, 
        waitSeconds: result.waitSeconds,
        errorMessage: result.error?.message 
      });
      
      if (result.error) {
        // Si hay tiempo de espera, establecerlo PRIMERO
        if (result.waitSeconds !== undefined && result.waitSeconds > 0) {
          console.log('⏱️ Estableciendo tiempo de espera:', result.waitSeconds);
          setWaitSeconds(result.waitSeconds);
        }
        
        setError('root', {
          type: 'manual',
          message: result.error instanceof Error ? result.error.message : 'Error desconocido',
        });
      } else {
        setIsSuccess(true);
        setWaitSeconds(null); // Limpiar tiempo de espera en caso de éxito
      }
    } catch (error: unknown) {
      console.error('❌ Error inesperado en recuperación de contraseña:', error);
      setError('root', {
        type: 'manual',
        message: 'Error inesperado al enviar email de recuperación',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Email Enviado
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Hemos enviado un enlace de recuperación a tu email. Revisa tu bandeja de entrada y sigue las instrucciones.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-black border border-[#00b41d] rounded-2xl shadow-card-soft p-8 text-white">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Recuperar Contraseña
          </h2>
          <p className="text-white/70">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-white/40" />
              </div>
              <input
                {...register('email')}
                type="email"
                id="email"
                placeholder="tu@email.com"
                className="block w-full pl-10 pr-3 py-3 border border-[#367640] rounded-xl bg-black text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00b41d] focus:border-transparent transition-colors"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Error Message */}
          {errors.root && (
            <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4">
              <p className="text-sm text-red-300 whitespace-pre-line">
                {errors.root.message}
              </p>
            </div>
          )}

          {/* Wait Time Message */}
          {waitSeconds !== null && waitSeconds > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-yellow-300">
                  Por seguridad, debes esperar <span className="font-bold">{waitSeconds}</span> segundo{waitSeconds !== 1 ? 's' : ''} antes de solicitar otro enlace.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || (waitSeconds !== null && waitSeconds > 0)}
            className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] border border-[#00b41d] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-2xl transition-opacity duration-200 flex items-center justify-center shadow-card-soft"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Enviando Email...
              </>
            ) : waitSeconds !== null && waitSeconds > 0 ? (
              <>
                <Clock className="animate-pulse -ml-1 mr-3 h-5 w-5" />
                Espera {waitSeconds}s...
              </>
            ) : (
              'Enviar Email de Recuperación'
            )}
          </button>

          {/* Back to Login */}
          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="inline-flex items-center text-sm text-[#00b41d] hover:text-[#00d951] font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
