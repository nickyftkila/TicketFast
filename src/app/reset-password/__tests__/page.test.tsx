/**
 * Pruebas para la página de reset de contraseña
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPassword from '../page';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

jest.mock('@/hooks/useAuth');
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('ResetPassword Page', () => {
  const mockUpdatePassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      updatePassword: mockUpdatePassword,
    });
  });

  it('debe renderizar el formulario de reset', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });

    render(<ResetPassword />);
    // Esperar a que el componente valide la sesión y renderice el formulario
    await waitFor(() => {
      expect(screen.getByText(/nueva contraseña/i)).toBeInTheDocument();
    });
  });

  it('debe actualizar la contraseña exitosamente', async () => {
    const user = userEvent.setup();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });
    mockUpdatePassword.mockResolvedValue({ data: {}, error: null });

    render(<ResetPassword />);

    // Esperar a que el formulario se renderice
    await waitFor(() => {
      expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    const submitButton = screen.getByRole('button', { name: /actualizar/i });

    await user.type(passwordInput, 'newpassword123');
    await user.type(confirmInput, 'newpassword123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('newpassword123');
    });
  });

  it('debe validar que las contraseñas coincidan', async () => {
    const user = userEvent.setup();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });

    render(<ResetPassword />);

    // Esperar a que el formulario se renderice
    await waitFor(() => {
      expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    const submitButton = screen.getByRole('button', { name: /actualizar/i });

    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'different');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/contraseñas no coinciden/i)).toBeInTheDocument();
    });
  });
});

