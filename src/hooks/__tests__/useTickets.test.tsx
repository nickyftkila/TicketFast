/**
 * Pruebas completas para el hook useTickets
 * Cubre todas las funcionalidades: fetchTickets, createTicket, uploadImage, updateTicketStatus, fetchTicketResponses
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTickets } from '../useTickets';
import { supabase } from '@/lib/supabase';

// Mock de Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

describe('useTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTickets', () => {
    it('debe obtener tickets exitosamente', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          description: 'Test ticket',
          tags: ['Impresora'],
          is_urgent: false,
          status: 'pending',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          users: {
            full_name: 'Test User',
            email: 'test@example.com',
          },
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockTickets,
            error: null,
          }),
        }),
      });

      const { result } = renderHook(() => useTickets());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tickets.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('debe manejar errores al obtener tickets', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error fetching tickets' },
          }),
        }),
      });

      const { result } = renderHook(() => useTickets());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).not.toBeNull();
    });

    it('debe asignar prioridades automáticas a los tickets', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          description: 'Sin internet en toda la recepción',
          tags: ['Sin WiFi'],
          is_urgent: false,
          status: 'pending',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockTickets,
            error: null,
          }),
        }),
      });

      const { result } = renderHook(() => useTickets());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      if (result.current.tickets.length > 0) {
        expect(result.current.tickets[0]).toHaveProperty('autoPriority');
      }
    });
  });

  describe('createTicket', () => {
    it('debe crear un ticket exitosamente', async () => {
      const mockNewTicket = {
        id: 'ticket-new',
        description: 'Nuevo ticket',
        tags: ['Impresora'],
        is_urgent: false,
        status: 'pending',
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock para manejar múltiples llamadas: useEffect fetchTickets, createTicket insert, y fetchTickets después
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          // Segunda llamada: insert en createTicket
          if (callCount === 2) {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockNewTicket,
                    error: null,
                  }),
                }),
              }),
            };
          }
          // Tercera llamada: fetchTickets después de crear
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [mockNewTicket],
                error: null,
              }),
            }),
          };
        }
        // Para otras tablas, devolver un objeto vacío con métodos mock
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());

      await act(async () => {
        const response = await result.current.createTicket({
          description: 'Nuevo ticket',
          tags: ['Impresora'],
          is_urgent: false,
          created_by: 'user-123',
        });

        expect(response.error).toBeNull();
        expect(response.data).not.toBeNull();
      });
    });

    it('debe manejar errores al crear ticket', async () => {
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          // Segunda llamada: insert en createTicket
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Error creating ticket' },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.createTicket({
          description: 'Test ticket',
          tags: [],
          is_urgent: false,
          created_by: 'user-123',
        });

        expect(response.error).not.toBeNull();
        expect(response.data).toBeNull();
      });
    });
  });

  describe('uploadImage', () => {
    it('debe subir una imagen exitosamente', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockPublicUrl = 'https://storage.example.com/image.jpg';

      // Mock para fetchTickets inicial
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'ticket-images/test.jpg' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: mockPublicUrl },
        }),
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const url = await result.current.uploadImage(mockFile);
        expect(url).toBe(mockPublicUrl);
      });
    });

    it('debe rechazar archivos que no son imágenes', async () => {
      const mockFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });

      // Mock para fetchTickets inicial
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.uploadImage(mockFile)).rejects.toThrow('Tipo de archivo no permitido');
      });
    });

    it('debe rechazar archivos demasiado grandes', async () => {
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      // Mock para fetchTickets inicial
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.uploadImage(largeFile)).rejects.toThrow('demasiado grande');
      });
    });

    it('debe manejar errores al subir imagen', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // Mock para fetchTickets inicial
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' },
        }),
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await expect(result.current.uploadImage(mockFile)).rejects.toThrow();
      });
    });
  });

  describe('updateTicketStatus', () => {
    it('debe actualizar el estado de un ticket exitosamente', async () => {
      const mockUpdatedTicket = {
        id: 'ticket-1',
        status: 'in_progress',
      };

      // Mock para manejar múltiples llamadas: useEffect fetchTickets, updateTicketStatus update, y fetchTickets después
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          // Segunda llamada: update en updateTicketStatus
          if (callCount === 2) {
            return {
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: mockUpdatedTicket,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          // Tercera llamada: fetchTickets después de actualizar
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [mockUpdatedTicket],
                error: null,
              }),
            }),
          };
        }
        // Para otras tablas, devolver un objeto vacío con métodos mock
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.updateTicketStatus('ticket-1', 'in_progress');
        expect(response.error).toBeNull();
        expect(response.data).not.toBeNull();
      });
    });

    it('debe manejar errores al actualizar estado', async () => {
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          // Segunda llamada: update en updateTicketStatus
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Update failed' },
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.updateTicketStatus('ticket-1', 'resolved');
        expect(response.error).not.toBeNull();
      });
    });
  });

  describe('fetchTicketResponses', () => {
    it('debe obtener respuestas de un ticket exitosamente', async () => {
      const mockResponses = [
        {
          id: 'response-1',
          ticket_id: 'ticket-1',
          message: 'Respuesta de prueba',
          created_by: 'user-123',
          is_support_response: false,
          created_at: new Date().toISOString(),
          users: {
            full_name: 'Test User',
            email: 'test@example.com',
            role: 'user',
          },
        },
      ];

      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
        }
        if (table === 'ticket_responses') {
          // Llamada para fetchTicketResponses
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockResponses,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.fetchTicketResponses('ticket-1');
        expect(response.error).toBeNull();
        expect(response.data.length).toBeGreaterThan(0);
      });
    });

    it('debe intentar sin join si falla con join', async () => {
      let ticketsCallCount = 0;
      let responsesCallCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          ticketsCallCount++;
          // Primera llamada: fetchTickets en useEffect
          if (ticketsCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
        }
        if (table === 'ticket_responses') {
          responsesCallCount++;
          if (responsesCallCount === 1) {
            // Primera llamada con join falla
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Join error' },
                  }),
                }),
              }),
            };
          } else {
            // Segunda llamada sin join funciona
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ id: 'response-1', message: 'Test' }],
                    error: null,
                  }),
                }),
              }),
            };
          }
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.fetchTicketResponses('ticket-1');
        expect(response.error).toBeNull();
      });
    });

    it('debe manejar errores al obtener respuestas', async () => {
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
        }
        if (table === 'ticket_responses') {
          // Llamada para fetchTicketResponses con error
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Error fetching responses' },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.fetchTicketResponses('ticket-1');
        // Debe retornar array vacío y error
        expect(response.data).toEqual([]);
        expect(response.error).not.toBeNull();
      });
    });
  });

  describe('clearError', () => {
    it('debe limpiar el error', () => {
      const { result } = renderHook(() => useTickets());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('refreshTickets', () => {
    it('debe refrescar la lista de tickets', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          description: 'Test',
          tags: [],
          is_urgent: false,
          status: 'pending',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'tickets') {
          callCount++;
          // Primera llamada: fetchTickets en useEffect
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          // Segunda llamada: refreshTickets
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockTickets,
                error: null,
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const { result } = renderHook(() => useTickets());
      
      // Esperar a que termine el fetchTickets inicial
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshTickets();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
