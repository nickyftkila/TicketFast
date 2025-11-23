import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML para prevenir ataques XSS
 * @param dirty - Contenido HTML potencialmente peligroso
 * @returns Contenido HTML sanitizado seguro para renderizar
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // En el servidor, solo escapar HTML básico
    return dirty
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  
  // En el cliente, usar DOMPurify para sanitización completa
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No permitir ningún tag HTML
    ALLOWED_ATTR: [], // No permitir ningún atributo
    KEEP_CONTENT: true, // Mantener el contenido de texto
  });
}

/**
 * Escapa HTML para renderizado seguro (solo texto)
 * Útil cuando no queremos ningún HTML
 */
export function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Fallback para servidor
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

