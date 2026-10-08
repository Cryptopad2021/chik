import { slugify, uniqueSlug } from "./slug";

describe("slug service (ТЗ §63)", () => {
  it("транслитерирует пример из ТЗ", () => {
    expect(slugify("Тур в Дагестан на 3 дня")).toBe("tur-v-dagestan-na-3-dnya");
  });

  it("нормализует спецсимволы, пробелы и тире", () => {
    expect(slugify("  Горы — Приключений!!  ")).toBe("gory-priklyucheniy");
  });

  it("не оставляет leading/trailing dashes", () => {
    expect(slugify("---Дагестан---")).toBe("dagestan");
  });

  it("ограничивает длину 80 символами", () => {
    expect(slugify("а".repeat(120))).toHaveLength(80);
  });

  it("уникальный slug: занятый базовый → суффикс -2, затем -3", async () => {
    const taken = new Set(["dagestan", "dagestan-2"]);
    const result = await uniqueSlug("Дагестан", async (s) => taken.has(s));
    expect(result).toBe("dagestan-3");
  });

  it("пустая строка даёт fallback", async () => {
    expect(await uniqueSlug("!!!", async () => false)).toBe("tour");
  });
});
