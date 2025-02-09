import type { NextApiRequest, NextApiResponse } from 'next';
import { GraphData } from '@/types/graph';
import cors from 'cors';

// Initialize CORS middleware
const initMiddleware = (middleware: any) => {
  return (req: NextApiRequest, res: NextApiResponse) =>
    new Promise((resolve, reject) => {
      middleware(req, res, (result: any) => {
        if (result instanceof Error) {
          return reject(result);
        }
        return resolve(result);
      });
    });
};

const corsMiddleware = initMiddleware(
  cors({
    methods: ['POST'],
    origin: '*', // Configure this based on your security requirements
    optionsSuccessStatus: 200
  })
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  await corsMiddleware(req, res);

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
} 