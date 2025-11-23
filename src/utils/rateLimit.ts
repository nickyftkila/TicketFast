/**
 * Rate Limiting básico en el cliente
 * Previene spam y ataques de fuerza bruta
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Verifica si una acción está permitida según el rate limit
 * @param key - Identificador único de la acción (ej: 'login', 'create-ticket')
 * @param maxAttempts - Número máximo de intentos permitidos
 * @param windowMs - Ventana de tiempo en milisegundos
 * @returns true si está permitido, false si excede el límite
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000 // 1 minuto por defecto
): boolean {
  const now = Date.now();
  const record = store[key];

  // Si no hay registro o la ventana expiró, crear uno nuevo
  if (!record || now > record.resetTime) {
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return true;
  }

  // Si aún está en la ventana, incrementar contador
  if (record.count >= maxAttempts) {
    return false; // Excedió el límite
  }

  record.count++;
  return true;
}

/**
 * Obtiene el tiempo restante hasta que se pueda intentar nuevamente
 * @param key - Identificador de la acción
 * @returns Tiempo en milisegundos, o 0 si está permitido
 */
export function getRateLimitRemaining(key: string): number {
  const record = store[key];
  if (!record) return 0;
  
  const now = Date.now();
  if (now > record.resetTime) return 0;
  
  return record.resetTime - now;
}

/**
 * Limpia el rate limit para una clave específica
 * Útil después de un intento exitoso
 */
export function clearRateLimit(key: string): void {
  delete store[key];
}

/**
 * Limpia todos los rate limits
 * Útil para testing o reset manual
 */
export function clearAllRateLimits(): void {
  Object.keys(store).forEach(key => delete store[key]);
}

