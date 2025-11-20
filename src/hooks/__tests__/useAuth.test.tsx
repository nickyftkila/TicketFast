/**
 * Pruebas para el hook useAuth
 * Valida la funcionalidad de autenticación: login, registro, recuperación de contraseña, logout
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { supabase } from '@/lib/supabase';

// Mock de Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(),
    })),
  },
}));

// Mock de next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock por defecto para getSession que retorna el formato correcto
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  describe('Login', () => {
    it('debe hacer login exitosamente con credenciales válidas', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'token' } },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                full_name: 'Test User',
                role: 'user',
              },
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.login('test@example.com', 'password123');
        expect(response.error).toBeNull();
      });
    });

    it('debe retornar error con credenciales inválidas', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.login('test@example.com', 'wrongpassword');
        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain('Invalid login credentials');
      });
    });

    it('debe manejar errores de conexión', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch')
      );

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.login('test@example.com', 'password123');
        expect(response.error).not.toBeNull();
      });
    });
  });

  describe('Registro', () => {
    it('debe registrar un nuevo usuario exitosamente', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
      };

      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.register(
          'newuser@example.com',
          'password123',
          'New User'
        );
        expect(response.error).toBeNull();
      });
    });

    it('debe retornar error si el email ya existe', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.register(
          'existing@example.com',
          'password123',
          'Existing User'
        );
        expect(response.error).not.toBeNull();
      });
    });
  });

  describe('Recuperación de Contraseña', () => {
    it('debe enviar email de recuperación exitosamente', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.forgotPassword('test@example.com');
        expect(response.error).toBeNull();
      });
    });

    it('debe manejar errores al enviar email de recuperación', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Email not found' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.forgotPassword('nonexistent@example.com');
        expect(response.error).not.toBeNull();
      });
    });

    it('debe manejar errores de conexión en recuperación', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.forgotPassword('test@example.com');
        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain('conexión');
      });
    });
  });

  describe('Actualización de Contraseña', () => {
    it('debe actualizar la contraseña exitosamente', async () => {
      (supabase.auth.updateUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.updatePassword('newpassword123');
        expect(response.error).toBeNull();
      });
    });

    it('debe retornar error si la contraseña es muy corta', async () => {
      (supabase.auth.updateUser as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Password should be at least 6 characters' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.updatePassword('123');
        expect(response.error).not.toBeNull();
      });
    });
  });

  describe('Logout', () => {
    it('debe cerrar sesión exitosamente', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('debe manejar errores al cerrar sesión', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: { message: 'Logout failed' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      // El hook debe manejar el error sin lanzar excepción
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Estado de Usuario', () => {
    it('debe cargar el perfil del usuario al iniciar sesión', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
          },
        },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});

