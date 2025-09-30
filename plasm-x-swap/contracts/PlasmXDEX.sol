// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PlasmXDEX
 * @dev Decentralized Exchange for Plasma Chain - Based on dyorswapdex architecture
 * @dev Implements Automated Market Maker (AMM) with x*y=k formula
 */
contract PlasmXDEX is ReentrancyGuard, Ownable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public immutable token; // The ERC20 token being traded against XPL
    uint256 public totalLiquidity; // Total liquidity in the pool
    uint256 public constant FEE_DENOMINATOR = 1000; // 0.3% fee = 3/1000
    uint256 public constant FEE_NUMERATOR = 3; // 0.3% trading fee
    
    // Mapping of user addresses to their liquidity contributions
    mapping(address => uint256) public liquidity;
    
    // ============ EVENTS ============
    
    event TokensSwapped(
        address indexed user,
        uint256 xplIn,
        uint256 tokensOut,
        uint256 xplReserve,
        uint256 tokenReserve
    );
    
    event XPLSwapped(
        address indexed user,
        uint256 tokensIn,
        uint256 xplOut,
        uint256 xplReserve,
        uint256 tokenReserve
    );
    
    event LiquidityProvided(
        address indexed user,
        uint256 xplAmount,
        uint256 tokenAmount,
        uint256 liquidityMinted
    );
    
    event LiquidityRemoved(
        address indexed user,
        uint256 xplAmount,
        uint256 tokenAmount,
        uint256 liquidityBurned
    );
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @dev Initialize the DEX with a specific ERC20 token
     * @param _token Address of the ERC20 token to trade against XPL
     */
    constructor(address _token) {
        require(_token != address(0), "Token address cannot be zero");
        token = IERC20(_token);
    }
    
    // ============ CORE DEX FUNCTIONS ============
    
    /**
     * @dev Calculate output amount for a given input using x*y=k formula with fees
     * @param inputAmount Amount of input token
     * @param inputReserve Current reserve of input token
     * @param outputReserve Current reserve of output token
     * @return Output amount after fees
     */
    function getAmountOut(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) public pure returns (uint256) {
        require(inputAmount > 0, "Input amount must be greater than zero");
        require(inputReserve > 0 && outputReserve > 0, "Invalid reserves");
        
        // Apply 0.3% fee: inputAmountWithFee = inputAmount * 997 / 1000
        uint256 inputAmountWithFee = inputAmount * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = (inputReserve * FEE_DENOMINATOR) + inputAmountWithFee;
        
        return numerator / denominator;
    }
    
    /**
     * @dev Swap XPL for tokens
     * @param minTokens Minimum tokens expected (slippage protection)
     */
    function swapXPLForTokens(uint256 minTokens) 
        external 
        payable 
        nonReentrant 
    {
        require(msg.value > 0, "Must send XPL");
        
        uint256 xplReserve = address(this).balance - msg.value;
        uint256 tokenReserve = token.balanceOf(address(this));
        
        uint256 tokensBought = getAmountOut(msg.value, xplReserve, tokenReserve);
        require(tokensBought >= minTokens, "Insufficient output amount");
        
        // Transfer tokens to user
        require(token.transfer(msg.sender, tokensBought), "Token transfer failed");
        
        emit TokensSwapped(
            msg.sender,
            msg.value,
            tokensBought,
            address(this).balance,
            token.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Swap tokens for XPL
     * @param tokenAmount Amount of tokens to swap
     * @param minXPL Minimum XPL expected (slippage protection)
     */
    function swapTokensForXPL(uint256 tokenAmount, uint256 minXPL) 
        external 
        nonReentrant 
    {
        require(tokenAmount > 0, "Token amount must be greater than zero");
        
        uint256 xplReserve = address(this).balance;
        uint256 tokenReserve = token.balanceOf(address(this));
        
        uint256 xplBought = getAmountOut(tokenAmount, tokenReserve, xplReserve);
        require(xplBought >= minXPL, "Insufficient output amount");
        
        // Transfer tokens from user
        require(
            token.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );
        
        // Transfer XPL to user
        (bool success, ) = payable(msg.sender).call{value: xplBought}("");
        require(success, "XPL transfer failed");
        
        emit XPLSwapped(
            msg.sender,
            tokenAmount,
            xplBought,
            address(this).balance,
            token.balanceOf(address(this))
        );
    }
    
    // ============ LIQUIDITY FUNCTIONS ============
    
    /**
     * @dev Add liquidity to the pool
     * @param tokenAmount Amount of tokens to add
     */
    function addLiquidity(uint256 tokenAmount) 
        external 
        payable 
        nonReentrant 
        returns (uint256) 
    {
        require(msg.value > 0 && tokenAmount > 0, "Amounts must be greater than zero");
        
        uint256 liquidityMinted;
        
        if (totalLiquidity == 0) {
            // First liquidity provider
            liquidityMinted = address(this).balance;
            totalLiquidity = liquidityMinted;
        } else {
            // Maintain current ratio
            uint256 xplReserve = address(this).balance - msg.value;
            uint256 tokenReserve = token.balanceOf(address(this));
            
            uint256 tokenAmountOptimal = (msg.value * tokenReserve) / xplReserve;
            require(tokenAmount >= tokenAmountOptimal, "Insufficient token amount");
            
            liquidityMinted = (msg.value * totalLiquidity) / xplReserve;
            totalLiquidity += liquidityMinted;
        }
        
        liquidity[msg.sender] += liquidityMinted;
        
        // Transfer tokens from user
        require(
            token.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );
        
        emit LiquidityProvided(
            msg.sender,
            msg.value,
            tokenAmount,
            liquidityMinted
        );
        
        return liquidityMinted;
    }
    
    /**
     * @dev Remove liquidity from the pool
     * @param liquidityAmount Amount of liquidity to remove
     */
    function removeLiquidity(uint256 liquidityAmount) 
        external 
        nonReentrant 
        returns (uint256, uint256) 
    {
        require(liquidityAmount > 0, "Liquidity amount must be greater than zero");
        require(liquidity[msg.sender] >= liquidityAmount, "Insufficient liquidity");
        
        uint256 xplAmount = (liquidityAmount * address(this).balance) / totalLiquidity;
        uint256 tokenAmount = (liquidityAmount * token.balanceOf(address(this))) / totalLiquidity;
        
        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        
        // Transfer XPL to user
        (bool success, ) = payable(msg.sender).call{value: xplAmount}("");
        require(success, "XPL transfer failed");
        
        // Transfer tokens to user
        require(token.transfer(msg.sender, tokenAmount), "Token transfer failed");
        
        emit LiquidityRemoved(
            msg.sender,
            xplAmount,
            tokenAmount,
            liquidityAmount
        );
        
        return (xplAmount, tokenAmount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get current reserves
     */
    function getReserves() external view returns (uint256 xplReserve, uint256 tokenReserve) {
        return (address(this).balance, token.balanceOf(address(this)));
    }
    
    /**
     * @dev Get user's liquidity
     */
    function getUserLiquidity(address user) external view returns (uint256) {
        return liquidity[user];
    }
    
    /**
     * @dev Calculate XPL and token amounts for given liquidity
     */
    function calculateLiquidityValue(uint256 liquidityAmount) 
        external 
        view 
        returns (uint256 xplAmount, uint256 tokenAmount) 
    {
        if (totalLiquidity == 0) return (0, 0);
        
        xplAmount = (liquidityAmount * address(this).balance) / totalLiquidity;
        tokenAmount = (liquidityAmount * token.balanceOf(address(this))) / totalLiquidity;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Emergency withdraw function (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 xplBalance = address(this).balance;
        
        if (tokenBalance > 0) {
            token.transfer(owner(), tokenBalance);
        }
        
        if (xplBalance > 0) {
            (bool success, ) = payable(owner()).call{value: xplBalance}("");
            require(success, "XPL transfer failed");
        }
    }
    
    // ============ RECEIVE FUNCTION ============
    
    /**
     * @dev Accept XPL deposits
     */
    receive() external payable {
        // Allow direct XPL deposits for liquidity
    }
}