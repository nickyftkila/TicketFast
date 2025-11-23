'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupervisorMetrics, SupportMetrics, TicketWithMetrics } from '@/hooks/useSupervisorMetrics';
import { useToast } from '@/components/ui/Toast';
import { exportMetricsToExcel } from '@/utils/excelExport';
import { 
  Ticket as TicketIcon, 
  LogOut, 
  User, 
  Loader2, 
  Download,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function SupervisorDashboard() {
  const { user, logout, loggingOut } = useAuth();
  const { metrics, tickets, loading, error, refreshMetrics } = useSupervisorMetrics();
  const { addToast, ToastContainer } = useToast();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [supportFilter, setSupportFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Filtrar por soporte
    if (supportFilter !== 'all') {
      filtered = filtered.filter(t => t.resolved_by === supportFilter);
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.created_by_name?.toLowerCase().includes(query) ||
        t.resolved_by_name?.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tickets, statusFilter, supportFilter, searchQuery]);

  // Preparar datos para gráficos
  const chartData = useMemo(() => {
    return metrics.map(m => ({
      name: m.supportName.split(' ')[0], // Solo primer nombre para el gráfico
      'Resueltos Hoy': m.ticketsResolvedToday,
      'Resueltos Esta Semana': m.ticketsResolvedThisWeek,
      'SLA Promedio (horas)': m.averageResolutionTime,
    }));
  }, [metrics]);

  const slaChartData = useMemo(() => {
    return metrics.map(m => ({
      name: m.supportName.split(' ')[0],
      'SLA (horas)': m.averageResolutionTime,
    }));
  }, [metrics]);

  const COLORS = ['#ffffff', '#f5f5f5', '#e0e0e0', '#d0d0d0', '#c0c0c0'];

  const handleExport = () => {
    try {
      exportMetricsToExcel(metrics, tickets);
      addToast({
        type: 'success',
        title: 'Exportación exitosa',
        message: 'Las métricas se han descargado correctamente',
        duration: 3000
      });
    } catch (error) {
      console.error('Error al exportar:', error);
      addToast({
        type: 'error',
        title: 'Error al exportar',
        message: 'No se pudo exportar las métricas',
        duration: 4000
      });
    }
  };

  const formatTime = (hours: number | null): string => {
    if (hours === null) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(1)}h`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatElapsedTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const getSlaStatusBadge = (slaStatus: 'ok' | 'warning' | 'exceeded', isUrgent: boolean) => {
    const maxTime = isUrgent ? '1h' : '30min';
    switch (slaStatus) {
      case 'ok':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-[#00b41d]/20 text-[#00b41d] border border-[#00b41d]/40">
            ✓ Dentro SLA
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/40">
            ⚠ Cerca límite ({maxTime})
          </span>
        );
      case 'exceeded':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-600/20 text-red-400 border border-red-600/40">
            ✗ Excedido ({maxTime})
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="page-shell overflow-hidden">
        <div className="page-safe-area min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#00b41d] mx-auto mb-4" />
            <p className="text-white/70">Cargando métricas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell overflow-hidden">
        <div className="page-safe-area min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-black border border-[#00b41d] rounded-2xl shadow-card-soft p-8 text-white">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Error</h2>
              <p className="text-white/70 mb-6">{error}</p>
              <button
                onClick={refreshMetrics}
                className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 text-white font-semibold py-3 px-4 rounded-xl border border-[#00b41d] transition-opacity duration-200"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell overflow-hidden">
      <header className="bg-black border-b border-[#367640]">
        <div className="page-safe-area py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-[#00b41d] flex-shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-white truncate">Dashboard de Supervisor</h1>
                {!isMobile && (
                  <p className="text-xs sm:text-sm text-white/70">Métricas y rendimiento del equipo</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {!isMobile && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 text-white text-sm sm:text-base font-semibold rounded-xl border border-[#00b41d] transition-opacity duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar a Excel</span>
                </button>
              )}
              {isMobile && (
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 border border-[#00b41d] transition-opacity duration-200"
                  title="Exportar a Excel"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={logout}
                disabled={loggingOut}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors disabled:opacity-60 hover:bg-[#00b41d]/20"
                title="Salir"
              >
                {loggingOut ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#00b41d]" />
                ) : (
                  <LogOut className="w-5 h-5 text-[#00b41d]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="page-safe-area safe-py space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Resumen General */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/70 truncate">Total Soportes</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{metrics.length}</p>
              </div>
              <User className="w-6 h-6 sm:w-8 sm:h-8 text-[#00b41d] flex-shrink-0" />
            </div>
          </div>
          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/70 truncate">Resueltos Hoy</p>
                <p className="text-lg sm:text-2xl font-bold text-white">
                  {metrics.reduce((sum, m) => sum + m.ticketsResolvedToday, 0)}
                </p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-[#00b41d] flex-shrink-0" />
            </div>
          </div>
          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/70 truncate">SLA Promedio</p>
                <p className="text-lg sm:text-2xl font-bold text-white">
                  {metrics.length > 0
                    ? formatTime(
                        metrics.reduce((sum, m) => sum + m.averageResolutionTime, 0) / metrics.length
                      )
                    : 'N/A'}
                </p>
              </div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-[#00b41d] flex-shrink-0" />
            </div>
          </div>
          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/70 truncate">Total Tickets</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{tickets.length}</p>
              </div>
              <TicketIcon className="w-6 h-6 sm:w-8 sm:h-8 text-[#00b41d] flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              Tickets Resueltos por Soporte
            </h3>
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 300}>
              <BarChart 
                data={chartData}
                margin={isMobile ? { top: 10, right: 5, left: -20, bottom: 5 } : { top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#367640" />
                <XAxis 
                  dataKey="name" 
                  stroke="#00b41d"
                  tick={{ fill: '#00b41d', fontSize: isMobile ? 10 : 12 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  height={isMobile ? 60 : 30}
                />
                <YAxis 
                  stroke="#00b41d"
                  tick={{ fill: '#00b41d', fontSize: isMobile ? 10 : 12 }}
                  width={isMobile ? 30 : 50}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    border: '1px solid #00b41d',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: isMobile ? '12px' : '14px',
                    padding: isMobile ? '8px' : '12px'
                  }} 
                />
                <Legend 
                  wrapperStyle={{ color: '#fff', fontSize: isMobile ? '11px' : '14px' }}
                  iconSize={isMobile ? 12 : 14}
                />
                <Bar dataKey="Resueltos Hoy" fill="#ffffff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resueltos Esta Semana" fill="#f5f5f5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              SLA Promedio por Soporte
            </h3>
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 300}>
              <BarChart 
                data={slaChartData}
                margin={isMobile ? { top: 10, right: 5, left: -20, bottom: 5 } : { top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#367640" />
                <XAxis 
                  dataKey="name" 
                  stroke="#00b41d"
                  tick={{ fill: '#00b41d', fontSize: isMobile ? 10 : 12 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  height={isMobile ? 60 : 30}
                />
                <YAxis 
                  stroke="#00b41d"
                  tick={{ fill: '#00b41d', fontSize: isMobile ? 10 : 12 }}
                  width={isMobile ? 30 : 50}
                />
                <Tooltip 
                  formatter={(value) => formatTime(value as number)}
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    border: '1px solid #00b41d',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: isMobile ? '12px' : '14px',
                    padding: isMobile ? '8px' : '12px'
                  }} 
                />
                <Bar dataKey="SLA (horas)" radius={[4, 4, 0, 0]}>
                  {slaChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla de Métricas por Soporte */}
        <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft">
          <div className="p-4 sm:p-6 border-b border-[#367640]">
            <h3 className="text-base sm:text-lg font-semibold text-white">
              Métricas por Miembro de Soporte
            </h3>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full">
              <thead className="bg-black/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Soporte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Resueltos Hoy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Resueltos Semana
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Resueltos Mes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Total Resueltos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    SLA Promedio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Pendientes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-[#367640]">
                {metrics.map((metric) => (
                  <tr key={metric.supportId} className="hover:bg-black/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {metric.supportName}
                        </div>
                        <div className="text-sm text-white/60">
                          {metric.supportEmail}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {metric.ticketsResolvedToday}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {metric.ticketsResolvedThisWeek}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {metric.ticketsResolvedThisMonth}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {metric.totalTicketsResolved}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatTime(metric.averageResolutionTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {metric.pendingTickets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filtros y Tabla de Tickets */}
        <div className="bg-black border border-[#367640] rounded-xl sm:rounded-2xl shadow-card-soft">
          <div className="p-4 sm:p-6 border-b border-[#367640]">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Detalle de Tickets
              </h3>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="flex-1 sm:flex-none px-3 py-2 text-sm sm:text-base border border-[#367640] rounded-xl bg-black text-white focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] min-h-[44px]"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="resolved">Resuelto</option>
                </select>
                <select
                  value={supportFilter}
                  onChange={(e) => setSupportFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-sm sm:text-base border border-[#367640] rounded-xl bg-black text-white focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] min-h-[44px]"
                >
                  <option value="all">Todos los soportes</option>
                  {metrics.map((m) => (
                    <option key={m.supportId} value={m.supportId}>
                      {m.supportName}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-sm sm:text-base border border-[#367640] rounded-xl bg-black text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00b41d]/50 focus:border-[#00b41d] min-h-[44px]"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead className="bg-black/50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Tiempo Transcurrido
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Creado Por
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Resuelto Por
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Tiempo de Resolución
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-[#367640]">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-white/60">
                      No hay tickets que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr 
                      key={ticket.id} 
                      className={`hover:bg-black/50 transition-colors ${
                        ticket.sla_status === 'exceeded' ? 'bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {ticket.id.substring(0, 8)}...
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {isMobile ? formatDate(ticket.created_at).split(' ')[0] : formatDate(ticket.created_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {formatElapsedTime(ticket.time_elapsed_minutes)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-white max-w-xs truncate">
                        {ticket.description}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            ticket.status === 'resolved'
                              ? 'bg-[#00b41d]/20 text-[#00b41d] border border-[#00b41d]/40'
                              : ticket.status === 'in_progress'
                              ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-600/40'
                              : 'bg-orange-900/20 text-orange-400 border border-orange-600/40'
                          }`}
                        >
                          {ticket.status === 'resolved'
                            ? 'Resuelto'
                            : ticket.status === 'in_progress'
                            ? 'En Progreso'
                            : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {isMobile ? (ticket.created_by_name?.split(' ')[0] || 'N/A') : (ticket.created_by_name || 'N/A')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {isMobile ? (ticket.resolved_by_name?.split(' ')[0] || 'N/A') : (ticket.resolved_by_name || 'N/A')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {formatTime(ticket.resolution_time_hours)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}

