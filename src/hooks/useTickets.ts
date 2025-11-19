'use client';

import { useState, useEffect } from 'react';
import { supabase, Ticket, TicketResponse } from '@/lib/supabase';

export type PriorityLevel = 'low' | 'medium' | 'high';

export interface AutoPriorityMetadata {
  score: number;
  level: PriorityLevel;
  reasons: string[];
}

export interface TicketUserInfo {
  full_name?: string | null;
  email?: string | null;
  role?: 'user' | 'support' | null;
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

export function useTickets() {
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          users:created_by (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setTickets(attachAutoPriority(data || []));
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
      console.error('Error fetching tickets:', error);
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

    // Validar el tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP)');
    }

    // Validar el tamaño del archivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo permitido es 5MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `ticket-images/${fileName}`;

    console.log('📤 Iniciando subida de imagen:', { fileName, filePath, size: file.size, type: file.type });

    // Agregar timeout de 30 segundos
    const uploadPromise = supabase.storage
      .from('ticket-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: La subida de imagen tardó demasiado. Por favor, intenta con una imagen más pequeña.'));
      }, 30000); // 30 segundos
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

    console.log('✅ Imagen subida exitosamente:', data);

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

      const { data, error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', ticketId)
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

  const fetchTicketResponses = async (ticketId: string) => {
    try {
      console.log('🔍 fetchTicketResponses - Iniciando consulta para ticket:', ticketId);
      
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
      console.log(`✅ fetchTicketResponses - ${responses.length} respuestas encontradas`);
      
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

  useEffect(() => {
    fetchTickets();
  }, []);

  return {
    tickets,
    loading,
    error,
    createTicket,
    uploadImage,
    updateTicketStatus,
    fetchTicketResponses,
    refreshTickets: fetchTickets,
    clearError: () => setError(null),
  };
}
