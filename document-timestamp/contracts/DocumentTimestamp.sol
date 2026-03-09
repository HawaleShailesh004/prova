// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentTimestamp {

    // Data stored for each document
    struct Record {
        address owner;      // wallet that stamped it
        uint256 timestamp;  // when it was stamped
        string  docName;    // label given by user
    }

    // Core storage: hash → Record
    mapping(bytes32 => Record) private records;

    // Event emitted after every successful stamp
    event DocumentStamped(
        bytes32 indexed docHash,
        address indexed owner,
        uint256 timestamp,
        string docName
    );

    // Stamp a document hash on-chain
    function stampDocument(bytes32 docHash, string memory docName) external {
        require(records[docHash].timestamp == 0, "Document already stamped");

        records[docHash] = Record({
            owner:     msg.sender,
            timestamp: block.timestamp,
            docName:   docName
        });

        emit DocumentStamped(docHash, msg.sender, block.timestamp, docName);
    }

    // Verify if a document hash exists
    function verify(bytes32 docHash) external view returns (
        bool exists,
        address owner,
        uint256 timestamp,
        string memory docName
    ) {
        Record memory r = records[docHash];

        if (r.timestamp == 0) {
            return (false, address(0), 0, "");
        }

        return (true, r.owner, r.timestamp, r.docName);
    }
}