"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.Role = void 0;
exports.roleHasPermission = roleHasPermission;
/** Единые роли и permissions (ТЗ §7). Проверка всегда на backend. */
var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["ADMIN"] = "ADMIN";
    Role["MANAGER"] = "MANAGER";
    Role["CONTENT_MANAGER"] = "CONTENT_MANAGER";
    Role["VIEWER"] = "VIEWER";
})(Role || (exports.Role = Role = {}));
exports.PERMISSIONS = {
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
};
const ALL = Object.values(exports.PERMISSIONS);
exports.ROLE_PERMISSIONS = {
    [Role.SUPER_ADMIN]: ALL,
    [Role.ADMIN]: ALL.filter((p) => p !== exports.PERMISSIONS.SETTINGS_WRITE), // админ: всё, кроме системных настроек (super-admin)
    [Role.MANAGER]: [
        exports.PERMISSIONS.TOUR_READ,
        exports.PERMISSIONS.DEPARTURE_READ,
        exports.PERMISSIONS.BOOKING_READ,
        exports.PERMISSIONS.BOOKING_WRITE,
        exports.PERMISSIONS.BOOKING_MANAGE,
        exports.PERMISSIONS.CUSTOMER_READ,
        exports.PERMISSIONS.CUSTOMER_WRITE,
        exports.PERMISSIONS.REVIEW_READ,
    ],
    [Role.CONTENT_MANAGER]: [
        exports.PERMISSIONS.TOUR_READ,
        exports.PERMISSIONS.TOUR_WRITE,
        exports.PERMISSIONS.DEPARTURE_READ,
        exports.PERMISSIONS.DEPARTURE_WRITE,
        exports.PERMISSIONS.REVIEW_READ,
        exports.PERMISSIONS.REVIEW_MODERATE,
        exports.PERMISSIONS.TELEGRAM_PUBLISH,
        exports.PERMISSIONS.MEDIA_UPLOAD,
    ],
    [Role.VIEWER]: [
        exports.PERMISSIONS.TOUR_READ,
        exports.PERMISSIONS.DEPARTURE_READ,
        exports.PERMISSIONS.BOOKING_READ,
        exports.PERMISSIONS.CUSTOMER_READ,
        exports.PERMISSIONS.REVIEW_READ,
    ],
};
function roleHasPermission(role, permission) {
    return exports.ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
//# sourceMappingURL=constants.js.map