import { describe, expect, it } from "vitest";
import { deepSanitize, escapeHtml, sanitizeText } from "./text-sanitizer";

describe("text-sanitizer (ТЗ 14.4 XSS input sanitize)", () => {
  it("экранирует HTML-спецсимволы", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("удаляет управляющие символы, сохраняет переводы строк", () => {
    expect(sanitizeText("a\u0000b\u001Fc\nd")).toBe("abc\nd");
  });

  it("deepSanitize чистит вложенные объекты и массивы", () => {
    const out = deepSanitize({
      name: "<b>Иван</b>",
      passengers: [{ comment: "'or 1=1`" }],
      adults: 2,
      nested: { ok: true, note: null },
    });
    expect(out).toEqual({
      name: "&lt;b&gt;Иван&lt;/b&gt;",
      passengers: [{ comment: "&#x27;or 1=1&#x60;" }],
      adults: 2,
      nested: { ok: true, note: null },
    });
  });

  it("не ломает безопасный текст (идемпотентно для обычных строк без спецсимволов)", () => {
    expect(sanitizeText("Поездка в Гагру, взрослый + ребёнок")).toBe(
      "Поездка в Гагру, взрослый + ребёнок",
    );
  });
});
