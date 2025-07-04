import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Transaction,
  scValToNative,
  xdr,
  Contract,
  Address,
  rpc
} from '@stellar/stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: rpc.Server;
  private keypair: Keypair;
  private network: string;
  private networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {} 

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('stellar.rpcUrl');
    const walletSecretKey = this.configService.get<string>('stellar.walletSecretKey');
    const network = this.configService.get<string>('stellar.network');

    if (!walletSecretKey) {
      throw new Error('WALLET_SECRET_KEY is required');
    }

    this.server = new rpc.Server(rpcUrl);
    this.keypair = Keypair.fromSecret(walletSecretKey);
    this.network = network === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;
    this.networkPassphrase = network === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;

    this.logger.log(`Connected to Stellar ${network} network`);
    this.logger.log(`Wallet address: ${this.keypair.publicKey()}`);
  }

  async getAccount() {
    return await this.server.getAccount(this.keypair.publicKey());
  }

  async callContract(
    contractId: string,
    method: string,
    ...params: any[]
  ): Promise<any> {
    try {
      const contract = new Contract(contractId);
      const account = await this.getAccount();

      const transaction = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call(method, ...params))
        .setTimeout(30)
        .build();

      const simulated = await this.server.simulateTransaction(transaction);

      if (rpc.Api.isSimulationError(simulated)) {
        throw new Error(`Simulation failed: ${simulated.error}`);
      }

      const prepared = await this.server.prepareTransaction(transaction);
      prepared.sign(this.keypair);

      const response = await this.server.sendTransaction(prepared);
      
      if (response.status === 'PENDING') {
        const result = await this.waitForTransaction(response.hash);
        
        if (result.status === 'SUCCESS') {
          const returnValue = result.returnValue;
          return returnValue ? scValToNative(returnValue) : null;
        } else {
          throw new Error(`Transaction failed: ${result.status}`);
        }
      } else {
        throw new Error(`Failed to submit transaction: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Error calling contract ${contractId}.${method}:`, error);
      throw error;
    }
  }

  async simulateContract(
    contractId: string,
    method: string,
    ...params: any[]
  ): Promise<any> {
    try {
      const contract = new Contract(contractId);
      const account = await this.getAccount();

      const transaction = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call(method, ...params))
        .setTimeout(30)
        .build();

      const simulated = await this.server.simulateTransaction(transaction);

      if (rpc.Api.isSimulationSuccess(simulated)) {
        const result = simulated.result;
        return result ? scValToNative(result.retval) : null;
      } else {
        throw new Error(`Simulation failed: ${simulated.error}`);
      }
    } catch (error) {
      this.logger.error(`Error simulating contract ${contractId}.${method}:`, error);
      throw error;
    }
  }

  private async waitForTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
    let response: rpc.Api.GetTransactionResponse;
    let attempts = 0;
    const maxAttempts = 30;

    do {
      response = await this.server.getTransaction(hash);
      
      if (response.status === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    } while (response.status === 'NOT_FOUND' && attempts < maxAttempts);

    if (response.status === 'NOT_FOUND') {
      throw new Error('Transaction not found after maximum attempts');
    }

    return response;
  }
}