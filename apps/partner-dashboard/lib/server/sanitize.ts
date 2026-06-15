/**
 * Utility functions for sanitizing inputs on the server.
 */

/**
 * Escapes unsafe characters in a string to prevent HTML injection/XSS.
 * Commonly used when interpolating user input into email templates.
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
