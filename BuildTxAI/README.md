# AirSwap Trading Interface

A decentralized trading interface leveraging Avalanche C-Chain and Flare Network for secure, AI-enhanced trading experiences.

## Backend Integration
```typescript
const BACKEND_API = 'https://github.com/vickytoriah/BuildTransaction_AI';
```

## System Architecture

### Trading Flow Algorithm

1. **User Input & Verification (Circle 1)**
   - User configures trade parameters:
     - Token pair selection
     - Trade type (Buy/Sell)
     - Amount
     - Slippage tolerance
   - System verifies against predefined limits:
     - Max balance: 10 AVAX
     - Max slippage: 1.5%
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Validates trade parameters and user wallet status
   ```

2. **Price Oracle Integration (Rectangle 1)**
   - Fetches real-time price data from Flare Network's FTSO
   - Displays current token balances and price feeds
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Integrates with:
   // - Avalanche C-Chain API
   // - Ethereum JSON-RPC
   // - Flare FTSO for price verification
   ```
   - Interactive AI Agent prompt for user queries
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Natural language processing for trade analysis
   ```

3. **AI Analysis (Square)**
   - Real-time market analysis:
     - Volatility patterns
     - Historical correlations
     - Liquidity depth
     - Gas optimization
     - Volume trends
     - Entry/exit points
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Processes market data and generates trading insights
   ```

4. **Trade Calculation (Diamond)**
   - On-chain function calls:
     - Amount verification
     - Minimum output calculation based on price feed (amount × current price)
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Calculates trade parameters and expected outputs
   ```

5. **Trade Verification (Rectangle 2)**
   - Wallet connection status
   - Token pair validation
   - Balance verification
   - Slippage checks
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Final verification through Flare Network
   ```

6. **Trade Execution (Triangle)**
   - Executes trade on Avalanche C-Chain
   ```typescript
   // Backend: https://github.com/vickytoriah/BuildTransaction_AI/
   // Handles transaction submission and monitoring
   ```

7. **Trade Confirmation (Final Circle)**
   - Transaction status
   - Hash verification
   - Gas fee details
   - Updated balances
   - Historical trade log

## Technical Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Web3 wallet integration (MetaMask, WalletConnect)

### Backend Integration
- RESTful API endpoints
- WebSocket connections for real-time updates
- Blockchain RPC calls

### Blockchain Networks
- Avalanche C-Chain for execution
- Flare Network for price oracles
- Ethereum compatibility layer

## Security Features

- Real-time price verification
- Multi-step trade validation
- Slippage protection
- Wallet verification
- Gas optimization

## Development Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables:
```env
BACKEND_API=https://github.com/vickytoriah/BuildTransaction_AI
AVALANCHE_RPC=...
FLARE_RPC=...
```
4. Start development server:
```bash
npm run dev
```

## Testing

```bash
npm run test
```

## Deployment

```bash
npm run build
npm run deploy
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Avalanche C-Chain
- Flare Network
- AirSwap Protocol
