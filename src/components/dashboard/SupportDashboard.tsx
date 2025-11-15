'use client';

import { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';
import { useToast } from '@/components/ui/Toast';
import { Ticket, TicketResponse } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { 
  Ticket as TicketIcon, 
  LogOut, 
  User, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  MessageSquare, 
  Send, 
  FileText,
  Tag,
  Image as ImageIcon,
  ChevronDown
} from 'lucide-react';

export default function SupportDashboard() {
  const { user, logout, loggingOut } = useAuth();
  const { tickets, loading, updateTicketStatus, refreshTickets, fetchTicketResponses } = useTickets();
  const { addToast, ToastContainer } = useToast();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketResponses, setTicketResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    let filtered = tickets;

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (t as any).users?.full_name?.toLowerCase().includes(query) ||
        (t as any).users?.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
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
  }, [tickets]);

  // Cargar detalles del ticket
  const handleTicketClick = async (ticket: Ticket) => {
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
  const handleStatusChange = async (ticketId: string, newStatus: 'pending' | 'in_progress' | 'resolved') => {
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
        return <Loader2 className="h-4 w-4 animate-spin" />;
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
        {/* Header Section */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Panel de Soporte
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Gestiona y responde tickets de manera eficiente
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <TicketIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Pendientes</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.pending}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">En Progreso</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.inProgress}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 lg:p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Urgentes</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.urgent}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Distribución de Estados
          </h2>
          <div className="w-full h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={isMobile ? 50 : 80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ticketStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                  iconSize={isMobile ? 8 : 12}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tickets List and Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Tickets List */}
          <aside className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Search and Filters */}
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative mb-3 sm:mb-4">
                  <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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
              <div className="p-3 sm:p-4 max-h-[calc(100vh-400px)] sm:max-h-[calc(100vh-500px)] overflow-y-auto">
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
                    {filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket)}
                        className={`w-full text-left p-5 rounded-xl border-2 transition-all shadow-sm hover:shadow-md min-h-[160px] flex flex-col ${
                          selectedTicket?.id === ticket.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 shadow-md'
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {/* Header con usuario y estado */}
                        <div className="flex items-start justify-between mb-4 flex-shrink-0">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold text-gray-900 dark:text-white truncate mb-1">
                                  {(ticket as any).users?.full_name || 'Usuario'}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDate(ticket.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {ticket.is_urgent && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 whitespace-nowrap">
                                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                Urgente
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                              {getStatusIcon(ticket.status)}
                              <span className="ml-1.5">{getStatusText(ticket.status)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Descripción completa */}
                        <div className="mb-4 flex-1 min-h-[56px]">
                          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 break-words">
                            {ticket.description}
                          </p>
                        </div>

                        {/* Tags e indicadores */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600 flex-shrink-0 gap-2">
                          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                            {ticket.tags.slice(0, 2).map((tag, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <Tag className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                <span className="truncate max-w-[100px] sm:max-w-none">{tag}</span>
                              </span>
                            ))}
                            {ticket.tags.length > 2 && (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                +{ticket.tags.length - 2}
                              </span>
                            )}
                          </div>
                          {ticket.image_url && (
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                              <ImageIcon className="h-4 w-4 mr-1.5" />
                              <span className="hidden sm:inline">Imagen</span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Ticket Detail */}
          <main className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {!selectedTicket ? (
                <div className="p-8 sm:p-12 text-center">
                  <TicketIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Selecciona un ticket
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                    Elige un ticket de la lista para ver sus detalles y responder
                  </p>
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                          Ticket #{selectedTicket.id.slice(-8)}
                        </h2>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(selectedTicket.status)}`}>
                          {getStatusIcon(selectedTicket.status)}
                          <span className="ml-1">{getStatusText(selectedTicket.status)}</span>
                        </span>
                        {selectedTicket.is_urgent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 flex-shrink-0">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Urgente
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <span className="truncate">Por: {(selectedTicket as any).users?.full_name || 'Usuario'}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{formatDate(selectedTicket.created_at)}</span>
                      </div>
                    </div>

                    {/* Status Change Dropdown */}
                    <div className="relative w-full sm:w-auto flex-shrink-0">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as any)}
                        disabled={updatingStatus}
                        className="w-full sm:w-auto appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="in_progress">En Progreso</option>
                        <option value="resolved">Resuelto</option>
                      </select>
                      {updatingStatus ? (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin pointer-events-none" />
                      ) : (
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción</h3>
                    <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                        {selectedTicket.description}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Etiquetas</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTicket.tags.map((tag, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                            <Tag className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate max-w-[150px] sm:max-w-none">{tag}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  {selectedTicket.image_url && (
                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Imagen adjunta</h3>
                      <div className="relative">
                        <Image
                          src={selectedTicket.image_url}
                          alt="Imagen del ticket"
                          width={400}
                          height={300}
                          className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Conversation */}
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 flex items-center">
                      <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Conversación
                    </h3>

                    {loadingResponses ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                      </div>
                    ) : ticketResponses.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <MessageSquare className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Aún no hay respuestas</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto pr-2">
                        {ticketResponses.map((response: any) => (
                          <div
                            key={response.id}
                            className={`p-3 sm:p-4 rounded-lg ${
                              response.is_support_response || response.users?.role === 'support'
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-700/50 border-l-4 border-gray-400'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 mb-2">
                              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                {response.is_support_response || response.users?.role === 'support'
                                  ? 'Soporte'
                                  : response.users?.full_name || 'Usuario'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {formatDate(response.created_at)}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words mb-2">
                              {response.message}
                            </p>
                            {response.image_url && (
                              <div className="mt-2">
                                <Image
                                  src={response.image_url}
                                  alt="Imagen de respuesta"
                                  width={200}
                                  height={150}
                                  className="max-w-full h-auto rounded border border-gray-200 dark:border-gray-600"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Response Form */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Responder</h3>
                    <textarea
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      rows={3}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
                    />
                    
                    {responseImagePreview ? (
                      <div className="mb-3 relative inline-block">
                        <Image
                          src={responseImagePreview}
                          alt="Preview"
                          width={150}
                          height={100}
                          className="rounded-lg border border-gray-200 dark:border-gray-600 max-w-full"
                        />
                        <button
                          onClick={() => {
                            setResponseImage(null);
                            setResponseImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 w-6 h-6 flex items-center justify-center"
                        >
                          <span className="text-xs">×</span>
                        </button>
                      </div>
                    ) : (
                      <label className="inline-block mb-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleResponseImageChange}
                          className="hidden"
                          id="response-image"
                        />
                        <span className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm">
                          <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Adjuntar imagen
                        </span>
                      </label>
                    )}

                    <button
                      onClick={handleSendResponse}
                      disabled={!responseMessage.trim() || sendingResponse}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      {sendingResponse ? (
                        <>
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Enviar Respuesta</span>
                        </>
                      )}
                    </button>
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
