// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Silenciar console.error durante las pruebas (solo para errores esperados)
// Mantener console.warn y console.log visibles para debugging
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Solo silenciar errores conocidos que son parte de las pruebas
    const errorMessage = args[0]?.toString() || '';
    const knownTestErrors = [
      'Error en forgotPassword',
      'Error inesperado en forgotPassword',
      'Error logging out',
      'Error fetching user profile',
      'Error in fetchUserProfile',
      'Error creando perfil de usuario',
    ];
    
    // Si es un error conocido de las pruebas, no mostrarlo
    if (knownTestErrors.some(msg => errorMessage.includes(msg))) {
      return;
    }
    
    // Para otros errores, mostrarlos normalmente
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Mock ResizeObserver (necesario para Recharts y componentes que usan ResizeObserver)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Configurar variables de entorno de Supabase para pruebas
// Usar las credenciales reales ya que no hay credenciales de prueba
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ktbnambciqauyssrneyl.supabase.co'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Ym5hbWJjaXFhdXlzc3JuZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODUyOTgsImV4cCI6MjA3NDI2MTI5OH0.B7osCpOpMtZSSzLZTMqnVyuHd__fGzXuZlJjZzYONiU'
}

