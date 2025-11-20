/**
 * Pruebas para el componente LottieAnimation
 */

import { render, screen } from '@testing-library/react';
import LottieAnimation from '../LottieAnimation';

jest.mock('lottie-react', () => ({
  __esModule: true,
  default: ({ animationData, className }: any) => (
    <div data-testid="lottie-animation" className={className}>{JSON.stringify(animationData)}</div>
  ),
}));

describe('LottieAnimation', () => {
  const mockAnimationData = { v: '5.5.7', fr: 30, ip: 0, op: 60 };

  it('debe renderizar la animación Lottie', () => {
    render(<LottieAnimation animationData={mockAnimationData} />);
    expect(screen.getByTestId('lottie-animation')).toBeInTheDocument();
  });

  it('debe aplicar clases CSS personalizadas', () => {
    const { container } = render(
      <LottieAnimation animationData={mockAnimationData} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

