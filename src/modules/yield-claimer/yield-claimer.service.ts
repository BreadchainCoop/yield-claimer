import { StellarNetworkConfig } from '@/config/config.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { rpc, contract } from '@stellar/stellar-sdk';
import * as YieldDistributor from '@/packages/yield_distributor/src';
import * as YieldController from '@/packages/lending_yield_controller/src';

/** Contract error codes from lending_yield_controller */
const ContractErrors: Record<number, string> = {
  1000: 'The specified asset is not supported by this protocol.',
  1001: 'Yield is currently unavailable for this protocol/asset.',
  1002: 'No pending harvest exists. You must run harvest_yield before recompounding.',
  1003: 'A harvest is already in progress for this protocol/asset.',
  1004: 'Invalid harvest state for this operation.',
  1005: 'No yield available to harvest at this time. The protocol has not accumulated any yield since the last harvest.',
};

/** Extract contract error code from Soroban HostError message */
function getContractErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Error\(Contract, #(\d+)\)/);
  if (match) {
    const code = parseInt(match[1], 10);
    return ContractErrors[code] ?? null;
  }
  return null;
}

@Injectable()
export class YieldClaimerService {
  private readonly logger = new Logger(YieldClaimerService.name);
  private readonly network: string;
  private readonly yieldDistributorClient: YieldDistributor.Client;
  private readonly yieldControllerClient: YieldController.Client;
  private readonly protocol: string;
  private readonly assetId: string;
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
    this.protocol = config.contracts.protocol;
    this.assetId = config.contracts.assetId;
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

  @Cron(process.env.CRON_EXPRESSION || CronExpression.EVERY_DAY_AT_MIDNIGHT)
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



  /**
   * Executes the 3-stage yield claiming process:
   * 1. harvest_yield - Withdraw yield from the lending protocol
   * 2. recompound_yield - Re-deposit yield back to the protocol
   * 3. finalize_distribution - Issue cUSD and distribute to members
   *
   * Note: Soroban smart contract transactions can only have ONE operation per transaction,
   * so these must be executed sequentially rather than bundled.
   */
  async claimYield(): Promise<string | undefined> {
    let finalizeResult: string | undefined;

    // Stage 1: Harvest yield (withdraw from protocol)
    try {
      this.logger.log('Stage 1: Harvesting yield from protocol...');
      const harvestResult = await this.executeContractCall(
        () => this.yieldControllerClient.harvest_yield({
          protocol: this.protocol,
          asset: this.assetId,
        }, { simulate: true }),
        'harvest_yield'
      );
      this.logger.log(`Harvest complete. TX: ${harvestResult}`);
    } catch (error) {
      const friendlyMessage = getContractErrorMessage(error);
      if (friendlyMessage) {
        this.logger.warn(`Stage 1 (harvest_yield): ${friendlyMessage}`);
      } else {
        this.logger.error('Stage 1 (harvest_yield) failed:', error);
      }
    }

    // Stage 2: Recompound yield (re-deposit to protocol)
    try {
      this.logger.log('Stage 2: Recompounding yield...');
      const recompoundResult = await this.executeContractCall(
        () => this.yieldControllerClient.recompound_yield({
          protocol: this.protocol,
          asset: this.assetId,
        }, { simulate: true }),
        'recompound_yield'
      );
      this.logger.log(`Recompound complete. TX: ${recompoundResult}`);
    } catch (error) {
      const friendlyMessage = getContractErrorMessage(error);
      if (friendlyMessage) {
        this.logger.warn(`Stage 2 (recompound_yield): ${friendlyMessage}`);
      } else {
        this.logger.error('Stage 2 (recompound_yield) failed:', error);
      }
    }

    // Stage 3: Finalize distribution (issue cUSD and distribute)
    try {
      this.logger.log('Stage 3: Finalizing distribution...');
      finalizeResult = await this.executeContractCall(
        () => this.yieldControllerClient.finalize_distribution({
          protocol: this.protocol,
          asset: this.assetId,
        }, { simulate: true }),
        'finalize_distribution'
      );
      this.logger.log(`Distribution finalized. TX: ${finalizeResult}`);
    } catch (error) {
      const friendlyMessage = getContractErrorMessage(error);
      if (friendlyMessage) {
        this.logger.warn(`Stage 3 (finalize_distribution): ${friendlyMessage}`);
      } else {
        this.logger.error('Stage 3 (finalize_distribution) failed:', error);
      }
    }

    return finalizeResult;
  }

  /**
   * Helper method to execute a contract call with simulation, restore footprint handling,
   * and signing. Handles the common pattern for all Soroban contract interactions.
   */
  private async executeContractCall<T>(
    contractCallFn: () => Promise<contract.AssembledTransaction<T>>,
    operationName: string,
  ): Promise<string | undefined> {
    const assembledTx = await contractCallFn();

    if (!assembledTx.simulation) {
      throw new Error(`${operationName}: No simulation result`);
    }

    if (rpc.Api.isSimulationError(assembledTx.simulation)) {
      throw new Error(`${operationName}: ${assembledTx.simulation.error}`);
    }

    if (rpc.Api.isSimulationRestore(assembledTx.simulation)) {
      this.logger.log(`${operationName}: Restoring footprint...`);
      await assembledTx.restoreFootprint(assembledTx.simulation.restorePreamble);
      // Retry the operation after restore
      return this.executeContractCall(contractCallFn, operationName);
    }

    if (rpc.Api.isSimulationSuccess(assembledTx.simulation)) {
      const response = await assembledTx.signAndSend({
        signTransaction: this.signer.signTransaction
      });
      return response.sendTransactionResponse?.hash;
    }

    return undefined;
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