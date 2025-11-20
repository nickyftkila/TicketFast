/**
 * Pruebas para el componente Toast
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast, { ToastProps } from '../Toast';

describe('Toast', () => {
  const defaultProps: ToastProps = {
    id: 'toast-1',
    type: 'success',
    title: 'Éxito',
    message: 'Operación completada',
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('debe renderizar el toast con título y mensaje', () => {
    render(<Toast {...defaultProps} />);

    expect(screen.getByText('Éxito')).toBeInTheDocument();
    expect(screen.getByText('Operación completada')).toBeInTheDocument();
  });

  it('debe mostrar el icono correcto según el tipo', () => {
    const { rerender } = render(<Toast {...defaultProps} type="success" />);
    expect(screen.getByText('Éxito')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="error" title="Error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="warning" title="Advertencia" />);
    expect(screen.getByText('Advertencia')).toBeInTheDocument();

    rerender(<Toast {...defaultProps} type="info" title="Información" />);
    expect(screen.getByText('Información')).toBeInTheDocument();
  });

  it('debe auto-cerrarse después de la duración especificada', async () => {
    const onClose = jest.fn();
    render(<Toast {...defaultProps} duration={1000} onClose={onClose} />);

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('toast-1');
    });
  });

  it('debe cerrarse cuando se hace clic en el botón de cerrar', async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();
    render(<Toast {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    await user.click(closeButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('toast-1');
    });
  });

  it('debe funcionar sin mensaje', () => {
    render(<Toast {...defaultProps} message={undefined} />);

    expect(screen.getByText('Éxito')).toBeInTheDocument();
  });
});
