import { AppConfig } from './config.interface';
import { CronExpression } from '@nestjs/schedule';
import { Networks } from '@stellar/stellar-sdk';


export default (): AppConfig => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  cronService: {
    TESTNET: {
      network: Networks.TESTNET,
      networkPassphrase: Networks.TESTNET,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      contracts: {
        yieldDistributorId: "CDLEO6XBWKCNPJRSYQEX4ZUATUT54RKDLSJAKDZ2QVBL56CGHBRGWYHH",
        lendingYieldControllerId: "CAEQUODVDMLFBWIIIX57YVJPEB44HZO3NSSKBWU2JTBI3HJP6RFNQNEF",
      },
      cronExpression: CronExpression.EVERY_30_SECONDS,
    },
    PUBLIC: {
      network: Networks.PUBLIC,
      networkPassphrase: Networks.PUBLIC,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-rpc.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      contracts: {
        yieldDistributorId: "",
        lendingYieldControllerId: "",
      },
      cronExpression: CronExpression.EVERY_30_SECONDS,
    },
  },
});
