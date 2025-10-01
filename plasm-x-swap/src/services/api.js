// Frontend API service for backend communication - Simplified (No Logos)

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://3a9e0063-77a5-47c3-8b08-e9c97e127f0a-00-39uxnbmqdszny.picard.replit.dev'; // Use env var or fallback to Replit

class ApiService {
  // Get all tokens (symbols only)
  static async getTokens() {
    try {
      console.log('🌐 Fetching tokens from backend');
      const response = await fetch(`${API_BASE}/api/tokens`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const tokens = await response.json();
      console.log(`✅ Loaded ${tokens.length} tokens from backend`);
      return tokens;
      
    } catch (error) {
      console.error('❌ Error fetching tokens from backend:', error);
      // Fallback to default tokens if backend fails
      return [
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
    }
  }

  // Get quote for token swap
  static async getQuote(inputToken, outputToken, inputAmount) {
    try {
      console.log(`🔍 Getting quote: ${inputAmount} ${inputToken} -> ${outputToken}`);
      const response = await fetch(`${API_BASE}/api/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputToken,
          outputToken,
          inputAmount
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Quote received: ${data.outputAmount}`);
      return data;

    } catch (error) {
      console.error('❌ Error getting quote:', error);
      // Simple fallback quote
      return {
        outputAmount: inputAmount,
        priceImpact: '< 0.01%'
      };
    }
  }

  // Health check
  static async healthCheck() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log('✅ Backend health check passed:', data);
      return data;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      throw error;
    }
  }
}

export default ApiService;