import { AppConfig } from './config.interface';
import { CronExpression } from '@nestjs/schedule';
import { Networks } from '@stellar/stellar-sdk';


export default (): AppConfig => ({
  env: process.env.NODE_ENV || 'development',
  network: process.env.NETWORK || 'TESTNET',
  port: parseInt(process.env.PORT, 10) || 3001,
  cronService: {
    TESTNET: {
      networkPassphrase: Networks.TESTNET,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      walletPublicKey: process.env.WALLET_PUBLIC_KEY,
      contracts: {
        yieldDistributorId: "CAAB7XXE6IEGP7J6XHDYBQD4KLV355Y3VRJ2ILW4WQ362NKTRXNLYTLF",
        lendingYieldControllerId: "CCKVEGGN3DFXHA7SAYLQAO2EHIMAVHT3UBPHQWPWQBDJNERO76JWS7UF",
      },
      cronExpression: CronExpression.EVERY_30_SECONDS,
    },
    PUBLIC: {
      networkPassphrase: Networks.PUBLIC,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-rpc.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      walletPublicKey: process.env.WALLET_PUBLIC_KEY,
      contracts: {
        yieldDistributorId: "",
        lendingYieldControllerId: "",
      },
      cronExpression: CronExpression.EVERY_30_SECONDS,
    },
  },
});
