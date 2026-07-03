import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminsModule } from './admins/admins.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcessesModule } from './processes/processes.module';
import { ProductsModule } from './products/products.module';
import { ScannersModule } from './scanners/scanners.module';
import { SettingsModule } from './settings/settings.module';
import { WarningsModule } from './warnings/warnings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminsModule,
    ProductsModule,
    ProcessesModule,
    ScannersModule,
    DashboardModule,
    WarningsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
