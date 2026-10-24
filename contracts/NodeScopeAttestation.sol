// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NodeScopeAttestation
/// @notice A minimal, ownerless registry that anchors a NodeScope diagnostic
/// report's SHA-256 integrity hash on chain. It proves that a report with
/// this hash existed at the time of the anchoring transaction, and nothing
/// more. It does not prove that the node data inside the report was true:
/// that is what the report's own records, timestamps, and the /verify check
/// are for.
/// @dev No owner, no upgrade, no fees, no token. Anyone may anchor any
/// report hash once. Anchoring twice is rejected so one hash maps to one
/// first anchor. The contract is testnet-only by deployment choice, not by
/// code: deploy it only on a testnet, with a throwaway testnet wallet.
contract NodeScopeAttestation {
    /// @notice Emitted when a report hash is anchored for the first time.
    event Attested(
        bytes32 indexed reportHash,
        address indexed anchorer,
        string endpoint,
        uint256 chainId,
        uint256 blockNumber,
        uint256 timestamp
    );

    /// @notice True once a report hash has been anchored.
    mapping(bytes32 => bool) public anchored;

    /// @notice The address that first anchored a report hash.
    mapping(bytes32 => address) public anchorerOf;

    /// @notice Anchor a report hash. Reverts on an empty hash or a second
    /// anchor of the same hash.
    function anchor(
        bytes32 reportHash,
        string calldata endpoint,
        uint256 chainId,
        uint256 blockNumber
    ) external {
        require(reportHash != bytes32(0), "empty report hash");
        require(!anchored[reportHash], "already anchored");
        anchored[reportHash] = true;
        anchorerOf[reportHash] = msg.sender;
        emit Attested(reportHash, msg.sender, endpoint, chainId, blockNumber, block.timestamp);
    }

    /// @notice Read-only check: has this report hash been anchored?
    function isAnchored(bytes32 reportHash) external view returns (bool) {
        return anchored[reportHash];
    }
}
