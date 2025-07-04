# Yield Claimer Service

A NestJS service that automatically claims yield from the CoopStable lending protocol when yield distribution is available.

## Features

- **Automated Yield Claiming**: Runs a cron job that monitors the yield distributor contract and automatically claims yield when distribution is available
- **Stellar Integration**: Built with Stellar SDK for seamless blockchain interactions
- **Health Monitoring**: Provides REST endpoints to check service status and distribution information
- **Manual Triggering**: Allows manual yield claiming via API endpoint

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Stellar Network Configuration
STELLAR_NETWORK=TESTNET
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Contract Addresses
YIELD_DISTRIBUTOR_CONTRACT_ID=your_yield_distributor_contract_id
LENDING_YIELD_CONTROLLER_CONTRACT_ID=your_lending_yield_controller_contract_id

# Wallet Configuration
WALLET_SECRET_KEY=your_wallet_secret_key

# Cron Configuration
CRON_EXPRESSION=*/30 * * * * *  # Every 30 seconds for testing
```

## Installation

```bash
pnpm install
```

## Running the Service

```bash
# Development
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

## API Endpoints

- `GET /yield-claimer/status` - Get current distribution status
- `POST /yield-claimer/claim` - Manually trigger yield claim
- `GET /yield-claimer/health` - Health check endpoint

## How it Works

1. The service runs a cron job (configurable interval)
2. Checks if yield distribution is available via `is_distribution_available()` on the yield distributor contract
3. If available, calls `claim_yield()` on the lending yield controller contract
4. The contract automatically:
   - Claims yield from lending protocols
   - Issues cUSD tokens to the distributor
   - Distributes tokens to members and treasury
   - Updates distribution timestamps

## Monitoring

The service logs all operations and provides detailed status information through the REST API. Use the `/status` endpoint to monitor:
- Distribution availability
- Time until next distribution
- Current distribution round
- Total members
- Treasury share percentage
- Total distributed amount