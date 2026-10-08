import { describe, expect, it } from "vitest";
import { PERMISSIONS, Role, roleHasPermission } from "./constants";

/** RBAC-матрица (ТЗ §7, §53) — проверка прав на backend. */
describe("RBAC matrix", () => {
  it("SUPER_ADMIN имеет все permissions", () => {
    for (const p of Object.values(PERMISSIONS)) {
      expect(roleHasPermission(Role.SUPER_ADMIN, p)).toBe(true);
    }
  });

  it("ADMIN: всё кроме SETTINGS_WRITE и USER_MANAGE? — уточнение матрицы", () => {
    expect(roleHasPermission(Role.ADMIN, PERMISSIONS.TOUR_WRITE)).toBe(true);
    expect(roleHasPermission(Role.ADMIN, PERMISSIONS.SETTINGS_WRITE)).toBe(false);
  });

  it("MANAGER: управляет бронями, но не пишет туры", () => {
    expect(roleHasPermission(Role.MANAGER, PERMISSIONS.BOOKING_MANAGE)).toBe(true);
    expect(roleHasPermission(Role.MANAGER, PERMISSIONS.CUSTOMER_WRITE)).toBe(true);
    expect(roleHasPermission(Role.MANAGER, PERMISSIONS.TOUR_WRITE)).toBe(false);
    expect(roleHasPermission(Role.MANAGER, PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(roleHasPermission(Role.MANAGER, PERMISSIONS.TELEGRAM_PUBLISH)).toBe(false);
  });

  it("CONTENT_MANAGER: контент и публикации, без броней/клиентов", () => {
    expect(roleHasPermission(Role.CONTENT_MANAGER, PERMISSIONS.TOUR_WRITE)).toBe(true);
    expect(roleHasPermission(Role.CONTENT_MANAGER, PERMISSIONS.TELEGRAM_PUBLISH)).toBe(true);
    expect(roleHasPermission(Role.CONTENT_MANAGER, PERMISSIONS.REVIEW_MODERATE)).toBe(true);
    expect(roleHasPermission(Role.CONTENT_MANAGER, PERMISSIONS.BOOKING_WRITE)).toBe(false);
    expect(roleHasPermission(Role.CONTENT_MANAGER, PERMISSIONS.CUSTOMER_READ)).toBe(false);
  });

  it("VIEWER: только чтение", () => {
    expect(roleHasPermission(Role.VIEWER, PERMISSIONS.TOUR_READ)).toBe(true);
    for (const p of [PERMISSIONS.TOUR_WRITE, PERMISSIONS.BOOKING_WRITE, PERMISSIONS.USER_MANAGE, PERMISSIONS.SETTINGS_WRITE]) {
      expect(roleHasPermission(Role.VIEWER, p)).toBe(false);
    }
  });

  it("неизвестная роль не получает прав", () => {
    expect(roleHasPermission("HACKER" as Role, PERMISSIONS.TOUR_READ)).toBe(false);
  });
});
