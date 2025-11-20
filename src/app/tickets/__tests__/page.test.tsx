/**
 * Pruebas para la página de tickets
 */

import { render, screen } from '@testing-library/react';
import TicketsPage from '../page';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('TicketsPage', () => {
  it('debe renderizar el dashboard de soporte cuando el usuario es support', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'support-123', role: 'support' },
      loading: false,
    });

    render(<TicketsPage />);
    // El SupportDashboard debería renderizarse
    expect(screen.queryByText(/ticketfast.*soporte/i)).toBeInTheDocument();
  });
});

