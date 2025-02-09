export interface GraphMetadata {
  id: string;
  type: 'circle' | 'rectangle' | 'square' | 'diamond' | 'triangle';
  position: {
    x: number;
    y: number;
  };
  data?: {
    // First circle (User)
    tokenPair?: string;
    tradeType?: 'Buy' | 'Sell';
    tradeAmount?: string;
    slippageTolerance?: string;
    walletAddress?: string;
    network?: string;

    // First rectangle (On Chain Data)
    userPrompt?: string;
    transactionHistory?: string[];
    tokenBalances?: {
      [key: string]: number;
    };
    priceFeeds?: {
      [key: string]: number;
    };

    // Square (AI Prompts)
    aiPrompts?: string[];

    // Diamond (Trade Details)
    tradeDetails?: {
      tokenPair: string;
      direction: string;
      amount: string;
      minimumOutput: string;
    };

    // Second rectangle (Verification)
    verificationStatus?: {
      walletConnected: boolean;
      tokenPairValid: boolean;
      sufficientBalance: boolean;
      slippageWithinLimits: boolean;
    };

    // Triangle (Trade Confirmation)
    tradeConfirmation?: {
      status: string;
      transactionHash: string;
      gasFees: string;
      updatedBalances: {
        [key: string]: number;
      };
      historicalTrades: string[];
    };
  };
}

export interface GraphConnection {
  id: string;
  sourceId: string;
  targetId: string | null;
}

export interface GraphData {
  nodes: GraphMetadata[];
  connections: GraphConnection[];
  version: string;
  timestamp: number;
}

export interface BalanceCheck {
  hasBalance: boolean;
  balance: string;
  requiredAmount: string;
}

export interface SlippageCheck {
  withinLimits: boolean;
  currentSlippage: string;
  maxSlippage: string;
  recommendedSlippage: string;
}

export interface VerificationData {
  walletConnected: boolean;
  tokenPairValid: boolean;
  balanceCheck: BalanceCheck;
  slippageCheck: SlippageCheck;
}

export interface VerificationResponse {
  success: boolean;
  data: VerificationData;
  error?: string;
} 