// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SynchronousIntent.sol";

contract DeploySynchronousIntent is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        SynchronousIntent intentContract = new SynchronousIntent();
        
        vm.stopBroadcast();
        
        console.log("SynchronousIntent deployed to:", address(intentContract));
    }
}
