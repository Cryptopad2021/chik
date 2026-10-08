/**
 * Slug service (ТЗ §63): русские названия корректно превращаются в URL.
 * «Тур в Дагестан на 3 дня» → «tur-v-dagestan-na-3-dnya»
 */

// Транслитерация, согласованная с примером ТЗ («Дагестан»→dagestan, «дня»→dnya)
const RU_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Транслитерация строки в ascii. */
export function transliterate(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    if (ch in RU_TO_LAT) {
      out += RU_TO_LAT[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += "-";
    }
  }
  return out;
}

/** Нормализация в slug: только [a-z0-9-], без lead/trailing dashes, collapse повторов. */
export function slugify(input: string): string {
  return transliterate(input)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Гарантирует уникальность slug: если занят — добавляет -2, -3, ...
 * exists — асинхронная проверка занятости (БД).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "tour";
  if (!(await exists(root))) return root;
  for (let i = 2; i <= 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Alias for uniqueSlug (backward compat). */
export const ensureUniqueSlug = uniqueSlug;
