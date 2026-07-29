// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PayoutDistributor} from "../src/PayoutDistributor.sol";

/// forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC_URL --broadcast
contract Deploy is Script {
    function run() external returns (PayoutDistributor distributor) {
        address admin = vm.envAddress("PAYOUT_ADMIN");
        address treasury = vm.envOr("PAYOUT_TREASURY", admin);

        vm.startBroadcast();
        distributor = new PayoutDistributor(admin, treasury);
        vm.stopBroadcast();

        console2.log("PayoutDistributor:", address(distributor));
        console2.log("admin:", admin);
        console2.log("treasury:", treasury);
    }
}
