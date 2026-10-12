/**
 * Санитизация пользовательского текста (ТЗ §39 / Phase 14.4: XSS input sanitize).
 * Экранирование HTML-спецсимволов — единая точка на входе для свободных текстовых полей
 * (комментарии заявок, сообщений и т.п.). React экранирует вывод сам, но defence-in-depth
 * требует чистого значения уже в БД.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;",
};

/** Экранирует символы, опасные в HTML/inline-контекстах. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Удаляет управляющие символы (кроме \n, \r, \t) и экранирует HTML. */
export function sanitizeText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return escapeHtml(value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""));
}

/** Рекурсивно чистит все строки в объекте/массиве (для произвольных JSON-тел запросов). */
export function deepSanitize<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepSanitize(v)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepSanitize(v);
    }
    return out as unknown as T;
  }
  return value;
}
