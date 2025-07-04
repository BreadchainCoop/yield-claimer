import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/config';
import { StellarModule } from './modules/stellar/stellar.module';
import { YieldClaimerModule } from './modules/yield-claimer/yield-claimer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    StellarModule,
    YieldClaimerModule,
  ],
})
export class AppModule {}