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
        yieldDistributorId: "CDUZHDM7EBTK7MSHAFJH57UXCBUXEJ6AAL555Y2P7ZQDJKAH4POGD3VW",
        lendingYieldControllerId: "CAAKQRIPSVYCLM2JRJPAMIDUHN47VQPV7YI3RGT2C7HNJ45H7XZIK3F5",
      },
      cronExpression: CronExpression.EVERY_12_HOURS,
    },
    PUBLIC: {
      networkPassphrase: Networks.PUBLIC,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-rpc.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      walletPublicKey: process.env.WALLET_PUBLIC_KEY,
      contracts: {
        yieldDistributorId: "CDRAYSJCXZRHGHSKL6HNXSPXJFLI3W3BPHYSPRJ4XJPY2IDMIT5M6WML",
        lendingYieldControllerId:"CB2RILXU4W7EO7TDHAQMU6CXMSMSK7WIICKOB2BDFBYBF6K5XEYN335D",
      },
      cronExpression: CronExpression.EVERY_DAY_AT_MIDNIGHT,
    },
  },
});
