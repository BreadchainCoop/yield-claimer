import { AppConfig } from './config.interface';
import { CronExpression } from '@nestjs/schedule';
import { Networks } from '@stellar/stellar-sdk';


export default (): AppConfig => ({
  env: process.env.NODE_ENV || 'development',
  network: process.env.NETWORK?.toUpperCase() || 'TESTNET',
  port: parseInt(process.env.PORT, 10) || 3001,
  cronService: {
    TESTNET: {
      networkPassphrase: Networks.TESTNET,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      walletPublicKey: process.env.WALLET_PUBLIC_KEY,
      contracts: {
        yieldDistributorId: "CB5Q45PDLKT2DIVCCWPQZHM5IRNAISXO6CYYFLTXQNVKJMO3R7P57KTL",
        lendingYieldControllerId: "CDQ4ZR3JPDKKH3UYI76L5AQWQ22L55ALICUS3V7HP4KX7IFNX3EVKYN4",
        protocol: "BC_LA",
        assetId: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
      },
      cronExpression: CronExpression.EVERY_MINUTE,
    },
    PUBLIC: {
      networkPassphrase: Networks.PUBLIC,
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com',
      walletSecretKey: process.env.WALLET_SECRET_KEY,
      walletPublicKey: process.env.WALLET_PUBLIC_KEY,
      contracts: {
        yieldDistributorId: "CA2BNJFVCRJWCWLLOMJ3E3A62XMZ43U4K7RC6WVBOFC7RPYOJAH5BJVH",
        lendingYieldControllerId:"CAIYIGHOUS5CG5MYNW4TPOW635ZLXIBEFFXJ6J4Z5ZBO3UC344VZRP3N",
        protocol: "BC_LA",
        assetId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      },
      cronExpression: CronExpression.EVERY_DAY_AT_MIDNIGHT,
    },
  },
});
