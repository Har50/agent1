// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PaymasterAutoTopUp} from "../src/PaymasterAutoTopUp.sol";

/// @notice Example deploy script. Set env vars before broadcasting.
contract DeployPaymasterAutoTopUp is Script {
    function run() external {
        address token = vm.envAddress("USDC_ADDRESS");
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        address keeper = vm.envOr("KEEPER_ADDRESS", address(0));
        uint256 threshold = vm.envOr("TOPUP_THRESHOLD", uint256(100e6));
        uint256 topUpAmount = vm.envOr("TOPUP_AMOUNT", uint256(50e6));

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        PaymasterAutoTopUp vault =
            new PaymasterAutoTopUp(token, paymaster, keeper, threshold, topUpAmount);
        vm.stopBroadcast();

        console2.log("PaymasterAutoTopUp deployed:", address(vault));
    }
}
