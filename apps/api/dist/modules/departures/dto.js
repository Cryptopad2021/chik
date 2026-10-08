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
exports.ListDeparturesQuery = exports.UpdateDepartureDto = exports.CreateDepartureDto = exports.DepartureCityDto = exports.DEPARTURE_STATUSES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.DEPARTURE_STATUSES = {
    OPEN: 'OPEN',
    ALMOST_FULL: 'ALMOST_FULL',
    FULL: 'FULL',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
};
class DepartureCityDto {
    departureCityId;
    price;
    notes;
}
exports.DepartureCityDto = DepartureCityDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartureCityDto.prototype, "departureCityId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DepartureCityDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], DepartureCityDto.prototype, "notes", void 0);
class CreateDepartureDto {
    tourId;
    startDate;
    endDate;
    totalSeats;
    price;
    status;
    notes;
    cities;
}
exports.CreateDepartureDto = CreateDepartureDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDepartureDto.prototype, "tourId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDepartureDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDepartureDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateDepartureDto.prototype, "totalSeats", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateDepartureDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: Object.values(exports.DEPARTURE_STATUSES) }),
    (0, class_validator_1.IsEnum)(exports.DEPARTURE_STATUSES),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateDepartureDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateDepartureDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [DepartureCityDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DepartureCityDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateDepartureDto.prototype, "cities", void 0);
class UpdateDepartureDto {
    startDate;
    endDate;
    totalSeats;
    price;
    status;
    notes;
    cities;
}
exports.UpdateDepartureDto = UpdateDepartureDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateDepartureDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateDepartureDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateDepartureDto.prototype, "totalSeats", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateDepartureDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: Object.values(exports.DEPARTURE_STATUSES) }),
    (0, class_validator_1.IsEnum)(exports.DEPARTURE_STATUSES),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateDepartureDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateDepartureDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, type: [DepartureCityDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DepartureCityDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateDepartureDto.prototype, "cities", void 0);
class ListDeparturesQuery {
    tourId;
    citySlug;
    status;
    dateFrom;
    dateTo;
    upcomingOnly;
}
exports.ListDeparturesQuery = ListDeparturesQuery;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "tourId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "citySlug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, enum: Object.values(exports.DEPARTURE_STATUSES) }),
    (0, class_validator_1.IsEnum)(exports.DEPARTURE_STATUSES),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "dateFrom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "dateTo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: 'false' }),
    (0, class_validator_1.IsEnum)({ true: 'true', false: 'false' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListDeparturesQuery.prototype, "upcomingOnly", void 0);
//# sourceMappingURL=dto.js.map