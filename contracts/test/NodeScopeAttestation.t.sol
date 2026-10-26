// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../NodeScopeAttestation.sol";

/// @notice Foundry tests for the ownerless NodeScopeAttestation registry.
/// Run with: forge test (from the repo root).
contract NodeScopeAttestationTest is Test {
    NodeScopeAttestation registry;
    address alice = address(0xA11CE);
    bytes32 constant HASH = keccak256("nodescope-report-1");
    string constant ENDPOINT = "https://test-evm-rpc-v3.portaldot.dev";
    uint256 constant CHAIN_ID = 420420777;

    function setUp() public {
        registry = new NodeScopeAttestation();
    }

    function test_anchor_success() public {
        vm.prank(alice);
        registry.anchor(HASH, ENDPOINT, CHAIN_ID, 179228);
        assertTrue(registry.isAnchored(HASH));
        assertEq(registry.anchorerOf(HASH), alice);
    }

    function test_anchor_emptyHash_reverts() public {
        vm.expectRevert("empty report hash");
        registry.anchor(bytes32(0), ENDPOINT, CHAIN_ID, 1);
    }

    function test_anchor_doubleAnchor_reverts() public {
        registry.anchor(HASH, ENDPOINT, CHAIN_ID, 1);
        vm.expectRevert("already anchored");
        registry.anchor(HASH, ENDPOINT, CHAIN_ID, 2);
    }

    function test_anchor_emitsAttested() public {
        vm.expectEmit(true, true, false, true);
        emit NodeScopeAttestation.Attested(HASH, address(this), ENDPOINT, CHAIN_ID, 179228, block.timestamp);
        registry.anchor(HASH, ENDPOINT, CHAIN_ID, 179228);
    }

    function test_isAnchored_falseBefore_trueAfter() public {
        assertFalse(registry.isAnchored(HASH));
        registry.anchor(HASH, ENDPOINT, CHAIN_ID, 1);
        assertTrue(registry.isAnchored(HASH));
    }
}
