"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeBookingStatusDto = exports.CreateBookingDto = exports.BookingCustomerDto = exports.PassengerDto = exports.BOOKING_TARGET_STATUSES = exports.BOOKING_SOURCES = exports.PASSENGER_TYPES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.PASSENGER_TYPES = { ADULT: 'ADULT', CHILD_10_TO_14: 'CHILD_10_TO_14', CHILD_UNDER_10: 'CHILD_UNDER_10' };
exports.BOOKING_SOURCES = { WEBSITE: 'WEBSITE', TELEGRAM: 'TELEGRAM', PHONE: 'PHONE', MANAGER: 'MANAGER', OTHER: 'OTHER' };
exports.BOOKING_TARGET_STATUSES = {
    CONTACTED: 'CONTACTED',
    PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
    CONFIRMED: 'CONFIRMED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
    REFUNDED: 'REFUNDED',
};
class PassengerDto {
    firstName;
    lastName;
    middleName;
    birthDate;
    passengerType;
    phone;
    comment;
}
exports.PassengerDto = PassengerDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PassengerDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PassengerDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PassengerDto.prototype, "middleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PassengerDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: Object.values(exports.PASSENGER_TYPES) }),
    (0, class_validator_1.IsEnum)(exports.PASSENGER_TYPES),
    __metadata("design:type", Object)
], PassengerDto.prototype, "passengerType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PassengerDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PassengerDto.prototype, "comment", void 0);
class BookingCustomerDto {
    firstName;
    lastName;
    middleName;
    phone;
    email;
    telegramUsername;
}
exports.BookingCustomerDto = BookingCustomerDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "middleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+?[0-9\s\-()]{7,20}$/, { message: 'Укажите корректный телефон' }),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BookingCustomerDto.prototype, "telegramUsername", void 0);
class CreateBookingDto {
    departureId;
    departureCityId;
    customer;
    adults;
    children10to14;
    childrenUnder10;
    passengers;
    comment;
    source;
    idempotencyKey;
}
exports.CreateBookingDto = CreateBookingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "departureId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "departureCityId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BookingCustomerDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BookingCustomerDto),
    __metadata("design:type", BookingCustomerDto)
], CreateBookingDto.prototype, "customer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBookingDto.prototype, "adults", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBookingDto.prototype, "children10to14", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBookingDto.prototype, "childrenUnder10", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PassengerDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PassengerDto),
    __metadata("design:type", Array)
], CreateBookingDto.prototype, "passengers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: Object.values(exports.BOOKING_SOURCES) }),
    (0, class_validator_1.IsEnum)(exports.BOOKING_SOURCES),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateBookingDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateBookingDto.prototype, "idempotencyKey", void 0);
class ChangeBookingStatusDto {
    status;
    note;
}
exports.ChangeBookingStatusDto = ChangeBookingStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: Object.values(exports.BOOKING_TARGET_STATUSES) }),
    (0, class_validator_1.IsEnum)(exports.BOOKING_TARGET_STATUSES),
    __metadata("design:type", String)
], ChangeBookingStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ChangeBookingStatusDto.prototype, "note", void 0);
//# sourceMappingURL=dto.js.map