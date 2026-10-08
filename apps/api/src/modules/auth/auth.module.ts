import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { TokensService } from "./tokens.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokensService, JwtAuthGuard],
  exports: [AuthService, TokensService, JwtAuthGuard],
})
export class AuthModule {}
