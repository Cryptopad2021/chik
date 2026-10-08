import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ToursController } from "./tours.controller";
import { ToursService } from "./tours.service";

@Module({
  imports: [AuthModule],
  controllers: [ToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
