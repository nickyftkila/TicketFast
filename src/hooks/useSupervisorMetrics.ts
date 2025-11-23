'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { safeLog } from '@/utils/logger';

export interface SupportMetrics {
  supportId: string;
  supportName: string;
  supportEmail: string;
  ticketsResolvedToday: number;
  ticketsResolvedThisWeek: number;
  ticketsResolvedThisMonth: number;
  averageResolutionTime: number; // en horas
  totalTicketsResolved: number;
  pendingTickets: number;
}

export interface TicketWithMetrics {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolution_time_hours: number | null;
  created_by_name: string | null;
  tags: string[];
  is_urgent: boolean;
  time_elapsed_minutes: number; // Tiempo transcurrido desde creación (en minutos)
  sla_status: 'ok' | 'warning' | 'exceeded'; // Estado del SLA
}

export function useSupervisorMetrics() {
  const [metrics, setMetrics] = useState<SupportMetrics[]>([]);
  const [tickets, setTickets] = useState<TicketWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener todos los usuarios de soporte
      const { data: supportUsers, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'support');

      if (usersError) throw usersError;

      if (!supportUsers || supportUsers.length === 0) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      // Obtener todos los tickets resueltos
      const { data: allTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          description,
          status,
          created_at,
          resolved_at,
          resolved_by,
          tags,
          is_urgent,
          created_by,
          resolved_by_user:resolved_by (
            full_name,
            email
          ),
          created_by_user:created_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Calcular métricas por soporte
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const supportMetrics: SupportMetrics[] = supportUsers.map((support) => {
        const resolvedTickets = (allTickets || []).filter(
          (ticket: any) =>
            ticket.resolved_by === support.id && ticket.status === 'resolved'
        );

        const resolvedToday = resolvedTickets.filter((ticket: any) => {
          if (!ticket.resolved_at) return false;
          const resolvedDate = new Date(ticket.resolved_at);
          return resolvedDate >= today;
        });

        const resolvedThisWeek = resolvedTickets.filter((ticket: any) => {
          if (!ticket.resolved_at) return false;
          const resolvedDate = new Date(ticket.resolved_at);
          return resolvedDate >= weekAgo;
        });

        const resolvedThisMonth = resolvedTickets.filter((ticket: any) => {
          if (!ticket.resolved_at) return false;
          const resolvedDate = new Date(ticket.resolved_at);
          return resolvedDate >= monthAgo;
        });

        // Calcular tiempo promedio de resolución (en horas)
        const resolutionTimes = resolvedTickets
          .map((ticket: any) => {
            if (!ticket.resolved_at || !ticket.created_at) return null;
            const created = new Date(ticket.created_at);
            const resolved = new Date(ticket.resolved_at);
            return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // horas
          })
          .filter((time: number | null) => time !== null) as number[];

        const averageResolutionTime =
          resolutionTimes.length > 0
            ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
            : 0;

        // Contar tickets pendientes asignados (tickets en progreso por este soporte)
        const pendingTickets = (allTickets || []).filter(
          (ticket: any) =>
            ticket.status === 'in_progress' && ticket.resolved_by === support.id
        ).length;

        return {
          supportId: support.id,
          supportName: support.full_name,
          supportEmail: support.email,
          ticketsResolvedToday: resolvedToday.length,
          ticketsResolvedThisWeek: resolvedThisWeek.length,
          ticketsResolvedThisMonth: resolvedThisMonth.length,
          averageResolutionTime: Math.round(averageResolutionTime * 100) / 100, // 2 decimales
          totalTicketsResolved: resolvedTickets.length,
          pendingTickets,
        };
      });

      // Preparar tickets con métricas
      const ticketsWithMetrics: TicketWithMetrics[] = (allTickets || []).map(
        (ticket: any) => {
          let resolutionTimeHours: number | null = null;
          if (ticket.resolved_at && ticket.created_at) {
            const created = new Date(ticket.created_at);
            const resolved = new Date(ticket.resolved_at);
            resolutionTimeHours =
              (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
            resolutionTimeHours = Math.round(resolutionTimeHours * 100) / 100;
          }

          // Calcular tiempo transcurrido desde creación (en minutos)
          const created = new Date(ticket.created_at);
          const timeElapsedMinutes = Math.round(
            (now.getTime() - created.getTime()) / (1000 * 60)
          );

          // Calcular estado del SLA
          let slaStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
          if (ticket.is_urgent) {
            // Tickets urgentes: 0-45min ok, 45-60min warning, >60min exceeded
            if (timeElapsedMinutes > 60) {
              slaStatus = 'exceeded';
            } else if (timeElapsedMinutes > 45) {
              slaStatus = 'warning';
            }
          } else {
            // Tickets normales: 0-20min ok, 20-30min warning, >30min exceeded
            if (timeElapsedMinutes > 30) {
              slaStatus = 'exceeded';
            } else if (timeElapsedMinutes > 20) {
              slaStatus = 'warning';
            }
          }

          return {
            id: ticket.id,
            description: ticket.description,
            status: ticket.status,
            created_at: ticket.created_at,
            resolved_at: ticket.resolved_at,
            resolved_by: ticket.resolved_by,
            resolved_by_name: ticket.resolved_by_user?.full_name || null,
            resolution_time_hours: resolutionTimeHours,
            created_by_name: ticket.created_by_user?.full_name || null,
            tags: ticket.tags || [],
            is_urgent: ticket.is_urgent || false,
            time_elapsed_minutes: timeElapsedMinutes,
            sla_status: slaStatus,
          };
        }
      );

      setMetrics(supportMetrics);
      setTickets(ticketsWithMetrics);
      safeLog('✅ Métricas de supervisor cargadas', {
        supports: supportMetrics.length,
        tickets: ticketsWithMetrics.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al cargar métricas';
      safeLog('❌ Error al cargar métricas:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return {
    metrics,
    tickets,
    loading,
    error,
    refreshMetrics: fetchMetrics,
  };
}

