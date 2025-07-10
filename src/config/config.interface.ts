export interface AppConfig {
  env: string;
  port: number;
  cronService: ServiceConfig;
  network: string;
}

export interface StellarNetworkConfig {
  networkPassphrase: string;
  rpcUrl: string;
  walletSecretKey: string;
  walletPublicKey: string;
  contracts: ContractsConfig;
  cronExpression: string;
}

export interface ServiceConfig {
  TESTNET: StellarNetworkConfig;
  PUBLIC: StellarNetworkConfig;
}

export interface ContractsConfig {
  yieldDistributorId: string;
  lendingYieldControllerId: string;
}
