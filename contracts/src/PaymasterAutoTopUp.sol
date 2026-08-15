// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title PaymasterAutoTopUp
/// @notice Non-custodial USDC vault that tops up a paymaster when its balance
///         falls below a configured threshold. Intended for Base L2 keepers.
/// @dev Only the owner or an authorized keeper may call `executeTopUp`.
///      Vault funds can only leave via top-up to the configured paymaster or
///      an owner-initiated `withdraw`.
contract PaymasterAutoTopUp is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice ERC-20 used for gas sponsorship (e.g. USDC on Base).
    IERC20 public immutable token;

    /// @notice Paymaster address that receives top-ups.
    address public paymaster;

    /// @notice Authorized keeper daemon (in addition to owner).
    address public keeper;

    /// @notice Top-up triggers when paymaster token balance is strictly below this.
    uint256 public threshold;

    /// @notice Exact amount transferred to the paymaster on each successful top-up.
    uint256 public topUpAmount;

    /// @notice Cumulative USDC successfully topped up.
    uint256 public totalToppedUp;

    /// @notice Number of successful top-up executions.
    uint256 public topUpCount;

    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);
    event PaymasterUpdated(address indexed previousPaymaster, address indexed newPaymaster);
    event ThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);
    event TopUpAmountUpdated(uint256 previousAmount, uint256 newAmount);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ToppedUp(address indexed caller, address indexed paymaster, uint256 amount, uint256 paymasterBalanceAfter);

    error ZeroAddress();
    error InvalidConfig();
    error Unauthorized();
    error TopUpNotNeeded();
    error InsufficientVaultBalance();

    modifier onlyKeeperOrOwner() {
        if (msg.sender != owner() && msg.sender != keeper) revert Unauthorized();
        _;
    }

    /// @param token_        ERC-20 used for top-ups (USDC).
    /// @param paymaster_    Initial paymaster recipient.
    /// @param keeper_       Initial keeper (address(0) disables keeper until set).
    /// @param threshold_    Balance below which a top-up is allowed.
    /// @param topUpAmount_  Amount sent to the paymaster per top-up.
    constructor(
        address token_,
        address paymaster_,
        address keeper_,
        uint256 threshold_,
        uint256 topUpAmount_
    ) Ownable(msg.sender) {
        if (token_ == address(0) || paymaster_ == address(0)) revert ZeroAddress();
        if (threshold_ == 0 || topUpAmount_ == 0) revert InvalidConfig();

        token = IERC20(token_);
        paymaster = paymaster_;
        // address(0) is intentional: owner-only mode until a keeper is assigned.
        // slither-disable-next-line missing-zero-check
        keeper = keeper_;
        threshold = threshold_;
        topUpAmount = topUpAmount_;
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Token balance held by this vault.
    function vaultBalance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Token balance of the configured paymaster.
    function paymasterBalance() public view returns (uint256) {
        return token.balanceOf(paymaster);
    }

    /// @notice True when paymaster balance is below threshold and vault can cover topUpAmount.
    function needsTopUp() public view returns (bool) {
        return paymasterBalance() < threshold && vaultBalance() >= topUpAmount;
    }

    // -------------------------------------------------------------------------
    // Funding
    // -------------------------------------------------------------------------

    /// @notice Deposit tokens into the vault. Caller must `approve` this contract first.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidConfig();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Owner withdraws idle vault funds (does not touch paymaster).
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidConfig();
        if (vaultBalance() < amount) revert InsufficientVaultBalance();
        token.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    // -------------------------------------------------------------------------
    // Top-up
    // -------------------------------------------------------------------------

    /// @notice Transfer `topUpAmount` from the vault to the paymaster if below threshold.
    /// @dev Keeper / owner only. Reverts if top-up is not needed or vault is short.
    function executeTopUp() external onlyKeeperOrOwner nonReentrant whenNotPaused {
        uint256 pmBal = paymasterBalance();
        if (pmBal >= threshold) revert TopUpNotNeeded();

        uint256 amount = topUpAmount;
        if (vaultBalance() < amount) revert InsufficientVaultBalance();

        // Effects before interaction (CEI); ReentrancyGuard also protects this path.
        totalToppedUp += amount;
        unchecked {
            ++topUpCount;
        }

        token.safeTransfer(paymaster, amount);

        emit ToppedUp(msg.sender, paymaster, amount, paymasterBalance());
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Set or clear the keeper. Passing address(0) disables keeper calls.
    function setKeeper(address newKeeper) external onlyOwner {
        address previous = keeper;
        // address(0) clears the keeper (owner retains executeTopUp).
        // slither-disable-next-line missing-zero-check
        keeper = newKeeper;
        emit KeeperUpdated(previous, newKeeper);
    }

    function setPaymaster(address newPaymaster) external onlyOwner {
        if (newPaymaster == address(0)) revert ZeroAddress();
        address previous = paymaster;
        paymaster = newPaymaster;
        emit PaymasterUpdated(previous, newPaymaster);
    }

    function setThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0) revert InvalidConfig();
        uint256 previous = threshold;
        threshold = newThreshold;
        emit ThresholdUpdated(previous, newThreshold);
    }

    function setTopUpAmount(uint256 newAmount) external onlyOwner {
        if (newAmount == 0) revert InvalidConfig();
        uint256 previous = topUpAmount;
        topUpAmount = newAmount;
        emit TopUpAmountUpdated(previous, newAmount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
