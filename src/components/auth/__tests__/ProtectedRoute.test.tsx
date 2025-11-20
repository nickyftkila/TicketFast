/**
 * Pruebas para el componente ProtectedRoute
 */

import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('ProtectedRoute', () => {
  const mockPush = jest.fn();
  const mockChildren = <div data-testid="protected-content">Protected Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('debe mostrar loading mientras se verifica autenticación', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<ProtectedRoute>{mockChildren}</ProtectedRoute>);

    expect(screen.getByText(/verificando acceso/i)).toBeInTheDocument();
  });

  it('debe redirigir al login si no hay usuario autenticado', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    render(<ProtectedRoute>{mockChildren}</ProtectedRoute>);

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('debe mostrar contenido si el usuario está autenticado', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      },
      loading: false,
    });

    render(<ProtectedRoute>{mockChildren}</ProtectedRoute>);

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('debe verificar el rol requerido', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      },
      loading: false,
    });

    render(<ProtectedRoute requiredRole="support">{mockChildren}</ProtectedRoute>);

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('debe permitir acceso si el usuario tiene el rol correcto', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'support@example.com',
        role: 'support',
      },
      loading: false,
    });

    render(<ProtectedRoute requiredRole="support">{mockChildren}</ProtectedRoute>);

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
