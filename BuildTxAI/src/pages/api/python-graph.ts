import type { NextApiRequest, NextApiResponse } from 'next';
import { GraphData } from '@/types/graph';
import type { NextApiHandler } from 'next';
import Cors from 'cors';

// Initialize CORS middleware
const cors = Cors({
  methods: ['POST', 'OPTIONS'],
  origin: '*',
  optionsSuccessStatus: 200,
});

// Helper method to wait for middleware to execute
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

const handler: NextApiHandler = async (req, res) => {
  // Run the CORS middleware
  await runMiddleware(req, res, cors);

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      details: 'Only POST requests are accepted'
    });
  }

  try {
    const graphData: GraphData = req.body;

    // Basic validation
    if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
      throw new Error('Invalid nodes data');
    }

    if (!graphData.connections || !Array.isArray(graphData.connections)) {
      throw new Error('Invalid connections data');
    }

    // Process the data and return response
    const response = {
      success: true,
      data: {
        nodes: graphData.nodes,
        connections: graphData.connections,
        version: graphData.version || '1.0',
        timestamp: graphData.timestamp || Date.now()
      },
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        format: 'JSON',
        schema: 'graph-workflow',
        source: 'python-client'
      }
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error processing Python graph data:', error);
    return res.status(400).json({
      success: false,
      error: 'Failed to process graph data',
      details: error.message
    });
  }
};

export default handler; 