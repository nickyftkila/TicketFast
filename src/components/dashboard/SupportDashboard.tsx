'use client';

import { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useTickets, TicketWithUser, TicketResponseWithUser, PriorityLevel } from '@/hooks/useTickets';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
type TicketStatus = 'pending' | 'in_progress' | 'resolved';

import { 
  Ticket as TicketIcon, 
  LogOut, 
  User, 
  Clock, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  MessageSquare, 
  Send, 
  FileText,
  Tag,
  Image as ImageIcon,
  ChevronDown,
  PlayCircle
} from 'lucide-react';

export default function SupportDashboard() {
  const { user, logout, loggingOut } = useAuth();
  const { tickets, loading, updateTicketStatus, refreshTickets, fetchTicketResponses } = useTickets();
  const { addToast, ToastContainer } = useToast();

  const [selectedTicket, setSelectedTicket] = useState<TicketWithUser | null>(null);
  const [ticketResponses, setTicketResponses] = useState<TicketResponseWithUser[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [searchQuery] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [responseImage, setResponseImage] = useState<File | null>(null);
  const [responseImagePreview, setResponseImagePreview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const pending = tickets.filter(t => t.status === 'pending').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const urgent = tickets.filter(t => t.is_urgent).length;
    
    return { pending, inProgress, resolved, urgent, total: tickets.length };
  }, [tickets]);

  const ticketStats = [
    { name: 'En espera', value: stats.pending },
    { name: 'En curso', value: stats.inProgress },
    { name: 'Resuelto', value: stats.resolved },
  ];

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981'];

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    let filtered: TicketWithUser[] = tickets;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => {
        const matchesDescription = t.description.toLowerCase().includes(query);
        const matchesTags = t.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesName = t.users?.full_name?.toLowerCase().includes(query) ?? false;
        const matchesEmail = t.users?.email?.toLowerCase().includes(query) ?? false;
        return matchesDescription || matchesTags || matchesName || matchesEmail;
      });
    }

    return [...filtered].sort((a, b) => {
      const scoreDiff = (b.autoPriority?.score ?? 0) - (a.autoPriority?.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets, statusFilter, searchQuery]);

  // Limpiar ticket seleccionado si no está en la lista filtrada
  useEffect(() => {
    if (selectedTicket && !filteredTickets.find(t => t.id === selectedTicket.id)) {
      setSelectedTicket(null);
      setTicketResponses([]);
      setLoadingResponses(false);
    }
  }, [filteredTickets, selectedTicket]);

  // Actualizar ticket seleccionado cuando se actualiza la lista de tickets
  useEffect(() => {
    if (selectedTicket) {
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
    }
  }, [tickets, selectedTicket]);

  // Cargar detalles del ticket
  const handleTicketClick = async (ticket: TicketWithUser) => {
    setSelectedTicket(ticket);
    setLoadingResponses(true);
    try {
      const { data } = await fetchTicketResponses(ticket.id);
      setTicketResponses(data || []);
    } catch (error) {
      console.error('Error cargando respuestas:', error);
    } finally {
      setLoadingResponses(false);
    }
  };

  // Cambiar estado del ticket
  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    // Prevenir múltiples cambios simultáneos
    if (updatingStatus) return;

    // Si el estado es el mismo, no hacer nada
    if (selectedTicket?.status === newStatus) return;

    // Guardar el estado anterior para poder revertir si hay error
    const previousStatus = selectedTicket?.status;

    setUpdatingStatus(true);
    try {
      // Actualizar optimísticamente el estado local para feedback inmediato
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }

      const { error } = await updateTicketStatus(ticketId, newStatus);
      if (error) {
        // Revertir el cambio optimista si hay error
        if (selectedTicket?.id === ticketId && previousStatus) {
          setSelectedTicket({ ...selectedTicket, status: previousStatus });
        }
        throw error;
      }
      
      // Actualizar la lista de tickets (el efecto actualizará el ticket seleccionado automáticamente)
      await refreshTickets();
      
      addToast({
        type: 'success',
        title: 'Estado actualizado',
        message: `El ticket ha sido marcado como ${getStatusText(newStatus).toLowerCase()}`,
        duration: 3000
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el estado del ticket',
        duration: 4000
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Enviar respuesta
  const handleSendResponse = async () => {
    if (!selectedTicket || !responseMessage.trim()) return;

    setSendingResponse(true);
    try {
      let imageUrl = null;
      
      // Subir imagen si existe
      if (responseImage) {
        const fileExt = responseImage.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `ticket-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-images')
          .upload(filePath, responseImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ticket-images')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      // Crear respuesta
      const { error } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: selectedTicket.id,
          message: responseMessage.trim(),
          image_url: imageUrl,
          created_by: user?.id,
          is_support_response: true
        });

      if (error) throw error;

      // Actualizar lista de respuestas
      const { data } = await fetchTicketResponses(selectedTicket.id);
      setTicketResponses(data || []);

      // Limpiar formulario
      setResponseMessage('');
      setResponseImage(null);
      setResponseImagePreview(null);

      addToast({
        type: 'success',
        title: 'Respuesta enviada',
        message: 'Tu respuesta ha sido enviada correctamente',
        duration: 3000
      });
    } catch (error) {
      console.error('Error al enviar respuesta de soporte:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo enviar la respuesta',
        duration: 4000
      });
    } finally {
      setSendingResponse(false);
    }
  };

  // Manejar imagen de respuesta
  const handleResponseImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResponseImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setResponseImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Obtener color del estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  // Obtener icono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <PlayCircle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <TicketIcon className="h-4 w-4" />;
    }
  };

  // Obtener texto del estado
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Progreso';
      case 'resolved':
        return 'Resuelto';
      default:
        return status;
    }
  };
  const getPriorityLabel = (level: PriorityLevel) => {
    switch (level) {
      case 'high':
        return 'Prioridad Alta (automático)';
      case 'medium':
        return 'Prioridad Media (automático)';
      default:
        return 'Prioridad Baja (automático)';
    }
  };

  const getPriorityStyle = (level: PriorityLevel) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <TicketIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                TicketFast - Soporte
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px] lg:max-w-none">
                    {user?.full_name || user?.email || 'Soporte Técnico'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role || 'support'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={logout}
                disabled={loggingOut}
                className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Cerrando...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Cerrar Sesión</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Tickets List and Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Chart - Left Side */}
          <div className="lg:col-span-2 order-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3 text-center">
                Distribución de Estados
              </h2>
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Gráfico circular a la izquierda */}
                <div className="flex-shrink-0 w-28 sm:w-36 h-28 sm:h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ticketStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={isMobile ? 30 : 40}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {ticketStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Estados a la derecha */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                  {ticketStats.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        {entry.name} ({entry.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Search and Filters + Tickets List */}
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Filters */}
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === 'pending'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Pendientes
                  </button>
                  <button
                    onClick={() => setStatusFilter('in_progress')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === 'in_progress'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    En Progreso
                  </button>
                  <button
                    onClick={() => setStatusFilter('resolved')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === 'resolved'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Resueltos
                  </button>
                </div>
              </div>

              {/* Tickets List */}
              <div className="p-3 sm:p-4 max-h-[calc(100vh-350px)] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cargando tickets...</p>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <TicketIcon className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No se encontraron tickets' : 'No hay tickets disponibles'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTickets.map((ticket) => {
                      const priorityLevel = ticket.autoPriority?.level;
                      const priorityBorder =
                        priorityLevel === 'high'
                          ? 'border-red-400 dark:border-red-500'
                          : priorityLevel === 'medium'
                          ? 'border-yellow-400 dark:border-yellow-500'
                          : '';
                      return (
                        <button
                          key={ticket.id}
                          onClick={() => handleTicketClick(ticket)}
                          className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
                            selectedTicket?.id === ticket.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500'
                              : `bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 ${priorityBorder}`
                          }`}
                        >
                        {/* Header compacto */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {ticket.users?.full_name || 'Usuario'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ticket.is_urgent && (
                              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                              {getStatusIcon(ticket.status)}
                            </span>
                          </div>
                        </div>

                        {/* Descripción resumida */}
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {ticket.description}
                        </p>

                        {ticket.autoPriority && ticket.autoPriority.level !== 'low' && (
                          <div className={`mb-2 inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${getPriorityStyle(ticket.autoPriority.level)}`}>
                            {getPriorityLabel(ticket.autoPriority.level)}
                          </div>
                        )}

                        {/* Fecha y tag principal */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(ticket.created_at)}</span>
                          {ticket.tags.length > 0 && (
                            <span className="text-blue-600 dark:text-blue-400">
                              {ticket.tags[0]}
                            </span>
                          )}
                        </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Detail */}
          <main className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-[calc(100vh-120px)] flex flex-col overflow-hidden">
              {!selectedTicket ? (
                <div className="flex-1 flex items-center justify-center p-8 sm:p-12 text-center">
                  <div>
                    <TicketIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Selecciona un ticket
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                      Elige un ticket de la lista para ver sus detalles y responder
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Header compacto */}
                    <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                              Ticket #{selectedTicket.id.slice(-8)}
                            </h1>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                                {getStatusIcon(selectedTicket.status)}
                                <span className="ml-1.5">{getStatusText(selectedTicket.status)}</span>
                              </span>
                              {selectedTicket.is_urgent && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Urgente
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3" />
                              <span>{selectedTicket.users?.full_name || 'Usuario'}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(selectedTicket.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Change Dropdown */}
                        <div className="relative flex-shrink-0">
                          <select
                            value={selectedTicket.status}
                            onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as TicketStatus)}
                            disabled={updatingStatus}
                            className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="in_progress">En Progreso</option>
                            <option value="resolved">Resuelto</option>
                          </select>
                          {updatingStatus ? (
                            <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin pointer-events-none" />
                          ) : (
                            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description compacta */}
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Descripción
                      </h2>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
                          {selectedTicket.description}
                        </p>
                      </div>
                    </div>

                    {/* Tags compactos */}
                    {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Etiquetas
                        </h2>
                        <div className="flex flex-wrap gap-2">
                          {selectedTicket.tags.map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                              <Tag className="h-3 w-3 mr-1.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTicket.autoPriority && (
                      <div className={`space-y-2 p-3 rounded-lg border ${getPriorityStyle(selectedTicket.autoPriority.level)}`}>
                        <h2 className="text-sm font-semibold">
                          {getPriorityLabel(selectedTicket.autoPriority.level)}
                        </h2>
                        {selectedTicket.autoPriority.reasons.length > 0 && (
                          <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                            {selectedTicket.autoPriority.reasons.map(reason => (
                              <li key={reason}>• {reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Image compacta */}
                    {selectedTicket.image_url && (
                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Imagen adjunta
                        </h2>
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50">
                          <Image
                            src={selectedTicket.image_url}
                            alt="Imagen del ticket"
                            width={500}
                            height={300}
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {/* Conversation compacta */}
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Conversación
                      </h2>

                      {loadingResponses ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                        </div>
                      ) : ticketResponses.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                          <MessageSquare className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Aún no hay respuestas</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sé el primero en responder</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {ticketResponses.map((response) => (
                            <div
                              key={response.id}
                              className={`p-3 rounded-lg shadow-sm ${
                                response.is_support_response || response.users?.role === 'support'
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                  : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    response.is_support_response || response.users?.role === 'support'
                                      ? 'bg-blue-600 dark:bg-blue-500'
                                      : 'bg-gray-400 dark:bg-gray-600'
                                  }`}>
                                    <User className="h-3 w-3 text-white" />
                                  </div>
                                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                                    {response.is_support_response || response.users?.role === 'support'
                                      ? 'Soporte Técnico'
                                      : response.users?.full_name || 'Usuario'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(response.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words mb-2">
                                {response.message}
                              </p>
                              {response.image_url && (
                                <div className="mt-2 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
                                  <Image
                                    src={response.image_url}
                                    alt="Imagen de respuesta"
                                    width={250}
                                    height={150}
                                    className="w-full h-auto"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Form compacto */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                      <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Responder
                    </h3>
                    <div className="space-y-3">
                      <textarea
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                      />
                      
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          {responseImagePreview ? (
                            <div className="relative inline-block">
                              <div className="relative rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                                <Image
                                  src={responseImagePreview}
                                  alt="Preview"
                                  width={150}
                                  height={100}
                                  className="max-w-full h-auto"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  setResponseImage(null);
                                  setResponseImagePreview(null);
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center shadow-md transition-colors"
                              >
                                <span className="text-xs font-bold">×</span>
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                              <ImageIcon className="h-4 w-4 mr-1.5" />
                              <span className="text-sm font-medium">Adjuntar imagen</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleResponseImageChange}
                                className="hidden"
                                id="response-image"
                              />
                            </label>
                          )}
                        </div>

                        <button
                          onClick={handleSendResponse}
                          disabled={!responseMessage.trim() || sendingResponse}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md disabled:shadow-none flex items-center gap-1.5 min-w-[140px] justify-center"
                        >
                          {sendingResponse ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              <span>Enviar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
