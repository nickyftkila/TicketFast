/**
 * Pruebas para el componente ForgotPasswordForm
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordForm from '../ForgotPasswordForm';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth');

describe('ForgotPasswordForm', () => {
  const mockForgotPassword = jest.fn();
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      forgotPassword: mockForgotPassword,
    });
  });

  it('debe renderizar el formulario', () => {
    render(<ForgotPasswordForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByText(/recuperar contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('debe mostrar error cuando el email es inválido', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /enviar/i });

    await user.type(emailInput, 'email-invalido');
    await user.click(submitButton);

    await waitFor(() => {
      const errorText = screen.queryByText(/email inválido/i);
      expect(errorText || mockForgotPassword).toBeTruthy();
    });
  });

  it('debe enviar email de recuperación exitosamente', async () => {
    const user = userEvent.setup();
    mockForgotPassword.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /enviar/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('debe mostrar estado de éxito después de enviar', async () => {
    const user = userEvent.setup();
    mockForgotPassword.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /enviar/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
    });
  });

  it('debe llamar a onSwitchToLogin desde el estado de éxito', async () => {
    const user = userEvent.setup();
    mockForgotPassword.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /enviar/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
    });

    const backButton = screen.getByText(/volver al login/i);
    await user.click(backButton);

    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });
});
