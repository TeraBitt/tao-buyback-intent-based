// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";

address constant ISTAKING_ADDRESS = 0x0000000000000000000000000000000000000805;

interface IStaking {
    function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external;
    function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external;
    function removeStakeFull(bytes32 hotkey, uint256 netuid) external;
    function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256);
    function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256);
}

interface ISolver {
    function executeFill(bytes calldata solverData) external;
}

enum AssetType { TAO, ALPHA }

struct Condition {
    AssetType asset;
    uint256 minOutput;
    bytes32 hotkey; 
    uint16 netuid;  
}

struct Call {
    address target;
    uint256 value;
    bytes callData;
}

struct Intent {
    address user;
    Call[] calls;
    Condition condition;
    uint256 deadline;
    uint256 nonce;
    bytes signature;
}

/**
 * @title SynchronousIntent
 * @dev Universal Intent Executor. Blindly executes dynamic callData provided by AI Agents
 *      and mathematically guarantees the output condition is met.
 */
contract SynchronousIntent is EIP712 {
    address public owner;

    // TypeHashes for EIP712 Signature Verification
    bytes32 private constant CONDITION_TYPEHASH = keccak256("Condition(uint8 asset,uint256 minOutput,bytes32 hotkey,uint16 netuid)");
    bytes32 private constant CALL_TYPEHASH = keccak256("Call(address target,uint256 value,bytes callData)");
    bytes32 private constant INTENT_TYPEHASH = keccak256("Intent(address user,Call[] calls,Condition condition,uint256 deadline,uint256 nonce)Call(address target,uint256 value,bytes callData)Condition(uint8 asset,uint256 minOutput,bytes32 hotkey,uint16 netuid)");

    mapping(uint256 => bool) public usedNonces;

    event IntentFilled(address indexed user, address indexed solver, uint256 nonce);

    constructor() EIP712("SynchronousIntent", "1") {
        owner = msg.sender;
    }

    function getColdkey() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    function domainSeparator() public view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _hashCondition(Condition calldata condition) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            CONDITION_TYPEHASH,
            condition.asset,
            condition.minOutput,
            condition.hotkey,
            condition.netuid
        ));
    }

    function _hashCalls(Call[] calldata calls) internal pure returns (bytes32) {
        bytes32[] memory callHashes = new bytes32[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            callHashes[i] = keccak256(abi.encode(
                CALL_TYPEHASH,
                calls[i].target,
                calls[i].value,
                keccak256(calls[i].callData)
            ));
        }
        return keccak256(abi.encodePacked(callHashes));
    }

    function _verifySignature(Intent calldata intent) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.user,
                _hashCalls(intent.calls),
                _hashCondition(intent.condition),
                intent.deadline,
                intent.nonce
            )
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, intent.signature);
        return signer == intent.user;
    }

    function fillIntent(Intent calldata intent, bytes calldata solverData) external payable {
        require(_verifySignature(intent), "bad sig");
        require(block.timestamp <= intent.deadline, "expired");
        require(!usedNonces[intent.nonce], "replayed");
        
        // Mark used to prevent reentrancy loops
        usedNonces[intent.nonce] = true;

        // Snapshot state BEFORE execution
        uint256 taoBalanceBeforeCall = address(this).balance;
        uint256 alphaBalanceBeforeCall = 0;
        
        if (intent.condition.asset == AssetType.ALPHA) {
            alphaBalanceBeforeCall = IStaking(ISTAKING_ADDRESS).getTotalAlphaStaked(intent.condition.hotkey, intent.condition.netuid);
        }

        // 1. Solver callback to prepare state/funds
        if (solverData.length > 0) {
            ISolver(msg.sender).executeFill(solverData);
        }

        // 2. Blindly execute the dynamic calls prepared by the AI agent
        uint256 remainingMsgValue = msg.value;

        for (uint256 i = 0; i < intent.calls.length; i++) {
            uint256 available = address(this).balance;
            if (available < remainingMsgValue) {
                available = remainingMsgValue;
            }
            
            require(available >= intent.calls[i].value, "Insufficient TAO for call");
            
            if (remainingMsgValue >= intent.calls[i].value) {
                remainingMsgValue -= intent.calls[i].value;
            } else {
                remainingMsgValue = 0;
            }
            
            (bool success, ) = intent.calls[i].target.call{value: intent.calls[i].value}(intent.calls[i].callData);
            require(success, "AI function call failed");
        }

        // 3. Verify the core guarantee mathematically
        if (intent.condition.asset == AssetType.ALPHA) {
            uint256 alphaBalanceAfterCall = IStaking(ISTAKING_ADDRESS).getTotalAlphaStaked(intent.condition.hotkey, intent.condition.netuid);
            uint256 alphaReceived = alphaBalanceAfterCall - alphaBalanceBeforeCall;
            require(alphaReceived >= intent.condition.minOutput, "output condition not met");
        } else {
            uint256 taoBalanceAfterCall = address(this).balance;
            require(taoBalanceAfterCall >= taoBalanceBeforeCall, "TAO balance decreased");
            uint256 taoReceived = taoBalanceAfterCall - taoBalanceBeforeCall;
            require(taoReceived >= intent.condition.minOutput, "output condition not met");

            // Pay user their guaranteed minimum TAO
            payable(intent.user).transfer(intent.condition.minOutput);
        }

        // 4. Sweep remaining TAO to solver.
        // This elegantly handles both refunding unspent msg.value AND paying the solver their spread fee.
        uint256 remainingTao = address(this).balance;
        if (remainingTao > 0) {
            payable(msg.sender).transfer(remainingTao);
        }

        emit IntentFilled(intent.user, msg.sender, intent.nonce);
    }

    // Required to receive Native TAO from precompiles/solvers
    receive() external payable {}
}
