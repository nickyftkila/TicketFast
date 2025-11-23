'use client';

import { useState, useEffect } from 'react';
import { supabase, Ticket, TicketResponse } from '@/lib/supabase';
import { safeLog } from '@/utils/logger';
import { logSecurityEvent } from '@/utils/securityLogger';

export type PriorityLevel = 'low' | 'medium' | 'high';

export interface AutoPriorityMetadata {
  score: number;
  level: PriorityLevel;
  reasons: string[];
}

export interface TicketUserInfo {
  full_name?: string | null;
  email?: string | null;
  role?: 'user' | 'support' | 'supervisor' | null;
}

export type TicketWithUser = Ticket & {
  users?: TicketUserInfo | null;
  autoPriority?: AutoPriorityMetadata;
};

export type TicketResponseWithUser = TicketResponse & {
  users?: TicketUserInfo | null;
};

const TAG_WEIGHTS: Record<string, number> = {
  'Recepción': 20,
  'recepción': 20,
  'recepcion': 20,
  'Huesped': 20,
  'huésped': 20,
  'huesped': 20,
  'Sin Internet': 20,
  'sin internet': 20,
  'No Proyecta': 20,
  'no proyecta': 20,
  'Cocina': 20,
  'cocina': 20,
  'Problemas con Notebook': 20,
  'problemas con notebook': 20,
  'Impresora': 20,
  'impresora': 20,
  'Sin WiFi': 20,
  'sin wifi': 20,
  'Consulta Técnica': 20,
  'consulta técnica': 20,
  'Solicitud de Adaptador': 20,
  'solicitud de adaptador': 20,
  'Problemas POG': 20,
  'problemas pog': 20,
};

const KEYWORD_RULES: { keywords: string[]; weight: number; reason: string }[] = [
  {
    keywords: ['sin internet', 'Sin Internet', 'no hay internet', 'wifi caído', 'wifi caido', 'wifi fuera', 'Sin WiFi', 'sin wifi'],
    weight: 60,
    reason: 'Reporte indica caída de internet',
  },
  {
    keywords: ['no proyecta', 'No Proyecta', 'proyector', 'pantalla negra'],
    weight: 40,
    reason: 'Problema con proyección detectado',
  },
  {
    keywords: ['huésped molesto', 'huésped esperando', 'huesped molesto', 'huesped esperando', 'Huesped molesto', 'Huesped esperando'],
    weight: 45,
    reason: 'Impacto directo en huésped',
  },
  {
    keywords: ['impresora', 'Impresora', 'no imprime', 'impresora detenida', 'impresora sin'],
    weight: 35,
    reason: 'Problema con impresora detectado',
  },
  {
    keywords: ['problemas con notebook', 'Problemas con Notebook', 'laptop', 'notebook', 'equipo no arranca'],
    weight: 30,
    reason: 'Reporte de notebook/pc con fallas',
  },
];

const COMBO_RULES: { matchAll: string[]; weight: number; reason: string }[] = [
  {
    matchAll: ['recepción', 'no funciona'],
    weight: 50,
    reason: 'Recepción sin sistema funcional',
  },
  {
    matchAll: ['recepcion', 'no funciona'],
    weight: 50,
    reason: 'Recepción sin sistema funcional',
  },
  {
    matchAll: ['recepción', 'caído'],
    weight: 50,
    reason: 'Recepción reporta sistema caído',
  },
  {
    matchAll: ['recepcion', 'caido'],
    weight: 50,
    reason: 'Recepción reporta sistema caído',
  },
  {
    matchAll: ['cocina', 'sin luz'],
    weight: 55,
    reason: 'Cocina sin energía',
  },
  {
    matchAll: ['cocina', 'sin gas'],
    weight: 55,
    reason: 'Cocina sin gas',
  },
];

const GENERAL_KEYWORDS: { keywords: string[]; weight: number; reason: string }[] = [
  { keywords: ['no funciona', 'no responde', 'caído', 'caido', 'bloqueado'], weight: 25, reason: 'Incidente crítico detectado' },
  { keywords: ['no arranca', 'sin acceso', 'error 500', 'error 404'], weight: 15, reason: 'Error técnico detectado' },
  { keywords: ['urgente', 'crítico', 'critico'], weight: 25, reason: 'Usuario marcó el incidente como crítico' },
];

function normalizeText(value?: string | string[] | null) {
  if (!value) return '';
  return Array.isArray(value) ? value.join(' ').toLowerCase() : value.toLowerCase();
}

function calculateAutoPriority(ticket: Ticket): AutoPriorityMetadata {
  const description = normalizeText(ticket.description);
  const tagsText = normalizeText(ticket.tags);
  const combinedText = `${description} ${tagsText}`;

  let score = 0;
  const reasons = new Set<string>();

  KEYWORD_RULES.forEach(rule => {
    if (rule.keywords.some(keyword => combinedText.includes(keyword))) {
      score += rule.weight;
      reasons.add(rule.reason);
    }
  });

  COMBO_RULES.forEach(rule => {
    const matchesAll = rule.matchAll.every(keyword => combinedText.includes(keyword));
    if (matchesAll) {
      score += rule.weight;
      reasons.add(rule.reason);
    }
  });

  Object.entries(TAG_WEIGHTS).forEach(([tag, weight]) => {
    if (ticket.tags?.some(ticketTag => ticketTag.toLowerCase() === tag)) {
      score += weight;
      reasons.add(`Etiqueta marcada: ${tag}`);
    }
  });

  GENERAL_KEYWORDS.forEach(rule => {
    if (rule.keywords.some(keyword => combinedText.includes(keyword))) {
      score += rule.weight;
      reasons.add(rule.reason);
    }
  });

  const clampedScore = Math.min(100, score);
  let level: PriorityLevel = 'low';
  if (clampedScore >= 70) {
    level = 'high';
  } else if (clampedScore >= 40) {
    level = 'medium';
  }

  return {
    score: clampedScore,
    level,
    reasons: Array.from(reasons),
  };
}

function attachAutoPriority(ticketsData: Ticket[] | null): TicketWithUser[] {
  if (!ticketsData) return [];
  return ticketsData.map((ticket) => ({
    ...(ticket as TicketWithUser),
    autoPriority: calculateAutoPriority(ticket),
  }));
}

// Función auxiliar para verificar sesión y RLS
const verifySessionAndRLS = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      safeLog('❌ [useTickets] Error al verificar sesión:', sessionError);
      return { valid: false, error: sessionError.message };
    }
    
    if (!session) {
      safeLog('⚠️ [useTickets] No hay sesión activa');
      return { valid: false, error: 'No hay sesión activa' };
    }
    
    safeLog('✅ [useTickets] Sesión verificada:', {
      userId: session.user.id,
      email: session.user.email,
      expiresAt: session.expires_at
    });
    
    // Verificar que el usuario existe en la tabla users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', session.user.id)
      .single();
    
    if (userError) {
      safeLog('⚠️ [useTickets] Usuario no encontrado en tabla users:', {
        error: userError.message,
        code: userError.code,
        userId: session.user.id
      });
      return { valid: false, error: `Usuario no encontrado: ${userError.message}` };
    }
    
    safeLog('✅ [useTickets] Usuario verificado en tabla users:', {
      userId: userData.id,
      email: userData.email,
      role: userData.role
    });
    
    return { valid: true, session, user: userData };
  } catch (error) {
    safeLog('❌ [useTickets] Error en verificación:', error);
    return { valid: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
};

export function useTickets(userProfile?: { id: string; role: string } | null) {
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      safeLog('🔄 [useTickets] Iniciando fetchTickets', {
        userProfile: userProfile ? { id: userProfile.id, role: userProfile.role } : null
      });
      
      // Verificar sesión activa antes de hacer la consulta
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        safeLog('⚠️ [useTickets] Error al obtener sesión:', {
          error: sessionError.message,
          code: sessionError.code
        });
        setTickets([]);
        setError('Error al verificar sesión. Por favor, inicia sesión nuevamente.');
        return;
      }
      
      if (!session) {
        safeLog('⚠️ [useTickets] No hay sesión activa');
        // No establecer error si userProfile es null, solo si hay userProfile pero no sesión
        if (userProfile) {
          setError('No hay sesión activa. Por favor, inicia sesión.');
        }
        setTickets([]);
        return;
      }

      safeLog('✅ [useTickets] Sesión activa encontrada', {
        userId: session.user.id,
        email: session.user.email
      });

      // SIMPLIFICADO: Solo consultar tickets, dejar que RLS haga TODO
      // NO consultar users, NO filtrar manualmente - RLS lo hace automáticamente
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      safeLog('📊 [useTickets] Resultado de consulta:', {
        count: data?.length || 0,
        userId: session.user.id,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null
      });

      if (error) {
        console.error('❌ [useTickets] Error completo:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          name: error.name
        });
        setError(error.message || error.code || 'Error al cargar tickets');
        setTickets([]);
        return;
      }

      if (data && data.length > 0) {
        safeLog(`✅ [useTickets] ${data.length} tickets encontrados`, {
          ticketIds: data.map(t => t.id),
          createdBy: data.map(t => t.created_by)
        });
        const ticketsWithPriority = attachAutoPriority(data);
        setTickets(ticketsWithPriority);
      } else {
        safeLog('⚠️ [useTickets] No se encontraron tickets', {
          userId: session.user.id,
          userProfile: userProfile ? { id: userProfile.id, role: userProfile.role } : null
        });
        
        // Verificar sesión y RLS cuando no se encuentran tickets
        const verification = await verifySessionAndRLS();
        if (!verification.valid) {
          safeLog('❌ [useTickets] Problema de autenticación detectado:', verification.error);
        } else {
          safeLog('✅ [useTickets] Autenticación OK, pero no hay tickets. Esto puede ser normal si el usuario no tiene tickets creados.');
        }
        
        setTickets([]);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      console.error('❌ [useTickets] Error:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData: {
    description: string;
    tags: string[];
    is_urgent: boolean;
    image_url?: string;
    created_by: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('tickets')
        .insert([{
          ...ticketData,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Actualizar la lista de tickets
      await fetchTickets();
      
      return { data, error: null };
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
      return { data: null, error: error instanceof Error ? error : new Error('Error desconocido') };
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    // Validar el archivo
    if (!file) {
      throw new Error('No se ha seleccionado ningún archivo');
    }

    // Validar el tamaño del archivo PRIMERO (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo permitido es 5MB');
    }

    // Validar que el archivo no esté vacío
    if (file.size === 0) {
      throw new Error('El archivo está vacío');
    }

    // Validar nombre de archivo seguro
    const originalFileName = file.name;
    const hasPathTraversal = originalFileName.includes('..') || 
                             originalFileName.includes('/') || 
                             originalFileName.includes('\\');
    const hasScriptTags = originalFileName.includes('<') || originalFileName.includes('>');
    const hasCommandInjection = originalFileName.includes(';') || 
                                originalFileName.includes('|') || 
                                originalFileName.includes('&') ||
                                originalFileName.includes('`') ||
                                originalFileName.includes('$');
    
    if (hasPathTraversal || hasScriptTags || hasCommandInjection) {
      logSecurityEvent('suspicious_file_upload', {
        userId: userProfile?.id,
        details: {
          fileName: originalFileName,
          reason: 'caracteres_peligrosos'
        }
      });
      throw new Error('Nombre de archivo no válido. El archivo contiene caracteres peligrosos.');
    }

    // Extraer extensión de forma segura
    const fileExt = originalFileName.split('.').pop()?.toLowerCase();
    if (!fileExt || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
      throw new Error('Extensión de archivo no permitida. Solo se permiten: jpg, jpeg, png, gif, webp');
    }

    // Validar el tipo MIME declarado
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      logSecurityEvent('suspicious_file_upload', {
        userId: userProfile?.id,
        details: {
          fileName: originalFileName,
          declaredMime: file.type,
          reason: 'tipo_mime_no_permitido'
        }
      });
      throw new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP)');
    }

    // Verificación adicional: leer los primeros bytes para validar el tipo real del archivo
    // Esto previene que archivos maliciosos se disfracen como imágenes
    // Optimizado: solo leer 4 bytes para la mayoría de formatos (más rápido)
    try {
      // Leer solo 4 bytes primero (suficiente para JPEG, PNG, GIF)
      const arrayBuffer = await file.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Verificar magic numbers (firmas de archivo) - optimizado para velocidad
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46; // GIF
      
      // Si no es JPEG, PNG o GIF, verificar WebP (requiere más bytes)
      let isWebP = false;
      if (!isJPEG && !isPNG && !isGIF) {
        const webpBuffer = await file.slice(0, 12).arrayBuffer();
        const webpBytes = new Uint8Array(webpBuffer);
        isWebP = webpBytes[0] === 0x52 && webpBytes[1] === 0x49 && webpBytes[2] === 0x46 && webpBytes[3] === 0x46 && 
                 webpBytes[8] === 0x57 && webpBytes[9] === 0x45 && webpBytes[10] === 0x42 && webpBytes[11] === 0x50;
      }
      
      if (!isJPEG && !isPNG && !isGIF && !isWebP) {
        logSecurityEvent('suspicious_file_upload', {
          userId: userProfile?.id,
          details: {
            fileName: originalFileName,
            declaredMime: file.type,
            reason: 'magic_number_no_coincide',
            magicBytes: Array.from(bytes.slice(0, 4))
          }
        });
        throw new Error('El archivo no es una imagen válida. El contenido del archivo no coincide con su tipo declarado.');
      }
    } catch (error) {
      // Si la verificación de magic numbers falla, registrar pero permitir si el tipo MIME es válido
      // (algunos navegadores pueden tener problemas con File.slice)
      if (error instanceof Error && error.message.includes('no es una imagen válida')) {
        throw error;
      }
      safeLog('⚠️ No se pudo verificar magic numbers, confiando en tipo MIME declarado');
    }

    // Generar nombre de archivo seguro (sin usar el nombre original)
    const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `ticket-images/${safeFileName}`;

    safeLog('📤 Iniciando subida de imagen:', { fileName: safeFileName, filePath, size: file.size, type: file.type });

    // Agregar timeout de 20 segundos (reducido para mejor UX)
    const uploadPromise = supabase.storage
      .from('ticket-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: La subida de imagen tardó demasiado. Por favor, intenta con una imagen más pequeña.'));
      }, 20000); // 20 segundos (reducido de 30)
    });

    let uploadResult;
    try {
      uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
    } catch (timeoutError) {
      console.error('⏱️ Timeout al subir imagen:', timeoutError);
      throw timeoutError;
    }

    const { data, error } = uploadResult;

    if (error) {
      console.error('❌ Error de Supabase Storage:', error);
      console.error('Detalles del error:', {
        message: error.message,
        statusCode: (error as { statusCode?: number }).statusCode,
        error: (error as { error?: unknown }).error
      });
      
      // Mensajes de error más descriptivos
      let errorMessage = 'Error al subir la imagen';
      if (error.message?.includes('new row violates row-level security policy')) {
        errorMessage = 'Error de permisos: No tienes permiso para subir imágenes. Verifica las políticas de storage.';
      } else if (error.message?.includes('Bucket not found')) {
        errorMessage = 'Error: El bucket de storage no existe. Contacta al administrador.';
      } else if (error.message?.includes('JWT')) {
        errorMessage = 'Error de autenticación: Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
      } else {
        errorMessage = `Error al subir la imagen: ${error.message || 'Error desconocido'}`;
      }
      
      throw new Error(errorMessage);
    }

    safeLog('✅ Imagen subida exitosamente');

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('ticket-images')
      .getPublicUrl(filePath);

    console.log('🔗 URL pública generada:', publicUrl);
    return publicUrl;
  };

  const updateTicketStatus = async (ticketId: string, status: 'pending' | 'in_progress' | 'resolved') => {
    try {
      setLoading(true);
      setError(null);

      // Validación de seguridad: verificar que el usuario tenga permisos
      // Aunque RLS protege, esta validación previene intentos no autorizados
      if (userProfile?.role !== 'support') {
        logSecurityEvent('unauthorized_status_update', {
          userId: userProfile?.id,
          details: {
            ticketId,
            attemptedStatus: status,
            userRole: userProfile?.role
          }
        });
        throw new Error('No tienes permisos para cambiar el estado de tickets. Solo el personal de soporte puede hacerlo.');
      }

      // Validar que el estado sea válido
      const validStatuses: Array<'pending' | 'in_progress' | 'resolved'> = ['pending', 'in_progress', 'resolved'];
      if (!validStatuses.includes(status)) {
        logSecurityEvent('invalid_status_update', {
          userId: userProfile?.id,
          details: {
            ticketId,
            attemptedStatus: status
          }
        });
        throw new Error(`Estado inválido: ${status}`);
      }

      // Si se está resolviendo el ticket, establecer resolved_by
      const updateData: { status: string; resolved_by?: string } = { status };
      if (status === 'resolved' && userProfile?.id) {
        updateData.resolved_by = userProfile.id;
      }

      const { data, error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        safeLog('❌ [useTickets] Error al actualizar estado del ticket:', {
          ticketId,
          newStatus: status,
          error: error.message,
          code: (error as any).code,
          httpStatus: (error as any).status,
          details: (error as any).details,
          hint: (error as any).hint
        });
        
        // Mensajes de error más descriptivos
        let errorMessage = error.message || 'Error al actualizar el estado del ticket';
        const httpStatus = (error as any).status;
        const errorCode = (error as any).code;
        
        if (httpStatus === 403 || errorCode === '42501') {
          errorMessage = 'No tienes permisos para actualizar este ticket. Verifica que tengas el rol de soporte y que las políticas RLS estén configuradas correctamente.';
        } else if (errorCode === '23503') {
          errorMessage = 'Error de referencia: El usuario o ticket no existe.';
        } else if (errorCode === '23505') {
          errorMessage = 'Conflicto: Ya existe un ticket con estos datos.';
        }
        
        throw new Error(errorMessage);
      }

      // Actualizar la lista de tickets
      await fetchTickets();
      
      return { data, error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al actualizar el estado del ticket';
      safeLog('❌ [useTickets] Error capturado en updateTicketStatus:', {
        error: errorMessage,
        ticketId,
        status
      });
      setError(errorMessage);
      return { data: null, error: error instanceof Error ? error : new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketResponses = async (ticketId: string) => {
    try {
      safeLog('🔍 fetchTicketResponses - Iniciando consulta para ticket:', ticketId);
      
      // Primero intentar con el join completo
      let { data, error } = await supabase
        .from('ticket_responses')
        .select(`
          *,
          users:created_by (
            full_name,
            email,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      console.log('📥 fetchTicketResponses - Resultado con join:', { data, error });

      // Si hay error con el join, intentar sin el join
      if (error) {
        console.warn('⚠️ Error con join, intentando sin join:', error);
        const { data: dataWithoutJoin, error: errorWithoutJoin } = await supabase
          .from('ticket_responses')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        console.log('📥 fetchTicketResponses - Resultado sin join:', { data: dataWithoutJoin, error: errorWithoutJoin });

        if (errorWithoutJoin) {
          console.error('❌ fetchTicketResponses - Error sin join:', errorWithoutJoin);
          throw errorWithoutJoin;
        }

        data = dataWithoutJoin;
        error = null;
      }

      if (error) {
        console.error('❌ fetchTicketResponses - Error de Supabase:', error);
        throw error;
      }

      const responses = ((data as TicketResponseWithUser[] | null) || []);
      safeLog(`✅ fetchTicketResponses - ${responses.length} respuestas encontradas`);
      
      // Log detallado de cada respuesta
      responses.forEach((response, index) => {
        console.log(`  Respuesta ${index + 1}:`, {
          id: response.id,
          message: response.message?.substring(0, 50) + '...',
          is_support_response: response.is_support_response,
          user_role: response.users?.role,
          created_by: response.created_by,
          created_at: response.created_at
        });
      });

      return { data: responses, error: null };
    } catch (error: unknown) {
      console.error('💥 fetchTicketResponses - Error capturado:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return { data: [], error: new Error(errorMessage) };
    }
  };

  // Cargar tickets cuando el userProfile esté disponible
  useEffect(() => {
    // Solo intentar cargar si hay userProfile o si no hay userProfile pero queremos verificar la sesión
    // Esto permite que el hook reaccione cuando el usuario se autentica
    if (userProfile?.id) {
      safeLog('🔄 [useTickets] useEffect: userProfile disponible, cargando tickets', {
        userId: userProfile.id,
        role: userProfile.role
      });
      fetchTickets();
    } else if (userProfile === null) {
      // Si userProfile es explícitamente null (no undefined), significa que sabemos que no hay usuario
      // No intentar cargar en este caso
      safeLog('⚠️ [useTickets] useEffect: userProfile es null, no cargando tickets');
      setTickets([]);
      setError(null);
    } else {
      // Si userProfile es undefined, aún no se ha determinado el estado del usuario
      // Intentar cargar de todas formas para verificar si hay sesión
      safeLog('🔄 [useTickets] useEffect: userProfile undefined, verificando sesión');
      fetchTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, userProfile?.role]);

  const createTicketResponse = async (
    ticketId: string,
    message: string,
    imageUrl?: string | null
  ) => {
    try {
      // NO establecer loading aquí para no bloquear la UI
      // El componente manejará su propio estado de loading
      setError(null);

      if (!userProfile?.id) {
        throw new Error('Usuario no autenticado');
      }

      if (!message.trim()) {
        throw new Error('El mensaje no puede estar vacío');
      }

      // Validar longitud máxima de mensaje (5000 caracteres)
      const MAX_MESSAGE_LENGTH = 5000;
      if (message.trim().length > MAX_MESSAGE_LENGTH) {
        throw new Error(`El mensaje no puede exceder ${MAX_MESSAGE_LENGTH} caracteres`);
      }

      // Determinar si es respuesta de soporte basado en el rol
      const isSupportResponse = userProfile.role === 'support';

      // Insertar respuesta directamente sin verificar ticket (más rápido)
      // RLS se encargará de la validación
      const { data, error } = await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: ticketId,
          message: message.trim(),
          image_url: imageUrl || null,
          created_by: userProfile.id,
          is_support_response: isSupportResponse
        })
        .select(`
          *,
          users:created_by (
            full_name,
            email,
            role
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      safeLog('✅ Respuesta creada exitosamente', { ticketId, responseId: data.id });
      
      return { data, error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      safeLog('❌ Error al crear respuesta:', errorMessage);
      setError(errorMessage);
      return { data: null, error: error instanceof Error ? error : new Error(errorMessage) };
    }
  };

  return {
    tickets,
    loading,
    error,
    createTicket,
    uploadImage,
    updateTicketStatus,
    fetchTicketResponses,
    createTicketResponse,
    refreshTickets: fetchTickets,
    clearError: () => setError(null),
  };
}
