'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';
import { LogOut, User, Ticket, AlertCircle, Tag, ChevronDown, X, FileText, Send, Clock, CheckCircle, Loader2, Filter, MessageSquare, ArrowLeft } from 'lucide-react';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/Toast';
// import ConnectionStatus from '@/components/ui/ConnectionStatus';

export default function Dashboard() {
  const { user, logout, loggingOut } = useAuth();
  const { 
    tickets,
    loading: ticketsLoading,
    createTicket, 
    uploadImage, 
    clearError,
    refreshTickets,
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketResponses, setTicketResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Filtrar tickets del usuario actual por estado
  const userTickets = useMemo(() => {
    if (!user || !tickets) return [];
    const filtered = tickets.filter(ticket => ticket.created_by === user.id);
    if (statusFilter === 'all') return filtered;
    return filtered.filter(ticket => ticket.status === statusFilter);
  }, [tickets, user, statusFilter]);

  // Cargar respuestas cuando se selecciona un ticket
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
        return <Ticket className="h-4 w-4" />;
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
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
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
      console.log('📋 Creando ticket...');
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
      setImagePreview(null);

      console.log('🎉 ¡Ticket enviado exitosamente!');
      
      // Actualizar lista de tickets
      await refreshTickets();
      
      addToast({
        type: 'success',
        title: '¡Ticket enviado!',
        message: 'Tu solicitud ha sido enviada correctamente. Te contactaremos pronto.',
        duration: 5000
      });
      
      // Si hay un ticket seleccionado, actualizar sus respuestas también
      if (selectedTicket) {
        const { data } = await fetchTicketResponses(selectedTicket.id);
        setTicketResponses(data || []);
      }
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
      console.log('🔚 Finalizando proceso...');
      setIsSubmitting(false);
    }
  };

  // const handleLogout = async () => {
  //   // Simulación de logout - reemplazar con tu lógica
  //   console.log('🚪 Logout simulado');
  //   alert('Logout simulado - Supabase eliminado');
  // };

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
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    TicketFast
                  </h1>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.full_name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role || 'Usuario'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={logout}
                disabled={loggingOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Ticket - Columna Izquierda (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tags - Takes 1/3 of the space (LEFT) */}
              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="inline h-4 w-4 mr-2" />
                  Selecciona etiquetas
                </label>
                
                {/* Custom Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center justify-between"
                  >
                    <span className={selectedTags.length === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}>
                      {selectedTags.length === 0 ? 'Seleccionar etiquetas...' : `${selectedTags.length} seleccionadas`}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showTagDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <label
                          key={tag}
                          className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => handleTagToggle(tag)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{tag}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Tags Display */}
                {selectedTags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Etiquetas seleccionadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botón Enviar Ticket - Más sutil, al nivel de la imagen */}
                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm"
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
              <div className="lg:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="inline h-4 w-4 mr-2" />
                  Describe el problema
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Explica detalladamente qué problema estás experimentando..."
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  required
                />

                {/* Image Upload and Urgency Row */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Image Upload - Columna izquierda (2/3 del espacio) */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="inline-flex items-center px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Seleccionar archivo
                        </label>
                      </div>
                    ) : (
                      /* Preview de imagen - solo cuando hay archivo seleccionado */
                      <div className="space-y-2">
                        {/* Nombre del archivo con botón X superpuesto */}
                        <div className="relative inline-block">
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 pr-8">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
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
                        
                        {/* Preview de la imagen */}
                        {imagePreview && (
                          <div className="relative">
                            <Image
                              src={imagePreview}
                              alt="Preview"
                              width={200}
                              height={150}
                              className="max-w-full h-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-600 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Urgency Section - Columna derecha (1/3 del espacio) */}
                  <div className="lg:col-span-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        ¿Es urgente?
                      </span>
                    </div>
                    <div className="ml-6">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isUrgent}
                          onChange={(e) => setIsUrgent(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Marcar como prioritario
                        </span>
                      </label>
                      {isUrgent && (
                        <p className="mt-2 text-sm text-orange-600 dark:text-orange-400 font-medium">
                          ⚠️ Este ticket será marcado como prioritario
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>






          </form>
            </div>
          </div>

          {/* Mis Tickets - Columna Derecha (1/3) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-4">
              {!selectedTicket ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <Ticket className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Mis Tickets
                    </h3>
                    {userTickets.length > 0 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {userTickets.length}
                      </span>
                    )}
                  </div>

                  {/* Filtro por estado */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Filter className="inline h-3 w-3 mr-1" />
                      Filtrar por estado
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          statusFilter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('pending')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          statusFilter === 'pending'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Pendientes
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('in_progress')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          statusFilter === 'in_progress'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        En Progreso
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('resolved')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          statusFilter === 'resolved'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Resueltos
                      </button>
                    </div>
                  </div>

                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : userTickets.length === 0 ? (
                    <div className="text-center py-8">
                      <Ticket className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {statusFilter === 'all' 
                          ? 'No has enviado tickets aún'
                          : `No tienes tickets ${getStatusText(statusFilter).toLowerCase()}`
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                      {userTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => handleTicketClick(ticket)}
                          className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
                        >
                      {/* Header del ticket */}
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(ticket.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Descripción */}
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                        {ticket.description}
                      </p>

                      {/* Tags */}
                      {ticket.tags && ticket.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ticket.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            >
                              {tag}
                            </span>
                          ))}
                          {ticket.tags.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              +{ticket.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                          {/* Indicador de imagen */}
                          {ticket.image_url && (
                            <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <FileText className="h-3 w-3 mr-1" />
                              Con imagen
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Vista de detalle del ticket */
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTicket(null);
                      setTicketResponses([]);
                    }}
                    className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a mis tickets
                  </button>

                  <div className="mb-4">
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Creado: {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>

                  {/* Descripción completa */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Tags */}
                  {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Etiquetas:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTicket.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Imagen si existe */}
                  {selectedTicket.image_url && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Imagen adjunta:</p>
                      <div className="relative">
                        <Image
                          src={selectedTicket.image_url}
                          alt="Imagen del ticket"
                          width={300}
                          height={200}
                          className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Historial de respuestas */}
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Historial de Conversación
                    </h4>

                    {loadingResponses ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                      </div>
                    ) : ticketResponses.length === 0 ? (
                      <div className="text-center py-4">
                        <MessageSquare className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Aún no hay respuestas del soporte
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {ticketResponses.map((response: any) => (
                          <div
                            key={response.id}
                            className={`p-3 rounded-lg ${
                              response.is_support_response || response.users?.role === 'support'
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-700/50 border-l-4 border-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {response.is_support_response || response.users?.role === 'support'
                                  ? 'Soporte'
                                  : response.users?.full_name || 'Usuario'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(response.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
