'use client';

import { useState, useEffect } from 'react';
import { supabase, Ticket } from '@/lib/supabase';

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
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

      setTickets(data || []);
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

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
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

      console.log('Subiendo imagen:', { fileName, filePath, size: file.size, type: file.type });

      const { data, error } = await supabase.storage
        .from('ticket-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error de Supabase Storage:', error);
        throw new Error(`Error al subir la imagen: ${error.message}`);
      }

      console.log('Imagen subida exitosamente:', data);

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('ticket-images')
        .getPublicUrl(filePath);

      console.log('URL pública generada:', publicUrl);
      return publicUrl;
    } catch (error: unknown) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al subir la imagen';
      setError(errorMessage);
      return null;
    }
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
    refreshTickets: fetchTickets,
    clearError: () => setError(null),
  };
}
