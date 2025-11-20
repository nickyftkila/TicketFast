/**
 * Pruebas para el componente AuthContainer
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthContainer from '../AuthContainer';

// Mock de los componentes hijos
jest.mock('../LoginForm', () => {
  return function MockLoginForm({ onSwitchToForgotPassword }: { onSwitchToForgotPassword: () => void }) {
    return (
      <div data-testid="login-form">
        <button onClick={onSwitchToForgotPassword}>Forgot Password</button>
      </div>
    );
  };
});

jest.mock('../ForgotPasswordForm', () => {
  return function MockForgotPasswordForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
    return (
      <div data-testid="forgot-password-form">
        <button onClick={onSwitchToLogin}>Back to Login</button>
      </div>
    );
  };
});

describe('AuthContainer', () => {
  it('debe renderizar el formulario de login por defecto', () => {
    render(<AuthContainer />);
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('debe cambiar a forgot password cuando se hace clic', async () => {
    const user = userEvent.setup();
    render(<AuthContainer />);

    const forgotPasswordButton = screen.getByText(/forgot password/i);
    await user.click(forgotPasswordButton);

    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
  });

  it('debe volver a login desde forgot password', async () => {
    const user = userEvent.setup();
    render(<AuthContainer />);

    // Ir a forgot password
    const forgotPasswordButton = screen.getByText(/forgot password/i);
    await user.click(forgotPasswordButton);

    // Volver a login
    const backButton = screen.getByText(/back to login/i);
    await user.click(backButton);

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });
});
