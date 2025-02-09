import type { NextApiRequest, NextApiResponse } from 'next';
import { GraphData, VerificationResponse } from '@/types/graph';
import Cors from 'cors';

const cors = Cors({
  methods: ['POST', 'OPTIONS'],
  origin: '*',
  optionsSuccessStatus: 200,
});

// Default hardcoded limits
const DEFAULT_LIMITS = {
  maxBalance: "200 AVAX",
  maxSlippage: "2%",
  recommendedSlippage: "0.5%"
};

function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (req: NextApiRequest, res: NextApiResponse, next: (result: any) => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, cors);

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { 
      walletAddress, 
      tokenPair, 
      tradeAmount, 
      slippageTolerance,
      externalLimits,
      verificationResults 
    } = req.body;

    // Use external limits if provided, otherwise use defaults
    const activeLimits = {
      maxBalance: externalLimits?.maxBalance || DEFAULT_LIMITS.maxBalance,
      maxSlippage: externalLimits?.maxSlippage || DEFAULT_LIMITS.maxSlippage,
      recommendedSlippage: externalLimits?.recommendedSlippage || DEFAULT_LIMITS.recommendedSlippage
    };

    // Parse numeric values for comparison
    const tradeAmountNum = parseFloat(tradeAmount.split(' ')[0]);
    const maxBalanceNum = parseFloat(activeLimits.maxBalance.split(' ')[0]);
    const slippageNum = parseFloat(slippageTolerance);
    const maxSlippageNum = parseFloat(activeLimits.maxSlippage);

    const hasBalance = tradeAmountNum <= maxBalanceNum;
    const slippageWithinLimits = slippageNum <= maxSlippageNum;

    const verificationResponse: VerificationResponse = {
      success: true,
      data: {
        walletConnected: !!walletAddress,
        tokenPairValid: true,
        balanceCheck: {
          hasBalance,
          balance: activeLimits.maxBalance,
          requiredAmount: tradeAmount
        },
        slippageCheck: {
          withinLimits: slippageWithinLimits,
          currentSlippage: slippageTolerance,
          maxSlippage: activeLimits.maxSlippage,
          recommendedSlippage: activeLimits.recommendedSlippage
        }
      }
    };

    return res.status(200).json(verificationResponse);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: 'Verification failed',
      details: error.message
    });
  }
};

export default handler; 