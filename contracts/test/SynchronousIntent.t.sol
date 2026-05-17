// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SynchronousIntent.sol";

// Mock for the Staking Precompile
contract MockStakingPrecompile {
    bool public shouldFail;
    bool public slippageSimulation;

    // hotkey -> netuid -> total stake
    mapping(bytes32 => mapping(uint256 => uint256)) public stakes;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function setSlippageSimulation(bool _slippageSimulation) external {
        slippageSimulation = _slippageSimulation;
    }

    function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256) {
        return stakes[hotkey][netuid];
    }

    // Allow tests to set initial stake
    function setStake(bytes32 hotkey, uint256 netuid, uint256 amount) external {
        stakes[hotkey][netuid] = amount;
    }

    function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external {
        require(!shouldFail, "Precompile configured to fail");

        uint256 amountToAdd = amount;
        if (slippageSimulation) {
            amountToAdd = amount / 2; // Simulate receiving less stake
        }

        stakes[hotkey][netuid] += amountToAdd;
    }

    function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external {
        require(!shouldFail, "Precompile configured to fail");
        
        require(stakes[hotkey][netuid] >= amount, "Not enough mock stake");
        stakes[hotkey][netuid] -= amount;

        uint256 amountToMint = amount * 1e9;
        if (slippageSimulation) {
            amountToMint = (amount * 1e9) / 2; // Simulate receiving less TAO
        }
        
        // Native TAO transfer back to caller (SynchronousIntent)
        payable(msg.sender).transfer(amountToMint);
    }

    // Required to receive TAO native token when it's sent along with the call or via fallback
    receive() external payable {}
}

contract SynchronousIntentTest is Test {
    SynchronousIntent public intentContract;

    address public user = address(0x1234);
    bytes32 public testHotkey = keccak256("test_hotkey");
    uint16 public testNetuid = 1;

    function setUp() public {
        intentContract = new SynchronousIntent();

        // Initial TAO for testing
        vm.deal(user, 100 * 1e18);

        // 1. Etch the mock bytecode to the precompile addresses
        vm.etch(ISTAKING_ADDRESS, address(new MockStakingPrecompile()).code);

        // Provide the mock staking precompile with native TAO to simulate network minting
        vm.deal(ISTAKING_ADDRESS, 1000 * 1e18);
    }

    function test_BuyAlphaSuccess() public {
        vm.startPrank(user);

        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);
        vm.stopPrank();

        // Check user TAO balance
        assertEq(user.balance, 50 * 1e18); // 50 TAO spent
        
        // Check global stake
        assertEq(MockStakingPrecompile(payable(ISTAKING_ADDRESS)).getTotalAlphaStaked(testHotkey, testNetuid), 50 * 1e9);
    }

    function test_BuyAlphaRevertsIfPrecompileFails() public {
        vm.startPrank(user);

        MockStakingPrecompile(payable(ISTAKING_ADDRESS)).setShouldFail(true);

        vm.expectRevert("addStake precompile call failed");
        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);
        vm.stopPrank();
    }

    function test_BuyAlphaRevertsOnSlippage() public {
        vm.startPrank(user);

        MockStakingPrecompile(payable(ISTAKING_ADDRESS)).setSlippageSimulation(true);

        // Expecting 50 Alpha, but mock only adds 25 (simulated slippage)
        vm.expectRevert("Slippage: Received less Alpha than expected");
        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);
        vm.stopPrank();
    }

    function test_SellAlphaSuccess() public {
        // Setup initial stake balance
        vm.startPrank(user);
        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);

        // Now sell
        intentContract.sellAlpha(50 * 1e9, 50 * 1e18, testHotkey, testNetuid);
        vm.stopPrank();

        // User should have their TAO back
        assertEq(user.balance, 100 * 1e18); 
    }



    function test_SellAlphaRevertsIfPrecompileFails() public {
        vm.startPrank(user);
        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);

        MockStakingPrecompile(payable(ISTAKING_ADDRESS)).setShouldFail(true);

        vm.expectRevert("removeStake precompile call failed");
        intentContract.sellAlpha(50 * 1e9, 50 * 1e18, testHotkey, testNetuid);
        vm.stopPrank();
    }

    function test_SellAlphaRevertsOnSlippage() public {
        vm.startPrank(user);
        intentContract.buyAlpha{value: 50 * 1e18}(50 * 1e18, 50 * 1e9, testHotkey, testNetuid);

        MockStakingPrecompile(payable(ISTAKING_ADDRESS)).setSlippageSimulation(true);

        // Expecting 50 TAO, but mock only mints 25 (simulated slippage)
        vm.expectRevert("Slippage: Received less TAO than expected");
        intentContract.sellAlpha(50 * 1e9, 50 * 1e18, testHotkey, testNetuid);
        vm.stopPrank();
    }
}
