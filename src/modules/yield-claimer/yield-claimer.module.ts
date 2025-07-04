import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YieldClaimerService } from './yield-claimer.service';
import { YieldClaimerController } from './yield-claimer.controller';

@Module({
  imports: [ConfigModule],
  providers: [YieldClaimerService],
  controllers: [YieldClaimerController],
})
export class YieldClaimerModule {}