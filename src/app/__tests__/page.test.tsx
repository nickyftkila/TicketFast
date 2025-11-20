/**
 * Pruebas para la página principal (app/page.tsx)
 */

import { render, screen } from '@testing-library/react';
import Home from '../page';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth');
jest.mock('@/components/auth/AuthContainer', () => {
  return function MockAuthContainer() {
    return <div data-testid="auth-container">Auth Container</div>;
  };
});
jest.mock('@/components/dashboard/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard">Dashboard</div>;
  };
});
jest.mock('@/components/auth/ProtectedRoute', () => {
  return function MockProtectedRoute({ children }: { children: React.ReactNode }) {
    return <div data-testid="protected-route">{children}</div>;
  };
});

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe mostrar loading cuando está cargando', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<Home />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('debe mostrar AuthContainer cuando no hay usuario', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    render(<Home />);
    expect(screen.getByTestId('auth-container')).toBeInTheDocument();
  });

  it('debe mostrar Dashboard cuando hay usuario autenticado', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      },
      loading: false,
    });

    render(<Home />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});
