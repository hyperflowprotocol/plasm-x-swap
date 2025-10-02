import React from 'react';
import { ChevronDown } from 'lucide-react';
import { CHAINS } from '../config/chains.js';

/**
 * Chain Selector Component
 * Allows users to switch between supported chains (XPL, Base)
 */
export default function ChainSelector({ selectedChain, onChainChange }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const chains = Object.values(CHAINS);
  const currentChain = chains.find(c => c.chainId === selectedChain) || chains[0];
  
  return (
    <div className="chain-selector">
      <button 
        className="chain-selector-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="chain-name">{currentChain.name}</span>
        <ChevronDown size={16} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="chain-selector-overlay" 
            onClick={() => setIsOpen(false)}
          />
          <div className="chain-selector-dropdown">
            {chains.map(chain => (
              <button
                key={chain.chainId}
                className={`chain-option ${chain.chainId === selectedChain ? 'selected' : ''}`}
                onClick={() => {
                  onChainChange(chain.chainId);
                  setIsOpen(false);
                }}
              >
                <div className="chain-info">
                  <span className="chain-name">{chain.name}</span>
                  <span className="chain-symbol">{chain.nativeCurrency.symbol}</span>
                </div>
                {chain.chainId === selectedChain && (
                  <span className="chain-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
