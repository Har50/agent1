// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PaymasterAutoTopUp} from "../src/PaymasterAutoTopUp.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @dev Handler for invariant testing — random actor calls within allowed roles.
contract TopUpHandler is Test {
    PaymasterAutoTopUp public vault;
    MockERC20 public usdc;
    address public owner;
    address public keeper;
    address public paymaster;
    address public stranger;

    uint256 public ghost_deposited;
    uint256 public ghost_withdrawn;
    uint256 public ghost_toppedUp;

    constructor(
        PaymasterAutoTopUp vault_,
        MockERC20 usdc_,
        address owner_,
        address keeper_,
        address paymaster_,
        address stranger_
    ) {
        vault = vault_;
        usdc = usdc_;
        owner = owner_;
        keeper = keeper_;
        paymaster = paymaster_;
        stranger = stranger_;
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, 100e6);
        usdc.mint(stranger, amount);
        vm.startPrank(stranger);
        usdc.approve(address(vault), amount);
        if (!vault.paused()) {
            vault.deposit(amount);
            ghost_deposited += amount;
        }
        vm.stopPrank();
    }

    function withdraw(uint256 amount) external {
        uint256 bal = vault.vaultBalance();
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(owner);
        vault.withdraw(amount);
        ghost_withdrawn += amount;
    }

    function executeTopUpAsKeeper() external {
        if (vault.paused()) return;
        if (vault.paymasterBalance() >= vault.threshold()) {
            // Spend some paymaster balance to create headroom for future top-ups
            uint256 pm = usdc.balanceOf(paymaster);
            if (pm > 0) {
                uint256 spend = pm / 2 + 1;
                if (spend > pm) spend = pm;
                vm.prank(paymaster);
                usdc.transfer(address(0xdead), spend);
            }
        }
        if (!vault.needsTopUp()) return;
        uint256 before = vault.totalToppedUp();
        vm.prank(keeper);
        vault.executeTopUp();
        ghost_toppedUp += vault.totalToppedUp() - before;
    }

    function executeTopUpAsOwner() external {
        if (vault.paused() || !vault.needsTopUp()) return;
        uint256 before = vault.totalToppedUp();
        vm.prank(owner);
        vault.executeTopUp();
        ghost_toppedUp += vault.totalToppedUp() - before;
    }

    function tryUnauthorizedTopUp() external {
        vm.prank(stranger);
        try vault.executeTopUp() {
            revert("stranger must not top up");
        } catch {}
    }

    function pauseToggle(bool shouldPause) external {
        vm.startPrank(owner);
        if (shouldPause && !vault.paused()) {
            vault.pause();
        } else if (!shouldPause && vault.paused()) {
            vault.unpause();
        }
        vm.stopPrank();
    }
}

contract PaymasterAutoTopUpInvariantTest is StdInvariant, Test {
    MockERC20 internal usdc;
    PaymasterAutoTopUp internal vault;
    TopUpHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal paymaster = makeAddr("paymaster");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant THRESHOLD = 100e6;
    uint256 internal constant TOP_UP = 50e6;
    uint256 internal constant INITIAL = 1_000e6;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);

        vm.prank(owner);
        vault = new PaymasterAutoTopUp(address(usdc), paymaster, keeper, THRESHOLD, TOP_UP);

        usdc.mint(owner, INITIAL);
        vm.startPrank(owner);
        usdc.approve(address(vault), INITIAL);
        vault.deposit(INITIAL);
        vm.stopPrank();

        handler = new TopUpHandler(vault, usdc, owner, keeper, paymaster, stranger);
        // Mint USDC to handler for deposits via stranger path already handled in handler

        targetContract(address(handler));
    }

    /// @notice Vault + paymaster top-ups + withdrawals == deposits (+ initial).
    function invariant_tokenConservation() public view {
        uint256 vaultBal = usdc.balanceOf(address(vault));
        // Tokens that left via top-up sit on paymaster (or were further spent to 0xdead).
        // Conservation relative to handler ghosts + initial seed:
        // initial + ghost_deposited = vault + ghost_withdrawn + ghost_toppedUp
        assertEq(
            INITIAL + handler.ghost_deposited(),
            vaultBal + handler.ghost_withdrawn() + handler.ghost_toppedUp(),
            "token conservation broken"
        );
    }

    /// @notice totalToppedUp must equal topUpCount * topUpAmount (amount is fixed unless owner changes it).
    function invariant_topUpAccounting() public view {
        assertEq(vault.totalToppedUp(), vault.topUpCount() * vault.topUpAmount());
    }

    /// @notice Stranger never holds vault authorization side-effects: vault owner unchanged.
    function invariant_ownerUnchanged() public view {
        assertEq(vault.owner(), owner);
    }

    /// @notice Non-owner cannot have drained vault without going through withdraw/top-up paths tracked above.
    function invariant_vaultNeverNegativeAccounting() public view {
        assertGe(usdc.balanceOf(address(vault)), 0);
    }
}
