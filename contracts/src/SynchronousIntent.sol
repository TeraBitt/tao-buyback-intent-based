// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";

address constant ISTAKING_ADDRESS = 0x0000000000000000000000000000000000000805;

interface IStaking {
    function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external;
    function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external;
    function removeStakeFull(bytes32 hotkey, uint256 netuid) external;
    function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256);
    function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256);
}

/**
 * @title SynchronousIntent
 * @dev Platform that allows users to deposit TAO and automatically stake it to a specific Bittensor hotkey.
 * It uses the built-in IStaking precompile to execute the stake and validates the return.
 * If the Alpha token balance (representing the staked TAO) does not increase, the transaction reverts.
 */
contract SynchronousIntent {
    address public owner;

    event StakeExecuted(address indexed user, bytes32 indexed hotkey, uint256 taoAmount, uint256 netuid, uint256 alphaReceived);
    event UnstakeExecuted(address indexed user, bytes32 indexed hotkey, uint256 alphaAmount, uint256 netuid, uint256 taoReceived);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Returns this contract's coldkey as bytes32 for precompile queries.
    function getColdkey() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    /// @notice Returns the contract's Alpha stake for a given hotkey and netuid.
    function getMyStake(bytes32 hotkey, uint256 netuid) public view returns (uint256) {
        return IStaking(ISTAKING_ADDRESS).getStake(hotkey, getColdkey(), netuid);
    }

    /**
     * @notice Purchases Alpha token by staking TAO synchronously via the precompile.
     * @param amountInWei The amount of TAO to stake (in WEI).
     * @param minAlphaInRao The minimum Alpha tokens expected to be received (in RAO).
     * @param hotkey The Bittensor hotkey to stake to.
     * @param netuid The subnet UID to stake on.
     */
    function buyAlpha(
        uint256 amountInWei,
        uint256 minAlphaInRao,
        bytes32 hotkey,
        uint16 netuid
    ) external payable {
        require(amountInWei > 0, "Amount must be greater than 0");
        require(minAlphaInRao > 0, "Min Alpha must be greater than 0");
        require(msg.value == amountInWei, "Send exact TAO");

        // 1. Record hotkey's total alpha stake before the operation
        uint256 balanceBefore = IStaking(ISTAKING_ADDRESS).getTotalAlphaStaked(hotkey, netuid);

        // 2. Call the precompile to add stake
        uint256 amountInRao = amountInWei / 1e9;
        bytes memory data = abi.encodeWithSelector(
            IStaking.addStake.selector,
            hotkey,
            amountInRao,
            netuid
        );

        (bool success, ) = ISTAKING_ADDRESS.call{gas: gasleft()}(data);
        require(success, "addStake precompile call failed");

        // 3. Verify the hotkey's total alpha stake has increased by at least minAlpha
        uint256 balanceAfter = IStaking(ISTAKING_ADDRESS).getTotalAlphaStaked(hotkey, netuid);
        uint256 alphaReceived = balanceAfter - balanceBefore;

        require(alphaReceived >= minAlphaInRao, "Slippage: Received less Alpha than expected");

        emit StakeExecuted(msg.sender, hotkey, amountInWei, netuid, alphaReceived);
    }

    /**
     * @notice Sells a specific amount of Alpha by unstaking from a Bittensor hotkey.
     *         The amount is specified in Alpha RAO units. 
     *         Note: The Bittensor network enforces a minimum unstake threshold.
     * @param amountInRao The amount of Alpha token to unstake (in RAO).
     * @param minTaoWei The minimum TAO tokens expected to be received (in WEI).
     * @param hotkey The Bittensor hotkey to unstake from.
     * @param netuid The subnet UID to unstake from.
     */
    function sellAlpha(
        uint256 amountInRao,
        uint256 minTaoWei,
        bytes32 hotkey,
        uint16 netuid
    ) external {
        require(amountInRao > 0, "Amount must be greater than 0");
        require(minTaoWei > 0, "Min TAO must be greater than 0");

        // 1. Record TAO native balance before the operation
        uint256 balanceBefore = address(this).balance;

        // 2. Call the precompile to remove stake
        bytes memory data = abi.encodeWithSelector(
            IStaking.removeStake.selector,
            hotkey,
            amountInRao,
            netuid
        );

        (bool success, ) = ISTAKING_ADDRESS.call{gas: gasleft()}(data);
        require(success, "removeStake precompile call failed");

        // 3. Verify the contract's TAO native balance has increased by at least minTao
        uint256 balanceAfter = address(this).balance;
        uint256 taoReceived = balanceAfter - balanceBefore;

        require(taoReceived >= minTaoWei, "Slippage: Received less TAO than expected");

        // 4. Transfer received TAO back to user
        payable(msg.sender).transfer(taoReceived);

        emit UnstakeExecuted(msg.sender, hotkey, amountInRao, netuid, taoReceived);
    }

    /**
     * @notice Sells ALL Alpha by fully unstaking from a Bittensor hotkey.
     *         This avoids the AmountTooLow error by removing the entire position.
     * @param minTaoWei The minimum TAO tokens expected to be received (in WEI).
     * @param hotkey The Bittensor hotkey to unstake from.
     * @param netuid The subnet UID to unstake from.
     */
    function sellAlphaFull(
        uint256 minTaoWei,
        bytes32 hotkey,
        uint16 netuid
    ) external {
        // 1. Record TAO native balance before the operation
        uint256 balanceBefore = address(this).balance;

        // 2. Call the precompile to remove ALL stake
        bytes memory data = abi.encodeWithSelector(
            IStaking.removeStakeFull.selector,
            hotkey,
            netuid
        );

        (bool success, ) = ISTAKING_ADDRESS.call{gas: gasleft()}(data);
        require(success, "removeStakeFull precompile call failed");

        // 3. Verify the contract received TAO
        uint256 balanceAfter = address(this).balance;
        uint256 taoReceived = balanceAfter - balanceBefore;

        require(taoReceived >= minTaoWei, "Slippage: Received less TAO than expected");

        // 4. Transfer received TAO back to user
        payable(msg.sender).transfer(taoReceived);

        emit UnstakeExecuted(msg.sender, hotkey, 0, netuid, taoReceived);
    }

    // Required to receive native TAO from the Staking precompile during sellAlpha
    receive() external payable {}
}

