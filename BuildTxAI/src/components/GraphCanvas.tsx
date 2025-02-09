'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { ethers } from 'ethers';
import { GraphMetadata, GraphConnection, GraphData } from '@/types/graph';
import type { VerificationData } from '@/types/graph';

// Add diamond to the shape types
type ShapeType = 'circle' | 'rectangle' | 'square' | 'diamond' | 'triangle';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  address?: string;
  type: ShapeType;
  label?: string;
  width: number;
  height: number;
  data?: {
    verificationStatus?: {
      walletConnected: boolean;
      tokenPairValid: boolean;
      balanceCheck?: {
        hasBalance: boolean;
      };
      slippageCheck?: {
        withinLimits: boolean;
      };
    };
  };
}

interface Arrow {
  id: string;
  startNodeId: string;
  endNodeId: string | null;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface EthereumWindow extends Window {
  ethereum?: {
    isMetaMask?: boolean;
    isPhantom?: boolean;
    request: (request: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, callback: (params: any) => void) => void;
    removeListener: (event: string, callback: (params: any) => void) => void;
  };
}

interface WalletState {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
}

// Add this interface for token addresses
const TOKEN_ADDRESSES: { [key: string]: string } = {
  RLUSD: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // Replace with actual RLUSD address
  // Add other token addresses as needed
};

// Add this ABI for ERC20 tokens
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Add this near other constants
const PRICE_RANGE = {
  min: 2650,
  max: 2750
};

// Add this constant at the top with other constants
const STATIC_PRICE = 2700; // Middle of range 2650-2750 for static display

const GraphCanvas: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [activeElement, setActiveElement] = useState<{
    nodeId: string | null;
    panel: boolean;
    arrow: boolean;
  }>({ nodeId: null, panel: false, arrow: false });
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredArrow, setHoveredArrow] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('circle');
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [connectionStartNode, setConnectionStartNode] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState<string | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const LOADING_DURATION = 1000; // 1 second for receiver loading
  const PROGRESS_INTERVAL = 50; // Keep update interval at 50ms for smooth animation
  const [showTransactionPanel, setShowTransactionPanel] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<{
    [key: string]: {
      action: string; // FUCKING GET THE FUCK BACK TO THIS LATER FUCKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      transactionType: string;
      tokenUnits: string;
      gasLimit: string;
      estimatedGas: string;
    };
  }>({});
  const [highlightedSquare, setHighlightedSquare] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [tempArrowPos, setTempArrowPos] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showReceiverPanel, setShowReceiverPanel] = useState<string | null>(null);
  const [receiverDetails, setReceiverDetails] = useState<{
    [key: string]: {
      address: string;
      amount: string;
    };
  }>({});
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState('ETH');
  const [arrowStartNode, setArrowStartNode] = useState<string | null>(null);
  const [tempTargetPoint, setTempTargetPoint] = useState<{ x: number; y: number } | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({
    provider: null,
    signer: null
  });
  const wcProviderRef = useRef<any>(null);
  const TICKERS = [
    'ETH',
    'USDT',
    'USDC',
    'DAI',
    'WETH',
    'WBTC',
    'UNI',
    'LINK'
  ];
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [autoAlignTarget, setAutoAlignTarget] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const HOLD_DURATION = 1000; // 1 second hold to show menu

  // Update default limits
  const DEFAULT_LIMITS = {
    maxBalance: "0.1 ETH",
    maxSlippage: "1.5%",
    recommendedSlippage: "1%"
  };

  // Update trade config state
  const [tradeConfig, setTradeConfig] = useState({
    tokenPair: "ETH/RLUSD",
    tradeType: "Buy",
    tradeAmount: "0.02 ETH", // Changed from 0.1 to 0.02
    slippageTolerance: "1%" // Changed from 1.5% to 1%
  });

  // Add this for temporary form values
  const [tempTradeConfig, setTempTradeConfig] = useState({...tradeConfig});

  useEffect(() => {
    if (hoveredArrow) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
          setSelectedShape('square');
        } else if (e.key === 'ArrowLeft') {
          setSelectedShape('circle');
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleShapeClick(selectedShape);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [hoveredArrow, selectedShape]);

  useEffect(() => {
    if (showTransactionPanel) {
      const panel = document.getElementById(`transaction-panel-${showTransactionPanel}`);
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        if (rect.bottom > viewportHeight) {
          panel.style.maxHeight = `${viewportHeight - rect.top - 20}px`; // 20px padding from bottom
          panel.style.overflowY = 'auto';
        }
      }
    }
  }, [showTransactionPanel]);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (showTransactionPanel) {
        const panel = document.getElementById(`transaction-panel-${showTransactionPanel}`);
        const square = document.getElementById(`square-${showTransactionPanel}`);
        
        if (panel && square && 
            !panel.contains(e.target as Node) && 
            !square.contains(e.target as Node)) {
          setShowTransactionPanel(null);
          setHighlightedSquare(null);
          setLoadingProgress(0);
        }
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [showTransactionPanel]);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (showReceiverPanel) {
        const panel = document.getElementById(`receiver-panel-${showReceiverPanel}`);
        const circle = document.getElementById(`circle-${showReceiverPanel}`);
        
        if (panel && circle && 
            !panel.contains(e.target as Node) && 
            !circle.contains(e.target as Node)) {
          setShowReceiverPanel(null);
          setLoadingProgress(0);
        }
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [showReceiverPanel]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && walletAddress && walletState.provider) {
        try {
          if (selectedTicker === 'ETH' || selectedTicker === 'AVAX') {
            const balance = await walletState.provider.getBalance(walletAddress);
            const formattedBalance = ethers.utils.formatEther(balance);
            setWalletBalance(`${parseFloat(formattedBalance).toFixed(4)} ${selectedTicker}`);
          } else if (TOKEN_ADDRESSES[selectedTicker]) {
            const tokenContract = new ethers.Contract(
              TOKEN_ADDRESSES[selectedTicker],
              ERC20_ABI,
              walletState.provider
            );
            const [balance, decimals] = await Promise.all([
              tokenContract.balanceOf(walletAddress),
              tokenContract.decimals(),
            ]);
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            setWalletBalance(`${parseFloat(formattedBalance).toFixed(2)} ${selectedTicker}`);
          } else {
            setWalletBalance(`0.00 ${selectedTicker}`);
          }
        } catch (error) {
          console.error("Error fetching balance:", error);
          setWalletBalance(`0.00 ${selectedTicker}`);
        }
      }
    };

    fetchBalance();
  }, [isConnected, walletAddress, walletState.provider, selectedTicker]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && arrowStartNode) {
        setArrowStartNode(null);
        setTempArrowPos(null);
        setTempTargetPoint(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [arrowStartNode]);

  const handleShapeClick = (shapeType: 'circle' | 'square' | 'rectangle' | 'triangle' | 'diamond', startNodeId?: string) => {
    // Add rectangle validation
    if (shapeType === 'rectangle' && nodes.filter(node => node.type === 'rectangle').length >= 2) {
      return;
    }

    // Only allow 2 circles
    if (shapeType === 'circle' && nodes.filter(node => node.type === 'circle').length >= 2) {
      return;
    }

    // Only allow 1 square
    if (shapeType === 'square' && nodes.filter(node => node.type === 'square').length >= 1) {
      return;
    }

    // Only allow 1 triangle
    if (shapeType === 'triangle' && nodes.filter(node => node.type === 'triangle').length >= 1) {
      return;
    }

    const startNode = startNodeId ? nodes.find(n => n.id === startNodeId) : null;
    const HORIZONTAL_OFFSET = 150;
    const DIAMOND_SIZE = 64; // Size for diamond shape

    const newNode: GraphNode = {
      id: `node-${Date.now()}`,
      x: startNode ? startNode.x + HORIZONTAL_OFFSET : window.innerWidth / 2,
      y: startNode ? startNode.y : window.innerHeight / 2,
      type: shapeType,
      width: shapeType === 'rectangle' ? 160 : 
             shapeType === 'diamond' ? DIAMOND_SIZE : 64,
      height: shapeType === 'rectangle' ? 48 : 
              shapeType === 'diamond' ? DIAMOND_SIZE : 64,
      label: shapeType === 'triangle' ? 'Receiver' : 'Sender',
      ...(shapeType === 'circle' && {
        address: `0x${Math.random().toString(16).slice(2, 10)}...`
      })
    };
    
    setNodes(prev => [...prev, newNode]);

    // Create arrow from source node to new node if startNodeId exists
    if (startNode) {
      let startX = startNode.x;
      let startY = startNode.y;
      let endX = newNode.x;
      let endY = newNode.y;

      // Adjust start point for square when creating a circle
      if (startNode.type === 'square' && shapeType === 'circle') {
        startX = startNode.x + 32; // Start from right side of square
        startY = startNode.y; // Center height
      } else if (startNode.type === 'square') {
        startX = startNode.x; // Default square position for other shapes
        startY = startNode.y - 32; // Top of square for triangle
      } else if (startNode.type === 'circle' && shapeType === 'square') {
        startX = startNode.x + 32; // Start from right side of circle
        startY = startNode.y; // Center height
      }

      // Adjust end point for all shapes
      if (newNode.type === 'circle') {
        endX = newNode.x - 32; // Connect to left side of circle
        endY = newNode.y; // Center height
      } else if (newNode.type === 'triangle') {
        endX = newNode.x; // Center of triangle
        endY = newNode.y + 24; // Bottom of triangle
      } else if (newNode.type === 'square') {
        endX = newNode.x - 32; // Connect to left side of square
        endY = newNode.y; // Center height
      }

      const newArrow: Arrow = {
        id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startNodeId: startNodeId!,
        endNodeId: newNode.id,
        startX,
        startY,
        endX,
        endY
      };
      setArrows(prev => [...prev, newArrow]);
    }

    // Update arrow connections for rectangles
    if (startNode && shapeType === 'rectangle') {
      let startX = startNode.x + 32; // Start from right side of square
      let startY = startNode.y; // Center height
      let endX = newNode.x - (newNode.width / 2); // Connect to left side of rectangle
      let endY = newNode.y; // Center height
      
      const newArrow: Arrow = {
        id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startNodeId: startNodeId!,
        endNodeId: newNode.id,
        startX,
        startY,
        endX,
        endY
      };
      setArrows(prev => [...prev, newArrow]);
    }
  };

  const handleMouseDown = (nodeId: string) => {
    if (isHolding) {
      setIsDrawingArrow(true);
      setArrowStartNode(nodeId);
    } else {
      setDraggedNode(nodeId);
      // Only start loading if not dragging
      const startPos = nodes.find(n => n.id === nodeId);
      const initialPos = { x: startPos?.x || 0, y: startPos?.y || 0 };
      
      const checkDragging = (currentPos: { x: number, y: number }) => {
        const distance = Math.sqrt(
          Math.pow(currentPos.x - initialPos.x, 2) + 
          Math.pow(currentPos.y - initialPos.y, 2)
        );
        
        if (distance < 5) { // If barely moved, start loading
          setLoadingNode(nodeId);
          setLoadingProgress(0);
          
          progressInterval.current = setInterval(() => {
            setLoadingProgress(prev => {
              if (prev >= 100) {
                if (progressInterval.current) {
                  clearInterval(progressInterval.current);
                  setShowMenu(nodeId);
                  setLoadingNode(null);
                }
                return 0;
              }
              return prev + (100 * PROGRESS_INTERVAL / LOADING_DURATION);
            });
          }, PROGRESS_INTERVAL);
        }
      };

      // Check after a small delay to see if dragging
      setTimeout(() => checkDragging({ x: startPos?.x || 0, y: startPos?.y || 0 }), 100);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start selection if left-clicking directly on the canvas
    if (e.button === 0 && (e.target as HTMLElement).classList.contains('canvas-container')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (arrowStartNode) {
        if (autoAlignTarget) {
          // Create arrow connected to target shape
          const newArrow: Arrow = {
            id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startNodeId: arrowStartNode,
            endNodeId: autoAlignTarget.nodeId,
            startX: nodes.find(n => n.id === arrowStartNode)?.x || 0,
            startY: nodes.find(n => n.id === arrowStartNode)?.y || 0,
            endX: autoAlignTarget.x,
            endY: autoAlignTarget.y
          };

          if (isDrawingArrow) {
            // Replace old arrow with new one
            setArrows(prev => prev.map(arrow => 
              arrow.id === arrowStartNode ? newArrow : arrow
            ));
          } else {
            setArrows(prev => [...prev, newArrow]);
          }
        } else {
          // Create arrow to empty space
          const newArrow: Arrow = {
            id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startNodeId: arrowStartNode,
            endNodeId: '',
            startX: nodes.find(n => n.id === arrowStartNode)?.x || 0,
            startY: nodes.find(n => n.id === arrowStartNode)?.y || 0,
            endX: x,
            endY: y
          };

          if (isDrawingArrow) {
            setArrows(prev => prev.map(arrow => 
              arrow.id === arrowStartNode ? newArrow : arrow
            ));
          } else {
            setArrows(prev => [...prev, newArrow]);
          }
        }

        // Reset states
        setArrowStartNode(null);
        setTempArrowPos(null);
        setAutoAlignTarget(null);
        setIsDrawingArrow(false);
        return;
      }

      // Only start selection when holding Shift
      if (e.shiftKey) {
        setIsSelecting(true);
        setSelectionBox({
          startX: x,
          startY: y,
          endX: x,
          endY: y
        });
        setSelectedNodes([]);
      }
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggedNode) {
      setShowDeleteZone(true);
      // If we're dragging a selected node, move all selected nodes
      if (selectedNodes.includes(draggedNode)) {
        const draggedNodeOriginal = nodes.find(n => n.id === draggedNode);
        if (draggedNodeOriginal) {
          const deltaX = x - draggedNodeOriginal.x;
          const deltaY = y - draggedNodeOriginal.y;
          setNodes(prev => prev.map(node => 
            selectedNodes.includes(node.id)
              ? { ...node, x: node.x + deltaX, y: node.y + deltaY }
              : node
          ));
        }
      } else {
        // Move single node
        setNodes(prev => prev.map(node => 
          node.id === draggedNode 
            ? { ...node, x, y }
            : node
        ));
      }
    }

    // Update selection box
    if (isSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
      
      // Calculate selection bounds
      const bounds = {
        left: Math.min(selectionBox.startX, x),
        right: Math.max(selectionBox.startX, x),
        top: Math.min(selectionBox.startY, y),
        bottom: Math.max(selectionBox.startY, y)
      };

      // Check which nodes are within the selection
      const selectedNodeIds = nodes.filter(node => {
        return node.x >= bounds.left && 
               node.x <= bounds.right && 
               node.y >= bounds.top && 
               node.y <= bounds.bottom;
      }).map(node => node.id);

      setSelectedNodes(selectedNodeIds);
    }

    // Update temporary arrow position
    if (arrowStartNode) {
      setTempArrowPos({ x, y });
      checkNearbyShapes(x, y);
    }
  }, [draggedNode, arrowStartNode, isSelecting, selectionBox, selectedNodes, nodes]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    setLoadingNode(null);
    setLoadingProgress(0);

    if (isDrawingArrow && arrowStartNode && tempArrowPos) {
      if (autoAlignTarget?.nodeId) {
        const newArrow: Arrow = {
          id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          startNodeId: arrowStartNode,
          endNodeId: autoAlignTarget.nodeId,
          startX: nodes.find(n => n.id === arrowStartNode)?.x || 0,
          startY: nodes.find(n => n.id === arrowStartNode)?.y || 0,
          endX: autoAlignTarget.x,
          endY: autoAlignTarget.y
        };
        setArrows(prev => [...prev, newArrow]);
      }
    }

    setIsDrawingArrow(false);
    setArrowStartNode(null);
    setTempArrowPos(null);
    setAutoAlignTarget(null);
    setDraggedNode(null);
  };

  const handleShapeHover = (nodeId: string) => {
    if (!draggedNode && !isSelecting) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      setHoveredNode(nodeId);
    }
  };

  const handleShapeLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToMenu = relatedTarget?.closest('.add-shape-menu');
    const isMovingToShape = relatedTarget?.closest('.node-shape');
    const isMovingBetween = e.clientX > e.currentTarget.getBoundingClientRect().right && 
                           e.clientX < e.currentTarget.getBoundingClientRect().right + 32; // gap width

    if (isMovingToMenu || isMovingToShape || isMovingBetween) {
      return;
    }
    setHoveredNode(null);
  };

  const handlePanelHover = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === 'triangle') return; // Skip hover for triangles
    
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setActiveElement({ nodeId, panel: true, arrow: false });
  };

  const handlePanelLeave = () => {
    // Remove timeout and immediately update if not hovering arrow
    if (!activeElement.arrow) {
      setActiveElement({ nodeId: null, panel: false, arrow: false });
    }
  };

  const handleArrowLeave = () => {
    // Remove timeout and immediately update if not hovering panel
    if (!activeElement.panel) {
      setActiveElement({ nodeId: null, panel: false, arrow: false });
    }
  };

  const connectWallet = async () => {
    try {
      const ethereum = (window as EthereumWindow).ethereum;
      if (ethereum?.isMetaMask) {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts && accounts.length > 0) {
          const ethersProvider = new ethers.providers.Web3Provider(ethereum);
          const signer = ethersProvider.getSigner();
          
          setWalletState({
            provider: ethersProvider,
            signer: signer
          });
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          
          ethereum.on('accountsChanged', (accounts: string[]) => {
            if (accounts.length > 0) {
              setWalletAddress(accounts[0]);
            } else {
              disconnectWallet();
            }
          });

          ethereum.on('chainChanged', () => {
            window.location.reload();
          });
        }
      } else {
        console.error('No MetaMask found');
        alert('Please install MetaMask to connect your wallet');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = async () => {
    try {
      if (wcProviderRef.current) {
        await wcProviderRef.current.disconnect();
        wcProviderRef.current = null;
      }
      setWalletState({
        provider: null,
        signer: null
      });
      setWalletAddress('');
      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToRelated = relatedTarget && (
      relatedTarget.classList?.contains('node-shape') ||
      relatedTarget.classList?.contains('shape-panel') ||
      relatedTarget?.closest?.('.shape-panel') !== null
    );

    if (isMovingToRelated) return;

    const timer = setTimeout(() => {
      setActiveElement({ nodeId: null, panel: false, arrow: false });
    }, 100);
    setHoverTimeout(timer);
  };

  const handleDoubleClick = (nodeId: string, isArrow?: boolean) => {
    if (isArrow) {
      // Find the arrow that was clicked
      const clickedArrow = arrows.find(arrow => arrow.id === nodeId);
      if (clickedArrow) {
        setIsDrawingArrow(true);
        setArrowStartNode(clickedArrow.startNodeId);
        setTempArrowPos({
          x: clickedArrow.endX,
          y: clickedArrow.endY
        });
      }
      return;
    }

    if (!arrowStartNode) {
      setArrowStartNode(nodeId);
      setTempArrowPos(null);
    }
  };

  const checkNearbyShapes = (x: number, y: number) => {
    const SNAP_DISTANCE = 50; // pixels
    
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < SNAP_DISTANCE) {
        // Calculate alignment points based on shape type
        let alignX = node.x;
        let alignY = node.y;
        
        if (node.type === 'circle') {
          alignX = node.x - 32; // Left side
          alignY = node.y; // Center
        } else if (node.type === 'triangle') {
          alignX = node.x;
          alignY = node.y + 24; // Bottom
        }
        
        setAutoAlignTarget({
          nodeId: node.id,
          x: alignX,
          y: alignY
        });
        return;
      }
    }
    
    setAutoAlignTarget(null);
  };

  const renderHoldMenu = (node: GraphNode) => {
    switch (node.type) {
      case 'circle':
        if (!arrows.some(arrow => arrow.endNodeId === node.id)) {
          return (
            <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
              <h3 className="text-white font-semibold mb-4">User Preferences</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-300 text-sm">Token Pair</label>
                  <input type="text" defaultValue="ETH/RLUSD" className="w-full bg-gray-800 rounded px-2 py-1 text-white" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Trade Type</label>
                  <select className="w-full bg-gray-800 rounded px-2 py-1 text-white">
                    <option>Buy</option>
                    <option>Sell</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Trade Amount (Max: 0.1 ETH)</label>
                  <input type="text" defaultValue="0.02 ETH" className="w-full bg-gray-800 rounded px-2 py-1 text-white" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Slippage Tolerance (Max: 1.5%)</label>
                  <input type="text" defaultValue="1%" className="w-full bg-gray-800 rounded px-2 py-1 text-white" />
                </div>
              </div>
            </div>
          );
        }
        break;

      case 'rectangle':
        if (nodes.filter(n => n.type === 'rectangle').indexOf(node) === 0) {
          const randomPrice = Math.floor(Math.random() * (PRICE_RANGE.max - PRICE_RANGE.min + 1) + PRICE_RANGE.min);
          
          return (
            <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
              <h3 className="text-white font-semibold mb-4">On Chain Data</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-300 text-sm">Token Balances</label>
                  <div className="bg-gray-800 rounded p-2 space-y-1">
                    <div className="text-white">ETH: 0.1</div>
                    <div className="text-white">RLUSD: 538.45</div>
                  </div>
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Price Feed</label>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-white">ETH/RLUSD: ${randomPrice}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        break;

      case 'diamond':
        const currentPrice = Math.floor(Math.random() * (PRICE_RANGE.max - PRICE_RANGE.min + 1) + PRICE_RANGE.min);
        const minimumOutput = (0.02 * currentPrice).toFixed(2);
        
        return (
          <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
            <h3 className="text-white font-semibold mb-4">Trade Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-300 text-sm">Amount</label>
                <div className="bg-gray-800 rounded px-2 py-1 text-white">
                  0.02 ETH
                </div>
              </div>
              <div>
                <label className="text-gray-300 text-sm">Minimum Output</label>
                <div className="bg-gray-800 rounded px-2 py-1 text-white">
                  {minimumOutput} RLUSD
                </div>
              </div>
            </div>
          </div>
        );
        break;

      case 'square':
        return (
          <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
            <h3 className="text-white font-semibold mb-4">AI Prompts</h3>
            <div className="bg-gray-800 rounded p-3 text-gray-300 space-y-2">
              <div>• Analyzing market volatility patterns</div>
              <div>• Checking historical price correlations</div>
              <div>• Evaluating liquidity depth across exchanges</div>
              <div>• Monitoring gas price fluctuations</div>
              <div>• Assessing trading volume trends</div>
              <div>• Calculating optimal entry points</div>
            </div>
          </div>
        );

      case 'triangle':
        return (
          <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
            <h3 className="text-white font-semibold mb-4">Trade Confirmation</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-300 text-sm">Status</label>
                <div className="bg-green-800 text-green-400 rounded px-2 py-1">Success</div>
              </div>
              <div>
                <label className="text-gray-300 text-sm">Transaction Hash</label>
                <div className="bg-gray-800 rounded px-2 py-1 text-gray-400">FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z</div>
              </div>
              <div>
                <label className="text-gray-300 text-sm">Gas Fees</label>
                <div className="bg-gray-800 rounded px-2 py-1 text-white">0.005 AVAX</div>
              </div>
            </div>
            
            <h3 className="text-white font-semibold mt-4 mb-3">Updated Balances</h3>
            <div className="space-y-2">
              <div className="bg-gray-800 rounded px-2 py-1 text-white">AVAX: 1.495</div>
              <div className="bg-gray-800 rounded px-2 py-1 text-white">USDT: 705.75</div>
            </div>

            <h3 className="text-white font-semibold mt-4 mb-3">Historical Trades</h3>
            <div className="bg-gray-800 rounded p-2 text-gray-400 space-y-1">
              <div>Buy 1 AVAX @ 24.45 USDT</div>
              <div>Sell 0.5 AVAX @ 12.67 USDT</div>
              <div>Buy 2 AVAX @ 49.38 USDT</div>
            </div>

            <div className="mt-4">
              <button 
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition-colors w-full"
                onClick={() => {
                  console.log('Executing...');
                  setShowMenu(null);  // Add this line to close the menu
                }}
              >
                Execute
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Update hasAvailableShapes function to fix the order
  const hasAvailableShapes = (node: GraphNode): boolean => {
    if (node.type === 'circle' && !arrows.some(arrow => arrow.endNodeId === node.id) && 
        !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // First circle can add rectangle
    }
    if (node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').length === 1 && 
        !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // First rectangle can add square
    }
    if (node.type === 'square' && !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // Square can add diamond
    }
    if (node.type === 'diamond' && !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // Diamond can add second rectangle
    }
    if (node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').length === 2 && 
        !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // Second rectangle can add triangle
    }
    if (node.type === 'triangle' && !arrows.some(arrow => arrow.startNodeId === node.id)) {
      return true; // Triangle can add second circle
    }
    return false;
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(null);
        setLoadingProgress(0);
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
          progressInterval.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Update the click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenu) {
        const menu = document.querySelector(`[data-menu="${showMenu}"]`);
        const node = nodes.find(n => n.id === showMenu);
        
        // Only handle click-outside for non-triangle nodes
        if (menu && !menu.contains(e.target as Node) && (!node || node.type !== 'triangle')) {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, nodes]);

  // Add getShapeClass function
  const getShapeClass = (type: string): string => {
    switch (type) {
      case 'circle':
        return 'w-16 h-16 bg-black rounded-full';
      case 'rectangle':
        return 'w-32 h-12 bg-black';
      case 'square':
        return 'w-16 h-16 bg-black';
      case 'diamond':
        return 'w-16 h-16 bg-black transform rotate-45';
      case 'triangle':
        return 'w-0 h-0 border-l-[32px] border-r-[32px] border-b-[48px] border-transparent border-b-black';
      default:
        return '';
    }
  };

  const handleAddShape = (node: GraphNode) => {
    const newId = `node-${Date.now()}`;
    let newType: ShapeType;
    let width: number;
    let height: number;
    
    // Determine the next shape type and dimensions based on current node
    if (node.type === 'circle' && !arrows.some(arrow => arrow.startNodeId === node.id)) {
      newType = 'rectangle';
      width = 128; // w-32 = 8rem = 128px
      height = 48; // h-12 = 3rem = 48px
    } else if (node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 0) {
      newType = 'square';
      width = 64; // w-16 = 4rem = 64px
      height = 64; // h-16 = 4rem = 64px
    } else if (node.type === 'square') {
      newType = 'diamond';
      width = 64;
      height = 64;
    } else if (node.type === 'diamond') {
      newType = 'rectangle';
      width = 128;
      height = 48;
    } else if (node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 1) {
      newType = 'triangle';
      width = 64;
      height = 64;
    } else if (node.type === 'triangle') {
      newType = 'circle';
      width = 64;
      height = 64;
    } else {
      return; // Invalid state
    }

    const newNode: GraphNode = {
      id: newId,
      type: newType,
      x: node.x + 150,
      y: node.y,
      width,
      height
    };
    
    setNodes(prev => [...prev, newNode]);
    
    // Make sure all arrows have consistent properties
    const newArrow: Arrow = {
      id: `arrow-${Date.now()}`,
      startNodeId: node.id,
      endNodeId: newId,
      startX: node.x + (node.width / 2), // Adjust start position based on shape width
      startY: node.y,
      endX: node.x + 150 - (width / 2), // Adjust end position based on new shape width
      endY: node.y
    };
    
    setArrows(prev => [...prev, newArrow]);
  };

  const collectGraphData = (): GraphData => {
    const graphNodes: GraphMetadata[] = nodes.map(node => {
      const baseMetadata: GraphMetadata = {
        id: node.id,
        type: node.type,
        position: {
          x: node.x,
          y: node.y
        }
      };

      // Add specific data based on node type and position
      if (node.type === 'circle') {
        if (!arrows.some(arrow => arrow.endNodeId === node.id)) {
          // First circle (User)
          baseMetadata.data = {
            tokenPair: 'AVAX/USDT', // Get actual value from state
            tradeType: 'Buy',       // Get actual value from state
            tradeAmount: '1 AVAX',  // Get actual value from state
            slippageTolerance: '1%' // Get actual value from state
          };
        } else {
          // Second circle (Execute)
          baseMetadata.data = {};
        }
      } else if (node.type === 'rectangle') {
        const rectangleIndex = nodes.filter(n => n.type === 'rectangle')
          .indexOf(node);
        
        if (rectangleIndex === 0) {
          // First rectangle (On Chain Data)
          baseMetadata.data = {
            userPrompt: '', // Get actual value from state
            transactionHistory: ['Last 5 transactions...'],
            tokenBalances: {
              AVAX: 11.5,
              USDT: 455.75
            },
            priceFeeds: {
              'AVAX/USDT': 25.00
            }
          };
        } else {
          // Second rectangle (Verification)
          baseMetadata.data = {
            verificationStatus: {
              walletConnected: true,
              tokenPairValid: true,
              sufficientBalance: true,
              slippageWithinLimits: true
            }
          };
        }
      } else if (node.type === 'square') {
        baseMetadata.data = {
          aiPrompts: [
            'Analyzing market volatility patterns',
            'Checking historical price correlations',
            'Evaluating liquidity depth across exchanges',
            'Monitoring gas price fluctuations',
            'Assessing trading volume trends',
            'Calculating optimal entry points'
          ]
        };
      } else if (node.type === 'diamond') {
        baseMetadata.data = {
          tradeDetails: {
            tokenPair: 'AVAX/USDT',
            direction: 'Buy',
            amount: tradeConfig.tradeAmount,
            minimumOutput: `${parseFloat(tradeConfig.tradeAmount) * 25} USDT`
          }
        };
      } else if (node.type === 'triangle') {
        baseMetadata.data = {
          tradeConfirmation: {
            status: 'Success',
            transactionHash: '0xabc...',
            gasFees: '0.005 AVAX',
            updatedBalances: {
              AVAX: 9.495,
              USDT: 544.80
            },
            historicalTrades: [
              'Buy 1 AVAX @ 44.55 USDT',
              'Sell 0.5 AVAX @ 45.12 USDT',
              'Buy 2 AVAX @ 43.98 USDT'
            ]
          }
        };
      }

      return baseMetadata;
    });

    const graphConnections: GraphConnection[] = arrows.map(arrow => ({
      id: arrow.id,
      sourceId: arrow.startNodeId,
      targetId: arrow.endNodeId
    }));

    return {
      nodes: graphNodes,
      connections: graphConnections,
      version: '1.0',
      timestamp: Date.now()
    };
  };

  const exportGraphData = async () => {
    const graphData = collectGraphData();
    
    try {
      const response = await fetch('/api/graph-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphData)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log('Graph data exported successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to export graph data:', error);
      throw error;
    }
  };

  const updateNodeVerificationStatus = (verificationData: VerificationData) => {
    setNodes(prevNodes => prevNodes.map(node => {
      // Find the second rectangle node
      if (node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 1) {
        return {
          ...node,
          data: {
            ...node.data,
            verificationStatus: {
              walletConnected: verificationData.walletConnected,
              tokenPairValid: verificationData.tokenPairValid,
              balanceCheck: verificationData.balanceCheck,
              slippageCheck: verificationData.slippageCheck
            }
          }
        };
      }
      return node;
    }));
  };

  const verifyTrade = async (nodeData: any) => {
    try {
      const response = await fetch('/api/verify-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: nodeData.walletAddress,
          tokenPair: nodeData.tokenPair,
          tradeAmount: nodeData.tradeAmount,
          slippageTolerance: nodeData.slippageTolerance,
          externalLimits: nodeData.externalLimits,
          verificationResults: nodeData.verificationResults
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      // Update the verification status in the UI
      updateNodeVerificationStatus(result.data);
      
      return result.data;
    } catch (error) {
      console.error('Verification failed:', error);
      throw error;
    }
  };

  return (
    <div className="h-screen w-full relative">
      {/* Top toolbar layer */}
      <div className="absolute top-4 right-4 z-[100]">
        <button
          onClick={async (e) => {
            e.preventDefault();
            if (isConnected) {
              await disconnectWallet();
            } else {
              await connectWallet();
            }
          }}
          className="bg-[#2A2B32] text-white px-6 py-3 rounded-xl hover:bg-[#3F4046] transition-colors"
        >
          {isConnected ? (
            <span>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          ) : (
            'Connect Wallet'
          )}
        </button>
      </div>
      <div className="absolute left-4 top-4 z-[100]">
        <div className="bg-[#2A2B32] rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-6 text-gray-200">Shapes</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 bg-black rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors select-none"
                onClick={() => handleShapeClick('circle')}
              />
              <span className="text-gray-200 text-sm">
                {2 - nodes.filter(node => node.type === 'circle').length}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="w-32 h-12 bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors select-none"
                onClick={() => handleShapeClick('rectangle')}
              />
              <span className="text-gray-200 text-sm">
                {2 - nodes.filter(node => node.type === 'rectangle').length}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 bg-black rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors select-none"
                onClick={() => handleShapeClick('square')}
              />
              <span className="text-gray-200 text-sm">
                {1 - nodes.filter(node => node.type === 'square').length}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors select-none"
                style={{ transform: 'rotate(45deg)' }}
                onClick={() => handleShapeClick('diamond')}
              />
              <span className="text-gray-200 text-sm">
                {1 - nodes.filter(node => node.type === 'diamond').length}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors select-none relative"
                onClick={() => handleShapeClick('triangle')}
              >
                <div className="w-0 h-0 border-l-[32px] border-r-[32px] border-b-[48px] border-transparent border-b-black" />
              </div>
              <span className="text-gray-200 text-sm">
                {1 - nodes.filter(node => node.type === 'triangle').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main canvas layer */}
      <div 
        className="h-full w-full relative canvas-container"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundColor: '#f3f4f6',
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: 'center center',
          backgroundRepeat: 'repeat',
        }}
      >
        {/* Selection Box Layer - z-10 */}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
              border: '1px solid #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
        )}

        {/* Arrows Layer - z-20 */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 20 }}>
          {arrows.map((arrow) => {
            const startNode = nodes.find(n => n.id === arrow.startNodeId);
            const endNode = nodes.find(n => n.id === arrow.endNodeId);
            
            if (!startNode || !endNode) return null;

            // Calculate start and end points based on shape types
            let startX = startNode.x;
            let startY = startNode.y;
            let endX = endNode.x;
            let endY = endNode.y;

            // Calculate the angle between points
            const dx = endX - startX;
            const dy = endY - startY;
            const angle = Math.atan2(dy, dx);

            // Define shape-specific offsets
            let startOffset = 32;  // Default for circle/square/diamond
            let endOffset = 32;    // Default for circle/square/diamond

            // Adjust offsets based on shape type
            if (startNode.type === 'rectangle') {
              startOffset = 64;  // Half of rectangle width
            } else if (startNode.type === 'triangle') {
              startOffset = 32;
            }

            if (endNode.type === 'rectangle') {
              endOffset = 64;
            } else if (endNode.type === 'triangle') {
              endOffset = 32;
            }

            // Calculate final points with offsets
            const finalStartX = startX + Math.cos(angle) * startOffset;
            const finalStartY = startY + Math.sin(angle) * startOffset;
            const finalEndX = endX - Math.cos(angle) * endOffset;
            const finalEndY = endY - Math.sin(angle) * endOffset;

            // Arrow head calculations
            const arrowLength = 15;
            const arrowAngle = Math.PI / 6;  // 30 degrees

            const arrowPoint1X = finalEndX - arrowLength * Math.cos(angle - arrowAngle);
            const arrowPoint1Y = finalEndY - arrowLength * Math.sin(angle - arrowAngle);
            const arrowPoint2X = finalEndX - arrowLength * Math.cos(angle + arrowAngle);
            const arrowPoint2Y = finalEndY - arrowLength * Math.sin(angle + arrowAngle);

            return (
              <g key={`${arrow.startNodeId}-${arrow.endNodeId}`}>
                {/* Main arrow line */}
                <line
                  x1={finalStartX}
                  y1={finalStartY}
                  x2={finalEndX}
                  y2={finalEndY}
                  stroke="black"
                  strokeWidth="2"
                />
                {/* Arrow head */}
                <line
                  x1={finalEndX}
                  y1={finalEndY}
                  x2={arrowPoint1X}
                  y2={arrowPoint1Y}
                  stroke="black"
                  strokeWidth="2"
                />
                <line
                  x1={finalEndX}
                  y1={finalEndY}
                  x2={arrowPoint2X}
                  y2={arrowPoint2Y}
                  stroke="black"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        {/* Shapes Layer - z-30 */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`absolute cursor-pointer ${selectedNodes.includes(node.id) ? 'outline outline-2 outline-blue-500' : ''}`}
            style={{
              left: node.x,
              top: node.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 30
            }}
          >
            {/* Labels */}
            {node.type === 'circle' && !arrows.some(arrow => arrow.endNodeId === node.id) && (
              <div 
                className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 pointer-events-none"
                style={{ whiteSpace: 'nowrap' }}
              >
                User
              </div>
            )}
            {node.type === 'diamond' && (
              <div 
                className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 pointer-events-none"
                style={{ whiteSpace: 'nowrap' }}
              >
                On Chain
              </div>
            )}

            {/* Node shapes and other content */}
            <div
              className={`node-shape ${getShapeClass(node.type)}`}
              onMouseEnter={() => handleShapeHover(node.id)}
              onMouseLeave={handleShapeLeave}
              onMouseDown={() => handleMouseDown(node.id)}
              onDoubleClick={() => handleDoubleClick(node.id)}
            />
          </div>
        ))}

        {/* Loading Rings Layer - z-40 */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
          {nodes.map((node) => (
            loadingNode === node.id && (
              <div 
                key={`loading-${node.id}`}
                className="absolute"
                style={{
                  left: node.x,
                  top: node.y,
                  transform: 'translate(-50%, -50%)',
                  width: node.type === 'rectangle' ? '168px' : '80px',  // Adjusted rectangle width
                  height: node.type === 'rectangle' ? '56px' : '80px'   // Adjusted rectangle height
                }}
              >
                <svg className="w-full h-full">
                  {node.type === 'circle' && (
                    <circle
                      cx="50%"
                      cy="50%"
                      r="36"
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 36 * (loadingProgress / 100)} ${2 * Math.PI * 36}`}
                      transform="rotate(-90 40 40)"
                    />
                  )}
                  {node.type === 'rectangle' && (
                    <rect
                      x="2"
                      y="2"
                      width="164"  // Adjusted to be closer to rectangle
                      height="52"  // Adjusted to be closer to rectangle
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray={`${432 * (loadingProgress / 100)} 432`}  // Updated perimeter
                      transform="rotate(0 84 28)"  // Adjusted center point
                    />
                  )}
                  {node.type === 'square' && (
                    <rect
                      x="2"
                      y="2"
                      width="76"
                      height="76"
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray={`${304 * (loadingProgress / 100)} 304`}
                      transform="rotate(0 40 40)"
                    />
                  )}
                  {node.type === 'diamond' && (
                    <rect
                      x="2"
                      y="2"
                      width="76"
                      height="76"
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray={`${304 * (loadingProgress / 100)} 304`}
                      transform="rotate(45 40 40)"
                    />
                  )}
                  {node.type === 'triangle' && (
                    <path
                      d="M40 6 L6 72 L74 72 Z"  // Adjusted triangle points to be closer to shape
                      fill="none"
                      stroke="black"
                      strokeWidth="2"
                      strokeDasharray={`${220 * (loadingProgress / 100)} 220`}  // Adjusted perimeter
                      transform="rotate(0 40 40)"
                    />
                  )}
                </svg>
              </div>
            )
          ))}
        </div>

        {/* Menus Layer - z-1000 */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
          {nodes.map((node) => (
            <React.Fragment key={`menu-${node.id}`}>
              {/* Add Shape Menu */}
              {hoveredNode === node.id && hasAvailableShapes(node) && !isHolding && !draggedNode && !isSelecting && (
                <div 
                  className="absolute add-shape-menu pointer-events-auto bg-[#2A2B32] rounded-lg p-2"
                  style={{
                    left: `${node.x + 40}px`,
                    top: `${node.y - 32}px`
                  }}
                >
                  {/* First circle -> Rectangle */}
                  {node.type === 'circle' && !arrows.some(arrow => arrow.startNodeId === node.id) && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-24 h-8 bg-black" />
                    </div>
                  )}
                  
                  {/* First rectangle -> Square */}
                  {node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 0 && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-12 h-12 bg-black" />
                    </div>
                  )}
                  
                  {/* Square -> Diamond */}
                  {node.type === 'square' && !arrows.some(arrow => arrow.startNodeId === node.id) && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-12 h-12 bg-black transform rotate-45" />
                    </div>
                  )}
                  
                  {/* Diamond -> Rectangle */}
                  {node.type === 'diamond' && !arrows.some(arrow => arrow.startNodeId === node.id) && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-24 h-8 bg-black" />
                    </div>
                  )}
                  
                  {/* Second rectangle -> Triangle */}
                  {node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 1 && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-12 h-12 flex items-center justify-center">
                        <div 
                          className="w-0 h-0 border-transparent"
                          style={{
                            borderLeftWidth: '16px',
                            borderRightWidth: '16px',
                            borderBottomWidth: '24px',
                            borderBottomColor: 'black'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Triangle -> Circle */}
                  {node.type === 'triangle' && !arrows.some(arrow => arrow.startNodeId === node.id) && (
                    <div 
                      className="cursor-pointer p-2 hover:bg-gray-700 rounded transition-colors"
                      onClick={() => handleAddShape(node)}
                    >
                      <div className="text-gray-300 text-sm mb-2">Add Shape</div>
                      <div className="w-12 h-12 bg-black rounded-full" />
                    </div>
                  )}
                </div>
              )}

              {/* Hold Menu */}
              {showMenu === node.id && (
                <div 
                  data-menu={node.id}
                  className="absolute select-none pointer-events-auto"
                  style={{ 
                    left: `${node.x + 40}px`,
                    top: `${node.y}px`
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {node.type === 'circle' && !arrows.some(arrow => arrow.endNodeId === node.id) && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <h3 className="text-white font-semibold mb-4">User Preferences</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-300 text-sm">Token Pair</label>
                          <input 
                            type="text" 
                            value={tempTradeConfig.tokenPair} 
                            onChange={(e) => setTempTradeConfig(prev => ({...prev, tokenPair: e.target.value}))}
                            className="w-full bg-gray-800 rounded px-2 py-1 text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Trade Type</label>
                          <select 
                            value={tempTradeConfig.tradeType}
                            onChange={(e) => setTempTradeConfig(prev => ({...prev, tradeType: e.target.value}))}
                            className="w-full bg-gray-800 rounded px-2 py-1 text-white"
                          >
                            <option>Buy</option>
                            <option>Sell</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Trade Amount</label>
                          <input 
                            type="text" 
                            value={tempTradeConfig.tradeAmount}
                            onChange={(e) => setTempTradeConfig(prev => ({...prev, tradeAmount: e.target.value}))}
                            className="w-full bg-gray-800 rounded px-2 py-1 text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Slippage Tolerance</label>
                          <input 
                            type="text" 
                            value={tempTradeConfig.slippageTolerance}
                            onChange={(e) => setTempTradeConfig(prev => ({...prev, slippageTolerance: e.target.value}))}
                            className="w-full bg-gray-800 rounded px-2 py-1 text-white" 
                          />
                        </div>
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={async () => {
                              setTradeConfig(tempTradeConfig);
                              try {
                                await verifyTrade({
                                  walletAddress: walletAddress,
                                  tokenPair: tempTradeConfig.tokenPair,
                                  tradeAmount: tempTradeConfig.tradeAmount,
                                  slippageTolerance: tempTradeConfig.slippageTolerance,
                                  externalLimits: {
                                    maxBalance: "10 AVAX",    // Changed from 11.5
                                    maxSlippage: "1.5%",      // Changed to 1.5%
                                    recommendedSlippage: "0.5%"
                                  }
                                });
                                setShowMenu(null);
                              } catch (error) {
                                console.error('Verification failed:', error);
                              }
                            }}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                          >
                            Save & Verify
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 0 && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <h3 className="text-white font-semibold mb-4">On Chain Data</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-300 text-sm">Transaction History</label>
                          <div className="bg-gray-800 rounded p-2 max-h-32 overflow-y-auto">
                            <div className="text-gray-400">Last 5 transactions...</div>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Token Balances</label>
                          <div className="bg-gray-800 rounded p-2">
                            <div className="text-white">ETH: 0.1</div>
                            <div className="text-white">RLUSD: 538.45</div>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Price Feed</label>
                          <div className="bg-gray-800 rounded p-2">
                            <div className="text-white">ETH/RLUSD: ${Math.floor(Math.random() * (2750 - 2650 + 1) + 2650)}</div>
                          </div>
                        </div>
                      </div>

                      {/* User Input Prompt Section */}
                      <div className="mt-6 border-t border-gray-700 pt-4">
                        <label className="text-gray-300 text-sm block mb-2">User Input Prompt</label>
                        <textarea 
                          className="w-full bg-gray-800 rounded p-3 text-white min-h-[120px] resize-none"
                          placeholder="Enter your prompt here..."
                          style={{ 
                            outline: 'none',
                            border: '1px solid #4B5563',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {node.type === 'diamond' && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <h3 className="text-white font-semibold mb-4">Trade Details</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-300 text-sm">Amount</label>
                          <div className="bg-gray-800 rounded px-2 py-1 text-white">
                            {tradeConfig.tradeAmount}
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Minimum Output</label>
                          <div className="bg-gray-800 rounded px-2 py-1 text-white">
                            {(parseFloat(tradeConfig.tradeAmount.split(' ')[0]) * STATIC_PRICE).toFixed(2)} RLUSD
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'square' && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <h3 className="text-white font-semibold mb-4">AI Prompts</h3>
                      <div className="bg-gray-800 rounded p-3 text-gray-300 space-y-2">
                        <div>• Analyzing market volatility patterns</div>
                        <div>• Checking historical price correlations</div>
                        <div>• Evaluating liquidity depth across exchanges</div>
                        <div>• Monitoring gas price fluctuations</div>
                        <div>• Assessing trading volume trends</div>
                        <div>• Calculating optimal entry points</div>
                      </div>
                    </div>
                  )}

                  {node.type === 'rectangle' && nodes.filter(n => n.type === 'rectangle').indexOf(node) === 1 && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <h3 className="text-white font-semibold mb-4">Verification Status</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Wallet</span>
                          <span className={isConnected ? "text-green-500" : "text-red-500"}>
                            {isConnected ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Valid Token Pair</span>
                          <span className="text-green-500">✓</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Sufficient Funds</span>
                          <span className={parseFloat(tradeConfig.tradeAmount.split(' ')[0]) <= 0.1 ? "text-green-500" : "text-red-500"}>
                            {parseFloat(tradeConfig.tradeAmount.split(' ')[0]) <= 0.1 ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Slippage Tolerance</span>
                          <span className={parseFloat(tradeConfig.slippageTolerance.replace('%', '')) <= 1.5 ? "text-green-500" : "text-red-500"}>
                            {parseFloat(tradeConfig.slippageTolerance.replace('%', '')) <= 1.5 ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'triangle' && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <button 
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition-colors w-full"
                        onClick={() => {
                          console.log('Executing...');
                          setShowMenu(null);
                        }}
                      >
                        Execute
                      </button>
                    </div>
                  )}

                  {node.type === 'circle' && arrows.some(arrow => arrow.endNodeId === node.id) && (
                    <div className="bg-[#2A2B32] rounded-lg p-4 shadow-lg min-w-[400px]">
                      <div className="mb-4">
                        <button 
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition-colors w-full"
                          onClick={() => {
                            console.log('Executing...');
                            setShowMenu(null);
                          }}
                        >
                          Confirm
                        </button>
                      </div>

                      <h3 className="text-white font-semibold mb-4">Trade Confirmation</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-300 text-sm">Status</label>
                          <div className="bg-green-800 text-green-400 rounded px-2 py-1">Success</div>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Transaction Hash</label>
                          <div className="bg-gray-800 rounded px-2 py-1 text-gray-400">0x7d3c...8f4e</div>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm">Gas Fees</label>
                          <div className="bg-gray-800 rounded px-2 py-1 text-white">0.002 ETH</div>
                        </div>
                      </div>
                      
                      <h3 className="text-white font-semibold mt-4 mb-3">Updated Balances</h3>
                      <div className="space-y-2">
                        <div className="bg-gray-800 rounded px-2 py-1 text-white">
                          ETH: {(0.1 - parseFloat(tradeConfig.tradeAmount.split(' ')[0]) - 0.002).toFixed(3)}
                        </div>
                        <div className="bg-gray-800 rounded px-2 py-1 text-white">
                          RLUSD: {(538.45 + parseFloat(tradeConfig.tradeAmount.split(' ')[0]) * STATIC_PRICE).toFixed(2)}
                        </div>
                      </div>

                      <h3 className="text-white font-semibold mt-4 mb-3">Historical Trades</h3>
                      <div className="bg-gray-800 rounded p-2 text-gray-400 space-y-1">
                        <div>Buy 0.02 ETH @ 54.63 RLUSD</div>
                        <div>Sell 0.01 ETH @ 28.56 RLUSD</div>
                        <div>Buy 0.04 ETH @ 98.27 RLUSD</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Delete Zone - z-50 */}
        {showDeleteZone && (
          <div 
            className={`absolute bottom-0 left-0 right-0 h-24 bg-red-500 bg-opacity-20 flex items-center justify-center transition-all duration-300 ${draggedNode ? 'opacity-100' : 'opacity-0'}`}
            style={{ zIndex: 50 }}
          >
            <div className="text-red-600 font-semibold text-lg">
              Drop here to delete
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphCanvas;
