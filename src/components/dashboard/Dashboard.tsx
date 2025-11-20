'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTickets, TicketResponseWithUser, TicketWithUser, PriorityLevel } from '@/hooks/useTickets';
import { supabase } from '@/lib/supabase';
import { LogOut, User, Ticket as TicketIcon, AlertCircle, Tag, ChevronDown, X, FileText, Send, Clock, CheckCircle, Loader2, Filter, MessageSquare, ArrowLeft, PlayCircle } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/Toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
// import ConnectionStatus from '@/components/ui/ConnectionStatus';

export default function Dashboard() {
  const { user, logout, loggingOut } = useAuth();
  const { 
    tickets,
    loading: ticketsLoading,
    createTicket, 
    uploadImage, 
    clearError,
    fetchTicketResponses
  } = useTickets();
  const { addToast, ToastContainer } = useToast();
  
  // DEBUG: Log para ver qué datos llegan
  console.log('🔍 Dashboard - User:', user);
  console.log('🔍 Dashboard - User email:', user?.email);

  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<TicketWithUser | null>(null);
  const [ticketResponses, setTicketResponses] = useState<TicketResponseWithUser[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [showTicketsDrawer, setShowTicketsDrawer] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Refs para sincronizar alturas
  const formRef = useRef<HTMLDivElement>(null);
  const ticketsRef = useRef<HTMLDivElement>(null);

  // Sincronizar altura de "Mis Tickets" con el formulario
  useEffect(() => {
    if (!isDesktop) {
      if (ticketsRef.current) {
        ticketsRef.current.style.maxHeight = 'none';
      }
      return;
    }

    const syncHeights = () => {
      if (formRef.current && ticketsRef.current) {
        const formHeight = formRef.current.offsetHeight;
        ticketsRef.current.style.maxHeight = `${formHeight}px`;
      }
    };

    syncHeights();
    window.addEventListener('resize', syncHeights);

    const resizeObserver = new ResizeObserver(syncHeights);
    if (formRef.current) {
      resizeObserver.observe(formRef.current);
    }

    return () => {
      window.removeEventListener('resize', syncHeights);
      resizeObserver.disconnect();
    };
  }, [description, selectedTags, imageFile, isDesktop]);

  // Debug: Loggear cuando cambien las respuestas
  useEffect(() => {
    if (selectedTicket) {
      console.log('📋 Estado de respuestas:', {
        ticketId: selectedTicket.id,
        loading: loadingResponses,
        count: ticketResponses.length,
        responses: ticketResponses
      });
    }
  }, [ticketResponses, loadingResponses, selectedTicket]);

  useEffect(() => {
    if (isDesktop && showTicketsDrawer) {
      setShowTicketsDrawer(false);
    }
  }, [isDesktop, showTicketsDrawer]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!isDesktop && showTicketsDrawer) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [showTicketsDrawer, isDesktop]);

  // Filtrar tickets del usuario actual por estado
  const userTickets = useMemo(() => {
    if (!user || !tickets) return [];
    const filtered = tickets.filter(ticket => ticket.created_by === user.id);
    if (statusFilter === 'all') return filtered;
    return filtered.filter(ticket => ticket.status === statusFilter);
  }, [tickets, user, statusFilter]);

  // Cargar respuestas cuando se selecciona un ticket
  const handleTicketClick = async (ticket: TicketWithUser) => {
    setSelectedTicket(ticket);
    setLoadingResponses(true);
    setTicketResponses([]);
    try {
      console.log('🔍 [Dashboard] Cargando respuestas para ticket:', ticket.id);
      
      // Consulta directa sin join primero para verificar
      const { data: directData, error: directError } = await supabase
        .from('ticket_responses')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      
      console.log('📊 [Dashboard] Consulta directa:', { 
        count: directData?.length || 0, 
        data: directData, 
        error: directError 
      });
      
      if (directError) {
        console.error('❌ [Dashboard] Error en consulta directa:', directError);
        addToast({
          type: 'error',
          title: 'Error al cargar respuestas',
          message: directError.message || 'No se pudieron cargar las respuestas del ticket',
          duration: 5000
        });
        setTicketResponses([]);
        return;
      }
      
      // Si hay datos, intentar obtener la información del usuario
      if (directData && directData.length > 0) {
        console.log(`✅ [Dashboard] Se encontraron ${directData.length} respuestas`);

        const responses = (directData as TicketResponseWithUser[]) ?? [];
        const responsesWithUsers = await Promise.all(
          responses.map(async (response): Promise<TicketResponseWithUser> => {
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('full_name, email, role')
                .eq('id', response.created_by)
                .single();

              return {
                ...response,
                users: userData || null
              };
            } catch (err) {
              console.warn('⚠️ [Dashboard] No se pudo obtener usuario para respuesta:', response.id, err);
              return response;
            }
          })
        );
        
        console.log('📥 [Dashboard] Respuestas con usuarios:', responsesWithUsers);
        setTicketResponses(responsesWithUsers);
      } else {
        console.log('ℹ️ [Dashboard] No hay respuestas para este ticket');
        setTicketResponses([]);
      }
      
      // También intentar con el método original por si acaso
      const { data, error } = await fetchTicketResponses(ticket.id);
      if (!error && data && data.length > 0) {
        console.log('✅ [Dashboard] Método original también funcionó');
        setTicketResponses(data);
      }
    } catch (error) {
      console.error('💥 [Dashboard] Error cargando respuestas:', error);
      addToast({
        type: 'error',
        title: 'Error al cargar respuestas',
        message: error instanceof Error ? error.message : 'Error desconocido al cargar respuestas',
        duration: 5000
      });
      setTicketResponses([]);
    } finally {
      setLoadingResponses(false);
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

  // Etiquetas disponibles
  const availableTags = [
    'Impresora', 'Consulta Técnica', 'Recepción', 'Huesped', 
    'Sin WiFi', 'No Proyecta', 'Solicitud de Adaptador', 
    'Sin Internet', 'Cocina', 'Problemas con Notebook', 'Problemas POG'
  ];

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpiar errores previos
    setError(null);
    clearError();
    
    if (!description.trim()) {
      setError('Por favor, describe el problema');
      return;
    }

    if (selectedTags.length === 0) {
      setError('Por favor, selecciona al menos una etiqueta');
      return;
    }

    if (!user) {
      setError('Usuario no autenticado');
      return;
    }

    setIsSubmitting(true);
    console.log('🚀 Iniciando envío de ticket...');

    try {
      let imageUrl = null;
      
      // Subir imagen si existe
      if (imageFile) {
        console.log('📸 Subiendo imagen...');
        try {
          imageUrl = await uploadImage(imageFile);
          console.log('✅ Imagen subida exitosamente:', imageUrl);
        } catch (uploadError) {
          console.error('Error al subir imagen:', uploadError);
          throw uploadError; // Propagar el error para que se maneje en el catch principal
        }
      }

      // Crear ticket
      const { error } = await createTicket({
        description: description.trim(),
        tags: selectedTags,
        is_urgent: isUrgent,
        image_url: imageUrl || undefined,
        created_by: user.id,
      });

      if (error) {
        throw error;
      }

      // Limpiar formulario
      console.log('🧹 Limpiando formulario...');
      setDescription('');
      setSelectedTags([]);
      setIsUrgent(false);
      setImageFile(null);

      console.log('🎉 ¡Ticket enviado exitosamente!');
      
      // La lista ya se actualizó optimísticamente en el hook
      addToast({
        type: 'success',
        title: '¡Ticket enviado!',
        message: 'Tu solicitud ha sido enviada correctamente. Te contactaremos pronto.',
        duration: 5000
      });
    } catch (error: unknown) {
      console.error('💥 Error completo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error inesperado al enviar el ticket';
      setError(errorMessage);
      
      // Mostrar notificación de error
      addToast({
        type: 'error',
        title: 'Error al enviar ticket',
        message: errorMessage,
        duration: 6000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleLogout = async () => {
  //   // Simulación de logout - reemplazar con tu lógica
  //   console.log('🚪 Logout simulado');
  //   alert('Logout simulado - Supabase eliminado');
  // };

  const renderTicketsBody = () => {
    if (!selectedTicket) {
      return (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <TicketIcon className="h-5 w-5 mr-2 text-[#00b41d]" />
              Mis Tickets
            </h3>
            {userTickets.length > 0 && (
              <span className="text-sm text-white/60">
                {userTickets.length}
              </span>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-white mb-2">
              <Filter className="inline h-3 w-3 mr-1" />
              Filtrar por estado
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#00b41d] text-black border-[#00b41d]'
                    : 'bg-black text-white border-white/15 hover:border-white/40'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-black text-white border-white/15 hover:border-white/40'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-black text-white border-white/15 hover:border-white/40'
                }`}
              >
                En Progreso
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  statusFilter === 'resolved'
                    ? 'bg-green-500 text-black border-green-500'
                    : 'bg-black text-white border-white/15 hover:border-white/40'
                }`}
              >
                Resueltos
              </button>
            </div>
          </div>

          {ticketsLoading ? (
            <div className="flex items-center justify-center flex-1 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : userTickets.length === 0 ? (
            <div className="text-center flex-1 flex flex-col items-center justify-center py-8">
              <TicketIcon className="h-12 w-12 text-white/30 mx-auto mb-3" />
              <p className="text-sm text-white/60">
                {statusFilter === 'all' 
                  ? 'No has enviado tickets aún'
                  : `No tienes tickets ${getStatusText(statusFilter).toLowerCase()}`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-0 subtle-scroll">
              {userTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => handleTicketClick(ticket)}
                  className="w-full text-left border border-white/10 rounded-2xl p-4 bg-black hover:border-[#00b41d]/80 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1">{getStatusText(ticket.status)}</span>
                        </span>
                        {ticket.is_urgent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Urgente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60">
                        {formatDate(ticket.created_at)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-white/80 line-clamp-2 mb-2">
                    {ticket.description}
                  </p>

                  {ticket.tags && ticket.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ticket.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-blue-500/40 text-blue-200 bg-blue-500/10"
                        >
                          {tag}
                        </span>
                      ))}
                      {ticket.tags.length > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-white/15 text-white/70">
                          +{ticket.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {ticket.autoPriority && ticket.autoPriority.level !== 'low' && (
                    <div
                      className={`mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${getPriorityStyle(ticket.autoPriority.level)}`}
                    >
                      {getPriorityLabel(ticket.autoPriority.level)}
                    </div>
                  )}

                  {ticket.image_url && (
                    <div className="mt-2 flex items-center text-xs text-white/60">
                      <FileText className="h-3 w-3 mr-1" />
                      Con imagen
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0 overflow-y-auto pr-2 subtle-scroll">
        <button
          type="button"
          onClick={() => {
            setSelectedTicket(null);
            setTicketResponses([]);
          }}
          className="flex items-center text-sm text-white/70 hover:text-white mb-4 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a mis tickets
        </button>

        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
              {getStatusIcon(selectedTicket.status)}
              <span className="ml-1">{getStatusText(selectedTicket.status)}</span>
            </span>
            {selectedTicket.is_urgent && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Urgente
              </span>
            )}
          </div>
          <p className="text-xs text-white/60 mb-3">
            Creado: {formatDate(selectedTicket.created_at)}
          </p>
        </div>

        <div className="mb-4 p-3 bg-white/5 rounded-2xl border border-white/15 flex-shrink-0 shadow-inner">
          <p className="text-sm font-medium text-white mb-2">Descripción:</p>
          <p className="text-sm text-white/85 whitespace-pre-wrap">
            {selectedTicket.description}
          </p>
        </div>

        {selectedTicket.tags && selectedTicket.tags.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <p className="text-xs font-medium text-white mb-2">Etiquetas:</p>
            <div className="flex flex-wrap gap-2">
              {selectedTicket.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border border-white/15 text-white bg-white/5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedTicket.autoPriority && (
          <div
            className={`mb-4 p-3 rounded-2xl border ${getPriorityStyle(selectedTicket.autoPriority.level)} bg-white/5`}
          >
            <p className="text-sm font-semibold text-white">{getPriorityLabel(selectedTicket.autoPriority.level)}</p>
            {selectedTicket.autoPriority.reasons.length > 0 && (
              <ul className="mt-2 text-xs text-white/75 space-y-1">
                {selectedTicket.autoPriority.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedTicket.image_url && (
          <div className="mb-4 flex-shrink-0">
            <p className="text-xs font-medium text-white mb-2">Imagen adjunta:</p>
            <div className="relative rounded-2xl border border-white/10 overflow-hidden">
              <Image
                src={selectedTicket.image_url}
                alt="Imagen del ticket"
                width={300}
                height={200}
                className="max-w-full h-auto"
              />
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Historial de Conversación
            </h4>
            {ticketResponses.length > 0 && (
              <span className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded-full border border-white/15">
                {ticketResponses.length} {ticketResponses.length === 1 ? 'respuesta' : 'respuestas'}
              </span>
            )}
          </div>

          {loadingResponses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : ticketResponses.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-white/30 mx-auto mb-2" />
              <p className="text-xs text-white/60 mb-1">
                Aún no hay respuestas del soporte
              </p>
              <p className="text-xs text-white/40">
                El equipo de soporte responderá pronto
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ticketResponses.map((response, index) => (
                <div
                  key={response.id || index}
                  className={`p-3 rounded-2xl border ${
                    response.is_support_response || response.users?.role === 'support'
                      ? 'bg-blue-500/10 border-blue-500/40'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white">
                      {response.is_support_response || response.users?.role === 'support'
                        ? 'Soporte'
                        : response.users?.full_name || 'Usuario'}
                    </span>
                    <span className="text-xs text-white/60">
                      {formatDate(response.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {response.message || '(Sin mensaje)'}
                  </p>
                  {!response.message && (
                    <p className="text-xs text-white/50 italic mt-1">
                      Esta respuesta no tiene contenido de texto
                    </p>
                  )}
                  {response.image_url && (
                    <div className="mt-2 rounded-xl border border-white/15 overflow-hidden">
                      <Image
                        src={response.image_url}
                        alt="Imagen de respuesta"
                        width={200}
                        height={150}
                        className="max-w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell">
      <header className="bg-black border-b border-black">
        <div className="page-safe-area flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-black bg-[linear-gradient(90deg,#000000,#00b41d)]">
              <TicketIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">TicketFast</p>
              <p className="text-sm text-white/60">Panel de usuario</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-10 h-10 bg-black border border-[#00b41d]/40 rounded-full flex items-center justify-center shadow-sm">
                <User className="w-4 h-4 text-[#00b41d]" />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-white truncate max-w-[180px]">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-white/60">
                  {user?.role || 'Usuario'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              disabled={loggingOut}
              aria-label={loggingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black bg-black text-blue-100 shadow-sm hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-[#00b41d]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="page-safe-area safe-py space-y-6">
        {!isDesktop && (
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setShowTicketsDrawer(true)}
              className="w-full inline-flex items-center justify-between rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white shadow-card-soft"
            >
              <span>Ver mis tickets</span>
              <span className="inline-flex items-center gap-1 text-blue-400">
                {userTickets.length}
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </span>
            </button>
          </div>
        )}

        <div className="content-grid lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div
              ref={formRef}
              className="glass-panel panel-padding w-full bg-[#050505] border border-white/10"
              style={{ borderImage: 'none' }}
            >
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              ¡Bienvenido, {user?.full_name || user?.email || 'Usuario'}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Crea un nuevo ticket para solicitar soporte técnico
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                ❌ {error}
              </p>
            </div>
          )}

          {/* Ticket Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description and Tags Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Tags - Takes 1/3 of the space (LEFT) */}
              <div className="lg:col-span-1 flex flex-col">
                <label className="block text-sm font-medium text-white mb-2">
                  <Tag className="inline h-4 w-4 mr-2" />
                  Selecciona etiquetas
                </label>
                
                {/* Custom Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="w-full px-4 py-3 border border-white/15 rounded-2xl bg-[#0b0d10] text-white focus:outline-none focus:ring-2 focus:ring-[#00b41d]/70 focus:border-[#00b41d]/60 transition-colors flex items-center justify-between"
                  >
                    <span className={selectedTags.length === 0 ? 'text-white/70' : 'text-white'}>
                      {selectedTags.length === 0 ? 'Seleccionar etiquetas...' : `${selectedTags.length} seleccionadas`}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showTagDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-[#050607] border border-white/15 rounded-2xl shadow-2xl max-h-60 overflow-y-auto space-y-2 p-3">
                      {availableTags.map((tag) => (
                        <label
                          key={tag}
                          className="flex items-center px-3 py-2 rounded-xl cursor-pointer transition-all border border-transparent hover:border-[#00b41d]/40 bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => handleTagToggle(tag)}
                            className="h-4 w-4 text-[#00b41d] focus:ring-[#00b41d]/80 border-white/40 bg-transparent rounded mr-3"
                          />
                          <span className="text-sm font-medium text-white">{tag}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Tags Display */}
                {selectedTags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-white/70 mb-2">Etiquetas seleccionadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/20 text-white"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-white/70 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botón Enviar Ticket - solo escritorio (acompaña a etiquetas) */}
                <div className="hidden lg:block mt-auto pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-xl border border-[#00b41d] transition-opacity duration-200 flex items-center justify-center space-x-2 shadow-card-soft"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Enviar Ticket</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* Description - Takes 2/3 of the space (RIGHT) */}
              <div className="lg:col-span-2 flex flex-col">
                <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                  <FileText className="inline h-4 w-4 mr-2" />
                  Describe el problema
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Explica detalladamente qué problema estás experimentando..."
                  className="block w-full px-4 py-3 border border-white/12 rounded-2xl bg-[#050607] text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00b41d]/70 focus:border-[#00b41d]/60 transition-colors resize-none"
                  required
                />

                {/* Image Upload and Urgency Row */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Image Upload - Columna izquierda (2/3 del espacio) */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-white mb-2">
                      <FileText className="inline h-4 w-4 mr-2" />
                      Adjuntar imagen (opcional)
                    </label>
                    
                    {!imageFile ? (
                      /* Input de archivo - solo cuando no hay archivo seleccionado */
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          className="inline-flex items-center px-4 py-2 bg-[#0b0d10] text-white rounded-xl border border-white/15 cursor-pointer hover:border-[#00b41d]/50 transition-colors text-sm font-medium"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Seleccionar archivo
                        </label>
                      </div>
                    ) : (
                      /* Nombre del archivo con botón X - solo cuando hay archivo seleccionado */
                      <div className="relative inline-block">
                        <div className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 pr-8">
                          <span className="text-sm text-white font-medium">
                            {imageFile.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Urgency Section - Columna derecha (1/3 del espacio) */}
                  <div className="lg:col-span-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUrgent}
                        onChange={(e) => setIsUrgent(e.target.checked)}
                        className="h-4 w-4 rounded border-white/25 bg-transparent text-[#00b41d] focus:ring-[#00b41d]/70"
                      />
                      <span className="text-sm font-medium text-white">
                        ¿Es urgente?
                      </span>
                    </label>
                  </div>
                </div>

              </div>
            </div>
            {/* Botón Enviar Ticket - vista móvil/tablet (fluye después del formulario) */}
            <div className="lg:hidden mt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[linear-gradient(90deg,#000000,#00b41d)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-base font-semibold py-3 px-4 rounded-2xl border border-[#00b41d] transition-opacity duration-200 flex items-center justify-center space-x-2 shadow-card-soft"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Enviar Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
            </div>
          </div>

          {isDesktop && (
            <div className="lg:col-span-1">
              <div
                ref={ticketsRef}
                className="glass-panel panel-padding w-full flex flex-col overflow-hidden h-full bg-[#050505] border border-white/10"
                style={{ borderImage: 'none' }}
              >
                {renderTicketsBody()}
              </div>
            </div>
          )}
        </div>
      </main>

      {!isDesktop && showTicketsDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            onClick={() => setShowTicketsDrawer(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Cerrar panel de tickets"
          />
          <div className="relative z-10 ml-auto flex h-full w-full max-w-md flex-col bg-black border border-white/12 rounded-l-3xl shadow-card-soft">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <p className="font-semibold text-white">Mis Tickets</p>
                <p className="text-xs text-white/60">Gestiona tus solicitudes</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketsDrawer(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 subtle-scroll bg-black">
              {renderTicketsBody()}
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
