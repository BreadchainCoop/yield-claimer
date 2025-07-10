import { Controller, Get, Post, HttpException, HttpStatus } from '@nestjs/common';
import { YieldClaimerService } from './yield-claimer.service';

@Controller('yield-claimer')
export class YieldClaimerController {
  constructor(private readonly yieldClaimerService: YieldClaimerService) {}

  @Get('status')
  async getStatus() {
    try {
      const info = await this.yieldClaimerService.getDistributionInfo();
      return {
        status: 'active',
        distribution: {
          available: info.isAvailable,
          timeUntilNext: `${info.timeRemaining} seconds`,
          nextDistributionTime: new Date(info.nextDistributionTime * 1000).toISOString(),
          distributionPeriod: `${info.distributionPeriod} seconds`,
          treasuryShare: `${info.treasuryPercent}%`,
          totalDistributed: info.totalDistributed,
        },
      };
    } catch (error) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('claim')
  async manualClaim() {
    try {
      const result = await this.yieldClaimerService.manualClaimYield();
      return result;
    } catch (error) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}