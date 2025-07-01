# Tokenized Portfolio Management Platform

A blockchain-based platform that enables automated portfolio management through smart contracts. This PoC demonstrates how portfolio management can be simplified and automated using blockchain technology.

## Smart Contracts

### FundToken.sol

- ERC20 token representing different asset types (CASH, Real Estate, Private Equity)
- Custom decimals support for different asset types
- Controlled minting/burning for portfolio rebalancing
- Owner-only operations for fund management

### ModelPortfolioManager.sol

- Creates and manages model portfolios with predefined allocations
- Supports multiple funds with custom weight distributions
- Validates total weights equal 100% (10000 basis points)
- Links to investor portfolio managers for automated rebalancing

### InvestorPortfolioManager.sol

- Manages individual investor portfolios
- Handles deposits and withdrawals in stablecoin
- Automatic portfolio rebalancing
- Tracks investor positions and portfolio values

## Key Features

### Portfolio Management

- Create model portfolios with custom allocations
- Assign portfolios to investors
- Update portfolio weights triggering automatic rebalancing
- View portfolio values and compositions

### Investment Operations

- Deposit funds directly
- Automatic fund token minting based on portfolio weights
- Proportional withdrawals
- Real-time portfolio rebalancing

## Setup & Deployment

### Prerequisites

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```bash
PRIVATE_KEY_2=your_wallet_private_key
BUILD_BEAR_RPC_URL=https://rpc.buildbear.io/your_buildbear_endpoint
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Deploy Contracts

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

OR

```bash
npx hardhat run scripts/deploy.ts --network hardhat
```


