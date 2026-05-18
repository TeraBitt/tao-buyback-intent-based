// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IStaking {
    function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external payable;
}

contract TestRealPrecompile is Script {
    address constant ISTAKING = 0x0000000000000000000000000000000000000805;
    bytes32 constant SUBNET_310_HOTKEY = 0x40bf96334d365947a24b546ab25fc62563a5e843e812e8fcf8904682b6483f7e;
    uint16 constant SUBNET_310 = 310;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("Calling addStake precompile directly from contract on Subnet 310...");
        try IStaking(ISTAKING).addStake{value: 1.0 ether}(SUBNET_310_HOTKEY, 1 * 1e9, SUBNET_310) {
            console.log("Staking direct call succeeded!");
        } catch Error(string memory reason) {
            console.log("Staking failed with reason:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Staking failed with low level data:");
            console.logBytes(lowLevelData);
        }

        vm.stopBroadcast();
    }
}
