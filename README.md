# Yield Claimer Service

A NestJS service that automatically claims yield from the CoopStable lending protocol when yield distribution is available.

## Features

- **Automated Yield Claiming**: Runs a cron job that monitors the yield distributor contract and automatically claims yield when distribution is available
- **Stellar Integration**: Built with Stellar SDK for seamless blockchain interactions
- **Health Monitoring**: Provides REST endpoints to check service status and distribution information
- **Manual Triggering**: Allows manual yield claiming via API endpoint

## Prerequisites

- Node.js 20.x or higher
- PNPM 10.11.1 or higher
- Docker and Docker Compose (for containerized deployment)
- Stellar wallet with appropriate permissions

## Installation

### Local Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd yield-claimer
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Stellar Network Configuration
NETWORK=TESTNET  # or PUBLIC for mainnet

# Wallet Configuration (Required)
WALLET_SECRET_KEY=your_wallet_secret_key
WALLET_PUBLIC_KEY=your_wallet_public_key
```

### Running Locally

**Development mode** (with hot-reload):
```bash
pnpm start:dev
```

**Production mode**:
```bash
pnpm build
pnpm start:prod
```

**Debug mode**:
```bash
pnpm start:debug
```

## Docker Setup

### Using Docker Compose (Recommended)

1. Create a `.env` file with your configuration (see above)

2. Build and run the container:
```bash
docker-compose up -d
```

3. View logs:
```bash
docker-compose logs -f yield-claimer
```

4. Stop the service:
```bash
docker-compose down
```

### Using Docker directly

1. Build the image:
```bash
docker build -t yield-claimer .
```

2. Run the container:
```bash
docker run -d \
  --name yield-claimer \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e NETWORK=TESTNET \
  -e WALLET_SECRET_KEY=your_secret_key \
  -e WALLET_PUBLIC_KEY=your_public_key \
  yield-claimer
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /yield-claimer/status` - Get current distribution status
- `POST /yield-claimer/claim` - Manually trigger yield claim

### Example API Usage

**Check service health:**
```bash
curl http://localhost:3001/health
```

**Get distribution status:**
```bash
curl http://localhost:3001/yield-claimer/status
```

**Manually trigger claim:**
```bash
curl -X POST http://localhost:3001/yield-claimer/claim
```

## How it Works

1. The service runs a cron job (default: every 12 hours, configurable)
2. Checks if yield distribution is available via `is_distribution_available()` on the yield distributor contract
3. If available, calls `claim_yield()` on the lending yield controller contract
4. The contract automatically:
   - Claims yield from lending protocols
   - Issues cUSD tokens to the distributor
   - Distributes tokens to members and treasury
   - Updates distribution timestamps

## Contract Addresses

### Testnet
- Yield Distributor: `CDUZHDM7EBTK7MSHAFJH57UXCBUXEJ6AAL555Y2P7ZQDJKAH4POGD3VW`
- Lending Yield Controller: `CAAKQRIPSVYCLM2JRJPAMIDUHN47VQPV7YI3RGT2C7HNJ45H7XZIK3F5`

### Mainnet
Configure these in your environment or update `src/config/config.ts`

## Development Commands

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov
```

## Monitoring

The service logs all operations and provides detailed status information through the REST API. Use the `/yield-claimer/status` endpoint to monitor:
- Distribution availability
- Time until next distribution
- Current distribution round
- Total members
- Treasury share percentage
- Total distributed amount

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure the service is running and the port is not blocked
2. **Invalid wallet keys**: Verify your Stellar wallet keys are correct
3. **Contract not found**: Ensure you're using the correct network (TESTNET/PUBLIC)

### Docker Issues

- If the container exits immediately, check logs: `docker-compose logs yield-claimer`
- Ensure all required environment variables are set in `.env`
- Verify Docker daemon is running

## License
MIT License