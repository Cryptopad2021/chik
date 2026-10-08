/** Единые роли и permissions (ТЗ §7). Проверка всегда на backend. */
export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CONTENT_MANAGER = "CONTENT_MANAGER",
  VIEWER = "VIEWER",
}

export const PERMISSIONS = {
  TOUR_READ: "tour:read",
  TOUR_WRITE: "tour:write",
  DEPARTURE_READ: "departure:read",
  DEPARTURE_WRITE: "departure:write",
  BOOKING_READ: "booking:read",
  BOOKING_WRITE: "booking:write",
  BOOKING_MANAGE: "booking:manage", // смена статусов, назначение менеджера
  CUSTOMER_READ: "customer:read",
  CUSTOMER_WRITE: "customer:write",
  REVIEW_READ: "review:read",
  REVIEW_MODERATE: "review:moderate",
  TELEGRAM_PUBLISH: "telegram:publish",
  MEDIA_UPLOAD: "media:upload",
  SETTINGS_WRITE: "settings:write",
  USER_MANAGE: "user:manage",
  AUDIT_READ: "audit:read",
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: ALL,
  [Role.ADMIN]: ALL.filter((p) => p !== PERMISSIONS.SETTINGS_WRITE), // админ: всё, кроме системных настроек (super-admin)
  [Role.MANAGER]: [
    PERMISSIONS.TOUR_READ,
    PERMISSIONS.DEPARTURE_READ,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_WRITE,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.REVIEW_READ,
  ],
  [Role.CONTENT_MANAGER]: [
    PERMISSIONS.TOUR_READ,
    PERMISSIONS.TOUR_WRITE,
    PERMISSIONS.DEPARTURE_READ,
    PERMISSIONS.DEPARTURE_WRITE,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.TELEGRAM_PUBLISH,
    PERMISSIONS.MEDIA_UPLOAD,
  ],
  [Role.VIEWER]: [
    PERMISSIONS.TOUR_READ,
    PERMISSIONS.DEPARTURE_READ,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.REVIEW_READ,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
