import { StellarNetworkConfig } from '@/config/config.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { rpc, contract } from '@stellar/stellar-sdk';
import * as YieldDistributor from '@/packages/yield_distributor/src';
import * as YieldController from '@/packages/lending_yield_controller/src';

@Injectable()
export class YieldClaimerService {
  private readonly logger = new Logger(YieldClaimerService.name);
  private readonly network: string;
  private readonly yieldDistributorClient: YieldDistributor.Client;
  private readonly yieldControllerClient: YieldController.Client;
  private readonly signer: {
    signTransaction: contract.SignTransaction;
    signAuthEntry: contract.SignAuthEntry;
  };
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.network = this.configService.get<string>('network')

    const config = this.configService.get<StellarNetworkConfig>(`cronService.${this.network}`);
    const keypair = YieldController.Keypair.fromSecret(config.walletSecretKey);
    const nodeSigner = contract.basicNodeSigner(keypair, config.rpcUrl);
    this.signer = {
      signTransaction: nodeSigner.signTransaction,
      signAuthEntry: nodeSigner.signAuthEntry,
    };
    this.yieldDistributorClient = new YieldDistributor.Client({
      contractId: config.contracts.yieldDistributorId,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: config.walletPublicKey,
    });
    this.yieldControllerClient = new YieldController.Client({
      contractId: config.contracts.lendingYieldControllerId,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: config.walletPublicKey,
    });

    if (!this.yieldDistributorClient || !this.yieldControllerClient) {
      throw new Error('Contract clients are required');
    }
  }

  @Cron(process.env.CRON_EXPRESSION || CronExpression.EVERY_10_SECONDS)
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
      const timeRemaining = await this.getTimeBeforeNextDistribution();
      if (!(isDistributionAvailable && timeRemaining == 0)) {
        this.logger.debug('Distribution not yet available');
        const timeRemaining = await this.getTimeBeforeNextDistribution();
        this.logger.debug(`Time until next distribution: ${timeRemaining} seconds`);
        return;
      }

      this.logger.log('Distribution is available, claiming yield...');
      
      // Claim yield
      const claimedAmount = await this.claimYield();
      
      if (claimedAmount) {
        this.logger.log(`Successfully claimed yield: ${claimedAmount}`);
      } else {
        this.logger.warn('No yield was claimed');
      }
    } catch (error) {
      this.logger.error('Error during yield claim process:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async checkDistributionAvailability(): Promise<boolean> {
    try {
      const contractCall: contract.AssembledTransaction<boolean> = await this.yieldDistributorClient.is_distribution_available();
      return contractCall.result.valueOf();
    } catch (error) {
      this.logger.error('Error checking distribution availability:', error);
      throw error;
    }
  }

  async getTimeBeforeNextDistribution(): Promise<number> {
    try {
      const contractCall = await this.yieldDistributorClient.time_before_next_distribution();
      return Number(contractCall.result.valueOf());
    } catch (error) {
      this.logger.error('Error getting time before next distribution:', error);
      return 0;
    }
  }



  async claimYield(): Promise<string | undefined> {
    try {
      const claimOp = await this.yieldControllerClient.claim_yield({
      simulate: true 
      });
      if (claimOp.simulation) {
        if(rpc.Api.isSimulationError(claimOp.simulation)) {
          throw new Error(claimOp.simulation.error);
        }
        if (rpc.Api.isSimulationRestore(claimOp.simulation)) {
          await claimOp.restoreFootprint(claimOp.simulation.restorePreamble);
          return await this.claimYield(); // Recursive call after restore
        }
        if (rpc.Api.isSimulationSuccess(claimOp.simulation)) {
          const response = await claimOp.signAndSend({ signTransaction: this.signer.signTransaction });
          return response.sendTransactionResponse?.hash;
        }
      }
      return undefined;
    } catch (error) {
      this.logger.error('Error claiming yield:', error);
      throw error;
    }
  }

  async getDistributionDetails(): Promise<YieldDistributor.Distribution> {
    try {
      const contractCall: contract.AssembledTransaction<YieldDistributor.Distribution> = await this.yieldDistributorClient.get_distribution_info();
      return contractCall.result;
    } catch (error) { 
      this.logger.error('Error getting distribution info:', error);
      throw error;
    }
  }


  async getTreasuryShare(): Promise<string> {
    try {
      const contractCall: contract.AssembledTransaction<number> = await this.yieldDistributorClient.get_treasury_share();
      return parseFloat(((Number(contractCall.result.valueOf()) / 10000) * 100).toString()).toFixed(3);
    } catch (error) {
      this.logger.error('Error getting treasury share:', error);
      throw error;
    }
  }

  async getTotalDistributed(): Promise<string> {
    try {
      const contractCall = await this.yieldDistributorClient.get_total_distributed();
      return contractCall.result.valueOf().toString();
    } catch (error) {
      this.logger.error('Error getting total distributed:', error);
      throw error;
    }
  }

  async getDistributionPeriod(): Promise<string> {
    try {
      const contractCall = await this.yieldDistributorClient.get_distribution_period();
      return contractCall.result.valueOf().toString();
    } catch (error) {
      this.logger.error('Error getting distribution period:', error);
      throw error;
    }
  }

  async getNextDistributionTime(): Promise<string> {
    try {
      const contractCall = await this.yieldDistributorClient.get_next_distribution_time();
      return contractCall.result.valueOf().toString();
    } catch (error) {
      this.logger.error('Error getting next distribution time:', error);
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
        distributionDetails,
        treasuryShare,
        totalDistributed,
      ] = await Promise.all([
        this.checkDistributionAvailability(),
        this.getTimeBeforeNextDistribution(),
        this.getDistributionPeriod(),
        this.getNextDistributionTime(),
        this.getDistributionDetails(),
        this.getTreasuryShare(),
        this.getTotalDistributed(),
      ]);

      return {
        isAvailable,
        timeRemaining: Number(timeRemaining),
        distributionPeriod: Number(distributionPeriod),
        nextDistributionTime: Number(nextDistributionTime),
        distributionDetails,
        treasuryPercent: treasuryShare,
        totalDistributed: (BigInt(totalDistributed.toString()) / BigInt(10 ** 7)).toString(),
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