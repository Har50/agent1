// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PaymasterAutoTopUp} from "../src/PaymasterAutoTopUp.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract PaymasterAutoTopUpTest is Test {
    MockERC20 internal usdc;
    PaymasterAutoTopUp internal vault;

    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal paymaster = makeAddr("paymaster");
    address internal stranger = makeAddr("stranger");
    address internal alice = makeAddr("alice");

    uint256 internal constant THRESHOLD = 100e6; // 100 USDC
    uint256 internal constant TOP_UP = 50e6; // 50 USDC
    uint256 internal constant VAULT_SEED = 500e6; // 500 USDC

    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);
    event PaymasterUpdated(address indexed previousPaymaster, address indexed newPaymaster);
    event ThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);
    event TopUpAmountUpdated(uint256 previousAmount, uint256 newAmount);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ToppedUp(
        address indexed caller, address indexed paymaster, uint256 amount, uint256 paymasterBalanceAfter
    );

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);

        vm.prank(owner);
        vault = new PaymasterAutoTopUp(address(usdc), paymaster, keeper, THRESHOLD, TOP_UP);

        usdc.mint(owner, 10_000e6);
        usdc.mint(alice, 10_000e6);

        vm.startPrank(owner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(VAULT_SEED);
        vm.stopPrank();
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function test_constructor_setsImmutableAndConfig() public view {
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.paymaster(), paymaster);
        assertEq(vault.keeper(), keeper);
        assertEq(vault.threshold(), THRESHOLD);
        assertEq(vault.topUpAmount(), TOP_UP);
        assertEq(vault.owner(), owner);
        assertEq(vault.vaultBalance(), VAULT_SEED);
        assertEq(vault.totalToppedUp(), 0);
        assertEq(vault.topUpCount(), 0);
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(PaymasterAutoTopUp.ZeroAddress.selector);
        new PaymasterAutoTopUp(address(0), paymaster, keeper, THRESHOLD, TOP_UP);
    }

    function test_constructor_revertsOnZeroPaymaster() public {
        vm.expectRevert(PaymasterAutoTopUp.ZeroAddress.selector);
        new PaymasterAutoTopUp(address(usdc), address(0), keeper, THRESHOLD, TOP_UP);
    }

    function test_constructor_revertsOnZeroThreshold() public {
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        new PaymasterAutoTopUp(address(usdc), paymaster, keeper, 0, TOP_UP);
    }

    function test_constructor_revertsOnZeroTopUpAmount() public {
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        new PaymasterAutoTopUp(address(usdc), paymaster, keeper, THRESHOLD, 0);
    }

    function test_constructor_allowsZeroKeeper() public {
        PaymasterAutoTopUp v =
            new PaymasterAutoTopUp(address(usdc), paymaster, address(0), THRESHOLD, TOP_UP);
        assertEq(v.keeper(), address(0));
    }

    // =========================================================================
    // Views: needsTopUp / balances
    // =========================================================================

    function test_needsTopUp_trueWhenPaymasterBelowThreshold() public view {
        // paymaster has 0 USDC
        assertTrue(vault.needsTopUp());
        assertEq(vault.paymasterBalance(), 0);
    }

    function test_needsTopUp_falseWhenPaymasterAtOrAboveThreshold() public {
        usdc.mint(paymaster, THRESHOLD);
        assertFalse(vault.needsTopUp());

        usdc.mint(paymaster, 1);
        assertFalse(vault.needsTopUp());
    }

    function test_needsTopUp_falseWhenVaultCannotCoverTopUp() public {
        // Drain vault below TOP_UP
        vm.prank(owner);
        vault.withdraw(VAULT_SEED - (TOP_UP - 1));
        assertLt(vault.vaultBalance(), TOP_UP);
        assertEq(vault.paymasterBalance(), 0);
        assertFalse(vault.needsTopUp());
    }

    // =========================================================================
    // Deposit
    // =========================================================================

    function test_deposit_transfersTokensAndEmits() public {
        uint256 amount = 25e6;
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);

        vm.expectEmit(true, false, false, true);
        emit Deposited(alice, amount);
        vault.deposit(amount);
        vm.stopPrank();

        assertEq(vault.vaultBalance(), VAULT_SEED + amount);
        assertEq(usdc.balanceOf(alice), 10_000e6 - amount);
    }

    function test_deposit_revertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        vault.deposit(0);
    }

    function test_deposit_revertsWhenPaused() public {
        vm.prank(owner);
        vault.pause();

        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(1e6);
        vm.stopPrank();
    }

    // =========================================================================
    // Withdraw
    // =========================================================================

    function test_withdraw_ownerCanWithdraw() public {
        uint256 amount = 10e6;
        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(owner, amount);

        vm.prank(owner);
        vault.withdraw(amount);

        assertEq(vault.vaultBalance(), VAULT_SEED - amount);
        assertEq(usdc.balanceOf(owner), ownerBefore + amount);
    }

    function test_withdraw_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.withdraw(1e6);
    }

    function test_withdraw_revertsForKeeper() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.withdraw(1e6);
    }

    function test_withdraw_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        vault.withdraw(0);
    }

    function test_withdraw_revertsWhenInsufficient() public {
        vm.prank(owner);
        vm.expectRevert(PaymasterAutoTopUp.InsufficientVaultBalance.selector);
        vault.withdraw(VAULT_SEED + 1);
    }

    // =========================================================================
    // executeTopUp — access control
    // =========================================================================

    function test_executeTopUp_keeperSucceeds() public {
        assertEq(vault.paymasterBalance(), 0);

        vm.expectEmit(true, true, false, true);
        emit ToppedUp(keeper, paymaster, TOP_UP, TOP_UP);

        vm.prank(keeper);
        vault.executeTopUp();

        assertEq(vault.paymasterBalance(), TOP_UP);
        assertEq(vault.vaultBalance(), VAULT_SEED - TOP_UP);
        assertEq(vault.totalToppedUp(), TOP_UP);
        assertEq(vault.topUpCount(), 1);
    }

    function test_executeTopUp_ownerSucceeds() public {
        vm.prank(owner);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), TOP_UP);
        assertEq(vault.topUpCount(), 1);
    }

    function test_executeTopUp_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(PaymasterAutoTopUp.Unauthorized.selector);
        vault.executeTopUp();
    }

    function test_executeTopUp_revertsWhenNotNeeded() public {
        usdc.mint(paymaster, THRESHOLD);
        vm.prank(keeper);
        vm.expectRevert(PaymasterAutoTopUp.TopUpNotNeeded.selector);
        vault.executeTopUp();
    }

    function test_executeTopUp_revertsWhenVaultEmpty() public {
        vm.prank(owner);
        vault.withdraw(VAULT_SEED);

        vm.prank(keeper);
        vm.expectRevert(PaymasterAutoTopUp.InsufficientVaultBalance.selector);
        vault.executeTopUp();
    }

    function test_executeTopUp_revertsWhenPaused() public {
        vm.prank(owner);
        vault.pause();

        vm.prank(keeper);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.executeTopUp();
    }

    function test_executeTopUp_multipleUntilAboveThreshold() public {
        // threshold 100, top-up 50 → need 2 top-ups to reach 100 (still < after first)
        vm.prank(keeper);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), 50e6);
        assertTrue(vault.needsTopUp());

        vm.prank(keeper);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), 100e6);
        // balance == threshold → not needed (strictly below)
        assertFalse(vault.needsTopUp());

        vm.prank(keeper);
        vm.expectRevert(PaymasterAutoTopUp.TopUpNotNeeded.selector);
        vault.executeTopUp();

        assertEq(vault.topUpCount(), 2);
        assertEq(vault.totalToppedUp(), 100e6);
    }

    // =========================================================================
    // Admin setters
    // =========================================================================

    function test_setKeeper_updatesAndEmits() public {
        address newKeeper = makeAddr("newKeeper");

        vm.expectEmit(true, true, false, false);
        emit KeeperUpdated(keeper, newKeeper);

        vm.prank(owner);
        vault.setKeeper(newKeeper);
        assertEq(vault.keeper(), newKeeper);

        // old keeper unauthorized; new keeper ok
        vm.prank(keeper);
        vm.expectRevert(PaymasterAutoTopUp.Unauthorized.selector);
        vault.executeTopUp();

        vm.prank(newKeeper);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), TOP_UP);
    }

    function test_setKeeper_allowsZeroToDisableKeeper() public {
        vm.prank(owner);
        vault.setKeeper(address(0));

        vm.prank(keeper);
        vm.expectRevert(PaymasterAutoTopUp.Unauthorized.selector);
        vault.executeTopUp();

        // owner still works
        vm.prank(owner);
        vault.executeTopUp();
    }

    function test_setKeeper_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setKeeper(stranger);
    }

    function test_setPaymaster_updatesRecipient() public {
        address newPm = makeAddr("newPaymaster");

        vm.expectEmit(true, true, false, false);
        emit PaymasterUpdated(paymaster, newPm);

        vm.prank(owner);
        vault.setPaymaster(newPm);
        assertEq(vault.paymaster(), newPm);

        vm.prank(keeper);
        vault.executeTopUp();
        assertEq(usdc.balanceOf(newPm), TOP_UP);
        assertEq(usdc.balanceOf(paymaster), 0);
    }

    function test_setPaymaster_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PaymasterAutoTopUp.ZeroAddress.selector);
        vault.setPaymaster(address(0));
    }

    function test_setThreshold_updates() public {
        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(THRESHOLD, 200e6);

        vm.prank(owner);
        vault.setThreshold(200e6);
        assertEq(vault.threshold(), 200e6);
    }

    function test_setThreshold_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        vault.setThreshold(0);
    }

    function test_setTopUpAmount_updates() public {
        vm.expectEmit(false, false, false, true);
        emit TopUpAmountUpdated(TOP_UP, 75e6);

        vm.prank(owner);
        vault.setTopUpAmount(75e6);
        assertEq(vault.topUpAmount(), 75e6);

        vm.prank(keeper);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), 75e6);
    }

    function test_setTopUpAmount_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PaymasterAutoTopUp.InvalidConfig.selector);
        vault.setTopUpAmount(0);
    }

    // =========================================================================
    // Pause
    // =========================================================================

    function test_pause_unpause_roundTrip() public {
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());

        vm.prank(owner);
        vault.unpause();
        assertFalse(vault.paused());

        vm.prank(keeper);
        vault.executeTopUp();
        assertEq(vault.paymasterBalance(), TOP_UP);
    }

    function test_pause_revertsForNonOwner() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.pause();
    }

    // =========================================================================
    // Security: non-owner cannot drain vault via top-up misdirection
    // =========================================================================

    function test_strangerCannotChangePaymasterOrDrain() public {
        uint256 vaultBefore = vault.vaultBalance();
        uint256 strangerBefore = usdc.balanceOf(stranger);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setPaymaster(stranger);

        vm.prank(stranger);
        vm.expectRevert(PaymasterAutoTopUp.Unauthorized.selector);
        vault.executeTopUp();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.withdraw(1);

        assertEq(vault.vaultBalance(), vaultBefore);
        assertEq(usdc.balanceOf(stranger), strangerBefore);
    }

    // =========================================================================
    // Fuzz tests
    // =========================================================================

    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 beforeBal = vault.vaultBalance();
        vault.deposit(amount);
        vm.stopPrank();

        assertEq(vault.vaultBalance(), beforeBal + amount);
    }

    function testFuzz_withdraw(uint256 amount) public {
        amount = bound(amount, 1, VAULT_SEED);
        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        vault.withdraw(amount);

        assertEq(vault.vaultBalance(), VAULT_SEED - amount);
        assertEq(usdc.balanceOf(owner), ownerBefore + amount);
    }

    function testFuzz_executeTopUp_onlyWhenBelowThreshold(uint256 pmSeed) public {
        pmSeed = bound(pmSeed, 0, THRESHOLD * 2);
        usdc.mint(paymaster, pmSeed);

        if (pmSeed < THRESHOLD) {
            vm.prank(keeper);
            vault.executeTopUp();
            assertEq(vault.paymasterBalance(), pmSeed + TOP_UP);
        } else {
            vm.prank(keeper);
            vm.expectRevert(PaymasterAutoTopUp.TopUpNotNeeded.selector);
            vault.executeTopUp();
            assertEq(vault.paymasterBalance(), pmSeed);
        }
    }

    function testFuzz_setThresholdAndTopUp(uint256 newThreshold, uint256 newTopUp) public {
        newThreshold = bound(newThreshold, 1, 10_000e6);
        newTopUp = bound(newTopUp, 1, 5_000e6);

        vm.startPrank(owner);
        vault.setThreshold(newThreshold);
        vault.setTopUpAmount(newTopUp);
        vm.stopPrank();

        assertEq(vault.threshold(), newThreshold);
        assertEq(vault.topUpAmount(), newTopUp);

        // Ensure vault funded for one top-up
        if (vault.vaultBalance() < newTopUp) {
            uint256 need = newTopUp - vault.vaultBalance();
            usdc.mint(owner, need);
            vm.startPrank(owner);
            usdc.approve(address(vault), need);
            vault.deposit(need);
            vm.stopPrank();
        }

        // Clear paymaster
        uint256 pmBal = usdc.balanceOf(paymaster);
        if (pmBal > 0) {
            vm.prank(paymaster);
            usdc.transfer(address(0xdead), pmBal);
        }

        if (0 < newThreshold) {
            vm.prank(keeper);
            vault.executeTopUp();
            assertEq(usdc.balanceOf(paymaster), newTopUp);
        }
    }

    function testFuzz_unauthorizedCannotExecute(address caller) public {
        vm.assume(caller != owner && caller != keeper);
        vm.prank(caller);
        vm.expectRevert(PaymasterAutoTopUp.Unauthorized.selector);
        vault.executeTopUp();
    }

    // =========================================================================
    // Invariant helpers exposed via public state for handler
    // =========================================================================

    function test_invariant_accountingAfterTopUps() public {
        // Simulate paymaster spending then multiple top-ups
        for (uint256 i = 0; i < 5; i++) {
            // Spend paymaster down below threshold if needed
            uint256 pm = usdc.balanceOf(paymaster);
            if (pm >= THRESHOLD) {
                vm.prank(paymaster);
                usdc.transfer(address(0xdead), pm - (THRESHOLD / 2));
            }
            if (vault.vaultBalance() < TOP_UP) break;
            vm.prank(keeper);
            vault.executeTopUp();
        }

        assertEq(vault.totalToppedUp(), vault.topUpCount() * TOP_UP);
        assertEq(usdc.balanceOf(address(vault)) + vault.totalToppedUp(), VAULT_SEED);
    }
}
