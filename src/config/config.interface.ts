export interface AppConfig {
  env: string;
  port: number;
  cronService: ServiceConfig;
}

export interface StellarNetworkConfig {
  network: string;
  networkPassphrase: string;
  rpcUrl: string;
  walletSecretKey: string;
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
