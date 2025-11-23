/**
 * Logger de seguridad para monitoreo de eventos críticos
 * Registra intentos de login fallidos, cambios de roles, etc.
 */

interface SecurityEvent {
  type: 'login_failed' | 'login_success' | 'role_change_attempt' | 'unauthorized_access' | 'rate_limit_exceeded' | 'suspicious_file_upload' | 'unauthorized_status_update' | 'invalid_status_update';
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const securityEvents: SecurityEvent[] = [];
const MAX_EVENTS = 100; // Mantener solo los últimos 100 eventos en memoria

/**
 * Registra un evento de seguridad
 */
export function logSecurityEvent(
  type: SecurityEvent['type'],
  details?: {
    userId?: string;
    email?: string;
    details?: Record<string, unknown>;
  }
): void {
  const event: SecurityEvent = {
    type,
    userId: details?.userId,
    email: details?.email ? details.email.substring(0, 3) + '***' : undefined, // Solo primeros 3 caracteres
    ip: typeof window !== 'undefined' ? 'client-side' : 'server-side',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent.substring(0, 50) : undefined,
    details: details?.details,
    timestamp: new Date().toISOString(),
  };

  securityEvents.push(event);

  // Mantener solo los últimos MAX_EVENTS
  if (securityEvents.length > MAX_EVENTS) {
    securityEvents.shift();
  }

  // En desarrollo, loguear a consola
  if (process.env.NODE_ENV === 'development') {
    console.warn('🔒 Security Event:', event);
  }

  // En producción, aquí se podría enviar a un servicio de logging externo
  // Ejemplo: Sentry, LogRocket, CloudWatch, etc.
}

/**
 * Obtiene eventos de seguridad recientes
 * Útil para debugging o dashboard de seguridad
 */
export function getSecurityEvents(limit: number = 10): SecurityEvent[] {
  return securityEvents.slice(-limit).reverse();
}

/**
 * Obtiene estadísticas de eventos de seguridad
 */
export function getSecurityStats(): {
  totalEvents: number;
  failedLogins: number;
  successfulLogins: number;
  rateLimitExceeded: number;
  unauthorizedAccess: number;
} {
  return {
    totalEvents: securityEvents.length,
    failedLogins: securityEvents.filter(e => e.type === 'login_failed').length,
    successfulLogins: securityEvents.filter(e => e.type === 'login_success').length,
    rateLimitExceeded: securityEvents.filter(e => e.type === 'rate_limit_exceeded').length,
    unauthorizedAccess: securityEvents.filter(e => e.type === 'unauthorized_access').length,
  };
}

/**
 * Limpia los eventos de seguridad
 * Útil para testing o reset manual
 */
export function clearSecurityEvents(): void {
  securityEvents.length = 0;
}

