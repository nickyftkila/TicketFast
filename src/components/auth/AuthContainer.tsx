'use client';

import { useState } from 'react';
import LoginForm from './LoginForm';

import ForgotPasswordForm from './ForgotPasswordForm';


type AuthView = 'login' | 'forgot-password';

export default function AuthContainer() {
  const [currentView, setCurrentView] = useState<AuthView>('login');

  const switchToLogin = () => setCurrentView('login');
  const switchToForgotPassword = () => setCurrentView('forgot-password');

  return (
    <div className="page-shell overflow-hidden">
      <div className="page-safe-area h-screen flex flex-col justify-center">
        <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2 items-center">
          {/* Columna izquierda - hero responsivo */}
          <section
            className="hidden md:flex glass-panel p-4 sm:p-5 lg:p-6 relative overflow-hidden bg-black border border-black text-white shadow-card-soft"
            style={{ borderImage: 'none' }}
          >
            <div className="relative z-10 flex flex-col items-center text-center w-full space-y-4 sm:space-y-6 lg:space-y-8">
              <div>
                <p className="uppercase text-xs tracking-[0.35em] text-white/60 mb-2">
                  Plataforma integral
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-2">
                  <span className="font-semibold text-[#00b41d]">Ticket</span>{' '}
                  <span className="drop-shadow-lg">Fast</span>
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">
                  Gestión de tickets simplificada para cualquier equipo y dispositivo.
                </p>
              </div>

              <div className="w-full max-w-xl grid gap-3 sm:gap-4">
                {[
                  {
                    title: 'Gestión Simplificada',
                    description: 'Organiza y rastrea todos tus tickets en un solo lugar',
                    icon: (
                      <div className="w-14 h-14 bg-black border border-black rounded-2xl flex items-center justify-center">
                        <div className="w-10 h-6 bg-black border border-white/30 rounded shadow-lg relative">
                          <div className="absolute inset-x-2 top-1/2 h-0.5 bg-[#00b41d] -translate-y-1/2" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Respuesta Rápida',
                    description: 'Resuelve problemas de forma eficiente y oportuna',
                    icon: (
                      <div className="w-14 h-14 bg-black border border-black rounded-2xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#00b41d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    ),
                  },
                  {
                    title: 'Seguimiento Completo',
                    description: 'Mantén un registro detallado de cada ticket',
                    icon: (
                      <div className="w-14 h-14 bg-black border border-black rounded-2xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#00b41d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    ),
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-center gap-3 sm:gap-4 text-left bg-black border border-black rounded-2xl p-3 sm:p-4"
                  >
                    {feature.icon}
                    <div className="flex-1">
                      <h3 className="font-semibold text-base sm:text-lg text-white">{feature.title}</h3>
                      <p className="text-xs sm:text-sm text-white/70 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Columna derecha - formulario */}
          <section className="glass-panel p-4 sm:p-5 lg:p-6 border border-black bg-black text-white shadow-card-soft" style={{ borderImage: 'none' }}>
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00b41d] rounded-2xl mb-4">
                <svg
                  className="w-8 h-8 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">TicketFast</h1>
              <p className="text-white/70">
                Gestiona tus tickets de forma rápida y eficiente
              </p>
            </div>

            <div className="transition-all duration-300 ease-in-out">
              {currentView === 'login' && (
                <LoginForm onSwitchToForgotPassword={switchToForgotPassword} />
              )}

              {currentView === 'forgot-password' && (
                <ForgotPasswordForm onSwitchToLogin={switchToLogin} />
              )}
            </div>

            <div className="text-center mt-4 sm:mt-6">
              <p className="text-xs sm:text-sm text-white/60">
                © 2024 TicketFast. Todos los derechos reservados.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
