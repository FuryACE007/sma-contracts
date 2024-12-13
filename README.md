# Tokenized Portfolio Management Platform

A blockchain-based platform that enables automated portfolio management through smart contracts. This PoC demonstrates how portfolio management can be simplified and automated using blockchain technology.

## Smart Contracts

### FundToken.sol

- ERC20 token representing different asset types (USDC, Real Estate, Private Equity)
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

- Deposit stablecoins (e.g., USDC)
- Automatic fund token minting based on portfolio weights
- Proportional withdrawals back to stablecoin
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
SEPOLIA_RPC_URL=your_sepolia_rpc_url
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

## Known Limitations & Future Improvements

### Security

- [ ] Implement emergency pause mechanism
- [ ] Add withdrawal limits and timeouts
- [ ] Separate custody from management logic
- [ ] Add multi-signature requirements for critical operations

### Liquidity Management

- [ ] Implement withdrawal queues
- [ ] Add liquidity checks before withdrawals
- [ ] Handle illiquid asset scenarios
- [ ] Add partial withdrawal functionality

### Portfolio Management

- [ ] Support for more complex rebalancing strategies
- [ ] Add batch operations for gas efficiency
- [ ] Implement fee structure
- [ ] Add portfolio performance tracking

### User Experience

- [ ] Add detailed portfolio value calculations
- [ ] Implement events for better tracking
- [ ] Add historical performance data
- [ ] Support for multiple stablecoins

### Technical Improvements

- [ ] Implement proxy pattern for upgradability
- [ ] Add comprehensive test coverage
- [ ] Optimize gas usage in rebalancing
- [ ] Add formal verification
