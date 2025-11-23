import * as XLSX from 'xlsx';
import { SupportMetrics, TicketWithMetrics } from '@/hooks/useSupervisorMetrics';

/**
 * Formatea el tiempo en horas a un string legible
 */
function formatTime(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)} minutos`;
  if (hours < 24) return `${hours.toFixed(2)} horas`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days} días ${remainingHours.toFixed(2)} horas`;
}

/**
 * Exporta métricas de soporte a Excel
 */
export function exportMetricsToExcel(
  metrics: SupportMetrics[],
  tickets: TicketWithMetrics[],
  filename: string = `metricas-soporte-${new Date().toISOString().split('T')[0]}.xlsx`
) {
  // =====================================================
  // HOJA 1: Resumen de Métricas por Soporte
  // =====================================================
  const summaryData = metrics.map((metric) => ({
    'Nombre del Soporte': metric.supportName,
    'Email': metric.supportEmail,
    'Tickets Resueltos Hoy': metric.ticketsResolvedToday,
    'Tickets Resueltos Esta Semana': metric.ticketsResolvedThisWeek,
    'Tickets Resueltos Este Mes': metric.ticketsResolvedThisMonth,
    'Total Tickets Resueltos': metric.totalTicketsResolved,
    'SLA Promedio (horas)': metric.averageResolutionTime,
    'SLA Promedio (formato)': formatTime(metric.averageResolutionTime),
    'Tickets Pendientes': metric.pendingTickets,
  }));

  // Agregar fila de totales
  const totals = {
    'Nombre del Soporte': 'TOTALES',
    'Email': '',
    'Tickets Resueltos Hoy': metrics.reduce((sum, m) => sum + m.ticketsResolvedToday, 0),
    'Tickets Resueltos Esta Semana': metrics.reduce((sum, m) => sum + m.ticketsResolvedThisWeek, 0),
    'Tickets Resueltos Este Mes': metrics.reduce((sum, m) => sum + m.ticketsResolvedThisMonth, 0),
    'Total Tickets Resueltos': metrics.reduce((sum, m) => sum + m.totalTicketsResolved, 0),
    'SLA Promedio (horas)': metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.averageResolutionTime, 0) / metrics.length
      : 0,
    'SLA Promedio (formato)': formatTime(
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.averageResolutionTime, 0) / metrics.length
        : null
    ),
    'Tickets Pendientes': metrics.reduce((sum, m) => sum + m.pendingTickets, 0),
  };

  summaryData.push(totals);

  // =====================================================
  // HOJA 2: Detalle de Tickets
  // =====================================================
  const ticketsData = tickets.map((ticket) => ({
    'ID Ticket': ticket.id,
    'Descripción': ticket.description.substring(0, 100) + (ticket.description.length > 100 ? '...' : ''),
    'Estado': ticket.status === 'pending' ? 'Pendiente' : ticket.status === 'in_progress' ? 'En Progreso' : 'Resuelto',
    'Creado Por': ticket.created_by_name || 'N/A',
    'Fecha de Creación': ticket.created_at ? new Date(ticket.created_at).toLocaleString('es-ES') : 'N/A',
    'Resuelto Por': ticket.resolved_by_name || 'N/A',
    'Fecha de Resolución': ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString('es-ES') : 'N/A',
    'Tiempo de Resolución (horas)': ticket.resolution_time_hours || 'N/A',
    'Tiempo de Resolución (formato)': formatTime(ticket.resolution_time_hours),
    'Etiquetas': ticket.tags.join(', ') || 'Sin etiquetas',
    'Urgente': ticket.is_urgent ? 'Sí' : 'No',
  }));

  // =====================================================
  // HOJA 3: Estadísticas Agregadas
  // =====================================================
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved');
  const pendingTickets = tickets.filter((t) => t.status === 'pending');
  const inProgressTickets = tickets.filter((t) => t.status === 'in_progress');

  const resolutionTimes = resolvedTickets
    .map((t) => t.resolution_time_hours)
    .filter((t): t is number => t !== null);

  const statsData = [
    { 'Métrica': 'Total de Tickets', 'Valor': tickets.length },
    { 'Métrica': 'Tickets Resueltos', 'Valor': resolvedTickets.length },
    { 'Métrica': 'Tickets Pendientes', 'Valor': pendingTickets.length },
    { 'Métrica': 'Tickets En Progreso', 'Valor': inProgressTickets.length },
    { 'Métrica': 'Tasa de Resolución (%)', 'Valor': tickets.length > 0 ? ((resolvedTickets.length / tickets.length) * 100).toFixed(2) : '0' },
    { 'Métrica': 'Tiempo Promedio de Resolución (horas)', 'Valor': resolutionTimes.length > 0
      ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(2)
      : '0' },
    { 'Métrica': 'Tiempo Promedio de Resolución (formato)', 'Valor': formatTime(
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null
    ) },
    { 'Métrica': 'Tiempo Mínimo de Resolución (horas)', 'Valor': resolutionTimes.length > 0 ? Math.min(...resolutionTimes).toFixed(2) : '0' },
    { 'Métrica': 'Tiempo Máximo de Resolución (horas)', 'Valor': resolutionTimes.length > 0 ? Math.max(...resolutionTimes).toFixed(2) : '0' },
    { 'Métrica': 'Total Miembros de Soporte', 'Valor': metrics.length },
    { 'Métrica': 'Fecha de Exportación', 'Valor': new Date().toLocaleString('es-ES') },
  ];

  // =====================================================
  // CREAR WORKBOOK Y AGREGAR HOJAS
  // =====================================================
  const workbook = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen por Soporte');

  // Hoja 2: Detalle de Tickets
  const ticketsSheet = XLSX.utils.json_to_sheet(ticketsData);
  XLSX.utils.book_append_sheet(workbook, ticketsSheet, 'Detalle de Tickets');

  // Hoja 3: Estadísticas
  const statsSheet = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estadísticas');

  // =====================================================
  // AJUSTAR ANCHOS DE COLUMNAS
  // =====================================================
  // Resumen
  summarySheet['!cols'] = [
    { wch: 25 }, // Nombre del Soporte
    { wch: 30 }, // Email
    { wch: 20 }, // Tickets Resueltos Hoy
    { wch: 25 }, // Tickets Resueltos Esta Semana
    { wch: 25 }, // Tickets Resueltos Este Mes
    { wch: 20 }, // Total Tickets Resueltos
    { wch: 20 }, // SLA Promedio (horas)
    { wch: 25 }, // SLA Promedio (formato)
    { wch: 18 }, // Tickets Pendientes
  ];

  // Detalle de Tickets
  ticketsSheet['!cols'] = [
    { wch: 36 }, // ID Ticket
    { wch: 50 }, // Descripción
    { wch: 15 }, // Estado
    { wch: 20 }, // Creado Por
    { wch: 20 }, // Fecha de Creación
    { wch: 20 }, // Resuelto Por
    { wch: 20 }, // Fecha de Resolución
    { wch: 25 }, // Tiempo de Resolución (horas)
    { wch: 30 }, // Tiempo de Resolución (formato)
    { wch: 30 }, // Etiquetas
    { wch: 10 }, // Urgente
  ];

  // Estadísticas
  statsSheet['!cols'] = [
    { wch: 40 }, // Métrica
    { wch: 20 }, // Valor
  ];

  // =====================================================
  // DESCARGAR ARCHIVO
  // =====================================================
  XLSX.writeFile(workbook, filename);
}

