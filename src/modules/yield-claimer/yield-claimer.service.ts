import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class YieldClaimerService {
  private readonly logger = new Logger(YieldClaimerService.name);
  private readonly yieldDistributorId: string;
  private readonly lendingYieldControllerId: string;
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly stellarService: StellarService,
  ) {
    this.yieldDistributorId = this.configService.get<string>('contracts.yieldDistributorId');
    this.lendingYieldControllerId = this.configService.get<string>('contracts.lendingYieldControllerId');

    if (!this.yieldDistributorId || !this.lendingYieldControllerId) {
      throw new Error('Contract IDs are required');
    }
  }

  @Cron(process.env.CRON_EXPRESSION || CronExpression.EVERY_30_SECONDS)
  async handleYieldClaim() {
    if (this.isProcessing) {
      this.logger.debug('Yield claim already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.debug('Checking yield distribution availability...');
      
      // Check if distribution is available
      const isDistributionAvailable = await this.checkDistributionAvailability();
      
      if (!isDistributionAvailable) {
        this.logger.debug('Distribution not yet available');
        const timeRemaining = await this.getTimeBeforeNextDistribution();
        this.logger.debug(`Time until next distribution: ${timeRemaining} seconds`);
        return;
      }

      this.logger.log('Distribution is available, claiming yield...');
      
      // Claim yield
      const claimedAmount = await this.claimYield();
      
      if (claimedAmount > 0) {
        this.logger.log(`Successfully claimed yield: ${claimedAmount}`);
      } else {
        this.logger.warn('No yield was claimed (amount = 0)');
      }
    } catch (error) {
      this.logger.error('Error during yield claim process:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async checkDistributionAvailability(): Promise<boolean> {
    try {
      const isAvailable = await this.stellarService.simulateContract(
        this.yieldDistributorId,
        'is_distribution_available'
      );
      return isAvailable;
    } catch (error) {
      this.logger.error('Error checking distribution availability:', error);
      throw error;
    }
  }

  async getTimeBeforeNextDistribution(): Promise<number> {
    try {
      const timeRemaining = await this.stellarService.simulateContract(
        this.yieldDistributorId,
        'time_before_next_distribution'
      );
      return Number(timeRemaining);
    } catch (error) {
      this.logger.error('Error getting time before next distribution:', error);
      return 0;
    }
  }

  async claimYield(): Promise<number> {
    try {
      const claimedAmount = await this.stellarService.callContract(
        this.lendingYieldControllerId,
        'claim_yield'
      );
      return Number(claimedAmount ?? 0);
    } catch (error) {
      this.logger.error('Error claiming yield:', error);
      throw error;
    }
  }

  async getDistributionInfo() {
    try {
      const [
        isAvailable,
        timeRemaining,
        distributionPeriod,
        nextDistributionTime,
        currentRound,
        totalMembers,
        treasuryShare,
        totalDistributed,
      ] = await Promise.all([
        this.checkDistributionAvailability(),
        this.getTimeBeforeNextDistribution(),
        this.stellarService.simulateContract(this.yieldDistributorId, 'get_distribution_period'),
        this.stellarService.simulateContract(this.yieldDistributorId, 'get_next_distribution_time'),
        this.stellarService.simulateContract(this.yieldDistributorId, 'get_distribution_info'),
        this.stellarService.simulateContract(this.yieldDistributorId, 'list_members'),
        this.stellarService.simulateContract(this.yieldDistributorId, 'get_treasury_share'),
        this.stellarService.simulateContract(this.yieldDistributorId, 'get_total_distributed'),
      ]);

      return {
        isAvailable,
        timeRemaining: Number(timeRemaining),
        distributionPeriod: Number(distributionPeriod),
        nextDistributionTime: Number(nextDistributionTime),
        currentRound,
        totalMembers: totalMembers ? totalMembers.length : 0,
        treasuryShareBps: Number(treasuryShare),
        totalDistributed: Number(totalDistributed),
      };
    } catch (error) {
      this.logger.error('Error getting distribution info:', error);
      throw error;
    }
  }

  async manualClaimYield() {
    if (this.isProcessing) {
      throw new Error('Yield claim already in progress');
    }

    await this.handleYieldClaim();
    return { message: 'Manual yield claim initiated' };
  }
}