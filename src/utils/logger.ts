/**
 * Utilidad para logging seguro
 * Solo muestra logs en desarrollo, no en producción
 */

// Verificar si estamos en el cliente para evitar problemas en SSR
const isDevelopment = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * Log seguro - solo en desarrollo
 */
export function safeLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Error log - siempre se muestra pero sanitizado
 */
export function safeError(...args: unknown[]): void {
  // Sanitizar información sensible antes de loguear
  const sanitized = args.map(arg => {
    if (typeof arg === 'string') {
      // Remover tokens, IDs completos, etc.
      return arg
        .replace(/token["\s:=]+[a-zA-Z0-9_-]{20,}/gi, 'token=[REDACTED]')
        .replace(/key["\s:=]+[a-zA-Z0-9_-]{20,}/gi, 'key=[REDACTED]')
        .replace(/password["\s:=]+[^\s,}]+/gi, 'password=[REDACTED]');
    }
    if (typeof arg === 'object' && arg !== null) {
      // Sanitizar objetos
      const obj = arg as Record<string, unknown>;
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key')) {
          sanitizedObj[key] = '[REDACTED]';
        } else {
          sanitizedObj[key] = value;
        }
      }
      return sanitizedObj;
    }
    return arg;
  });
  
  console.error(...sanitized);
}

/**
 * Warn log - solo en desarrollo
 */
export function safeWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

