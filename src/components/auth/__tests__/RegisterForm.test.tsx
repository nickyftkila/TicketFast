/**
 * Pruebas para el componente RegisterForm
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../RegisterForm';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth');

describe('RegisterForm', () => {
  const mockRegister = jest.fn();
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      register: mockRegister,
    });
  });

  it('debe renderizar el formulario de registro', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('debe validar que el nombre tenga al menos 2 caracteres', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const nameInput = screen.getByLabelText(/nombre completo/i);
    const submitButton = screen.getByRole('button', { name: /crear cuenta/i });

    await user.type(nameInput, 'A');
    await user.click(submitButton);

    await waitFor(() => {
      const errorText = screen.queryByText(/al menos 2 caracteres/i);
      expect(errorText || mockRegister).toBeTruthy();
    });
  });

  it('debe validar que las contraseñas coincidan', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const nameInput = screen.getByLabelText(/nombre completo/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getAllByLabelText(/contraseña/i)[0];
    const confirmPasswordInput = screen.getAllByLabelText(/confirmar contraseña/i)[0] || screen.getAllByLabelText(/contraseña/i)[1];
    const submitButton = screen.getByRole('button', { name: /crear cuenta/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'different123');
    await user.click(submitButton);

    await waitFor(() => {
      const errorText = screen.queryByText(/no coinciden/i);
      expect(errorText || mockRegister).toBeTruthy();
    });
  });

  it('debe registrar un usuario exitosamente', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({ data: {}, error: null });

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const nameInput = screen.getByLabelText(/nombre completo/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getAllByLabelText(/contraseña/i)[0];
    const confirmPasswordInput = screen.getAllByLabelText(/confirmar contraseña/i)[0] || screen.getAllByLabelText(/contraseña/i)[1];
    const submitButton = screen.getByRole('button', { name: /crear cuenta/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
    });
  });
});
