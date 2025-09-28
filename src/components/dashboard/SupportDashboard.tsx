'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';

export default function SupportDashboard() {
  const { user, logout } = useAuth();
  const { tickets, loading } = useTickets();

  // Calcular estadísticas de tickets
  const ticketStats = [
    { name: 'En espera', value: tickets.filter(t => t.status === 'pending').length },
    { name: 'En curso', value: tickets.filter(t => t.status === 'in_progress').length },
    { name: 'Resuelto', value: tickets.filter(t => t.status === 'resolved').length },
  ];

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    TicketFast - Soporte
                  </h1>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.full_name || user?.email || 'Soporte Técnico'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role || 'Administrador'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Panel de Soporte
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Vista de tickets y métricas del equipo de soporte
          </p>
        </div>

      {/* Gráfico de Torta */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Estado de Tickets
        </h2>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={ticketStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {ticketStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lista y Detalle estilo WhatsApp */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:col-span-1">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Tickets ({tickets.length})
          </h2>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Cargando tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No hay tickets disponibles</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Ticket #{ticket.id.slice(-6)}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {ticket.status === 'pending' ? 'Pendiente' :
                       ticket.status === 'in_progress' ? 'En curso' : 'Resuelto'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {ticket.description.length > 50 
                      ? `${ticket.description.substring(0, 50)}...` 
                      : ticket.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{ticket.tags.join(', ')}</span>
                    {ticket.is_urgent && (
                      <span className="text-red-600 font-medium">⚠️ Urgente</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Detalle del Ticket
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Selecciona un ticket de la lista para ver más información.
          </p>
          <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <p className="text-gray-900 dark:text-white">
              Aquí aparecerán los detalles, estado y comentarios del ticket seleccionado.
            </p>
          </div>
        </main>
      </div>
      </main>
    </div>
  );
}
