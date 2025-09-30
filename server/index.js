const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple Token System - Tickers Only (No Logos)
// Removed all logo resolution logic for speed and simplicity

// Base tokens for Plasma network - symbols only
const PLASMA_TOKENS = [
  {
    symbol: 'XPL',
    name: 'Plasma',
    address: 'native',
    decimals: 18
  },
  {
    symbol: 'WXPL',
    name: 'Wrapped XPL',
    address: '0x6100e367285b01f48d07953803a2d8dca5d19873',
    decimals: 18
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb',
    decimals: 6
  }
];

// API Routes

// Get tokens - symbols only, no logos
app.get('/api/tokens', async (req, res) => {
  try {
    console.log('🚀 API: Getting tokens (symbols only)');
    
    // Return tokens with just essential data - no logos
    const tokens = PLASMA_TOKENS.map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals
    }));
    
    console.log(`✅ Returning ${tokens.length} tokens with symbols only`);
    res.json(tokens);
    
  } catch (error) {
    console.error('❌ Error in /api/tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Removed quote API - using REAL blockchain quotes only

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Plasm X Swap Backend running on port ${PORT}`);
  console.log(`📊 Simple Token System - Symbols Only`);
  console.log(`🎯 Available tokens: ${PLASMA_TOKENS.map(t => t.symbol).join(', ')}`);
});