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
    <div className="min-h-screen flex">
             {/* Columna izquierda - Imagen */}
       <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden items-center justify-center">
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
          <div className="absolute top-40 right-20 w-16 h-16 bg-white rounded-full"></div>
          <div className="absolute bottom-20 left-20 w-12 h-12 bg-white rounded-full"></div>
          <div className="absolute bottom-40 right-10 w-24 h-24 bg-white rounded-full"></div>
        </div>
        
                 {/* Contenido con animación Lottie - Centrado */}
         <div className="relative z-10 flex flex-col justify-center items-center text-white px-12 text-center w-full">
           <div className="text-center max-w-md mx-auto">
                                      {/* Título "Ticket Fast" con diseño moderno */}
             <h1 className="text-6xl font-extrabold mb-4 leading-tight">
               <span className="text-blue-200 text-4xl font-semibold">Ticket</span>{' '}
               <span className="text-white drop-shadow-lg">Fast</span>
             </h1>
             <p className="text-2xl text-blue-100 mb-12 font-light">
               Gestión de tickets simplificada
             </p>
            
                         {/* Características destacadas - Horizontal */}
             <div className="space-y-6">
               {/* Gestión Simplificada */}
               <div className="flex items-center space-x-4">
                 <div className="relative">
                   {/* Icono de Ticket */}
                   <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                     <div className="relative">
                       <div className="w-10 h-6 bg-white/90 rounded shadow-lg transform rotate-3 relative">
                         <div className="absolute top-1/2 left-1 right-1 h-0.5 bg-blue-600/30"></div>
                         <div className="absolute -left-0.5 top-1/2 w-1 h-1 bg-blue-600 rounded-full transform -translate-y-1/2"></div>
                         <div className="absolute -right-0.5 top-1/2 w-1 h-1 bg-blue-600 rounded-full transform -translate-y-1/2"></div>
                       </div>
                     </div>
                   </div>
                 </div>
                 <div className="flex-1 text-left">
                   <h3 className="font-semibold text-lg text-white mb-1">Gestión Simplificada</h3>
                   <p className="text-blue-100 text-sm">Organiza y rastrea todos tus tickets en un solo lugar</p>
                 </div>
               </div>
               
               {/* Respuesta Rápida */}
               <div className="flex items-center space-x-4">
                 <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                   <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                 </div>
                 <div className="flex-1 text-left">
                   <h3 className="font-semibold text-lg text-white mb-1">Respuesta Rápida</h3>
                   <p className="text-blue-100 text-sm">Resuelve problemas de manera eficiente y oportuna</p>
                 </div>
               </div>
               
               {/* Seguimiento Completo */}
               <div className="flex items-center space-x-4">
                 <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                   <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <div className="flex-1 text-left">
                   <h3 className="font-semibold text-lg text-white mb-1">Seguimiento Completo</h3>
                   <p className="text-blue-100 text-sm">Mantén un registro detallado de cada ticket</p>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Columna derecha - Formulario */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Logo para móviles */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-white"
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              TicketFast
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona tus tickets de forma rápida y eficiente
            </p>
          </div>

          {/* Contenido dinámico basado en la vista actual */}
          <div className="transition-all duration-300 ease-in-out">
                         {currentView === 'login' && (
               <LoginForm
                 onSwitchToForgotPassword={switchToForgotPassword}
               />
             )}
             
             {currentView === 'forgot-password' && (
               <ForgotPasswordForm onSwitchToLogin={switchToLogin} />
             )}
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2024 TicketFast. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
