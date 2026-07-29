// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PayoutDistributor
/// @notice Batch stablecoin payouts with maker/checker approval. Funds stay in the
///         treasury wallet; this contract only spends an ERC-20 allowance granted to it.
contract PayoutDistributor is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_RECIPIENTS_PER_CALL = 500;

    enum BatchStatus {
        None,
        Pending,
        Approved,
        Executed,
        Cancelled
    }

    struct Batch {
        bytes32 payloadHash;
        address token;
        uint256 total;
        uint32 recipientCount;
        BatchStatus status;
        address submittedBy;
        address approvedBy;
    }

    address public treasury;
    mapping(bytes32 batchId => Batch) private _batches;

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event BatchSubmitted(
        bytes32 indexed batchId,
        address indexed token,
        uint256 total,
        uint32 recipientCount,
        bytes32 payloadHash,
        address indexed submittedBy
    );
    event BatchApproved(bytes32 indexed batchId, address indexed approvedBy);
    event BatchCancelled(bytes32 indexed batchId, address indexed cancelledBy);
    event BatchExecuted(bytes32 indexed batchId, address indexed token, uint256 total, uint32 recipientCount);
    event PayoutSent(bytes32 indexed batchId, address indexed recipient, uint256 amount);

    error ZeroAddress();
    error EmptyBatch();
    error TooManyRecipients(uint256 count);
    error LengthMismatch();
    error BatchExists(bytes32 batchId);
    error BatchNotPending(bytes32 batchId);
    error BatchNotApproved(bytes32 batchId);
    error PayloadMismatch(bytes32 batchId);
    error SelfApprovalForbidden();
    error ZeroAmount(uint256 index);
    error InvalidRecipient(uint256 index);

    constructor(address admin, address treasury_) {
        if (admin == address(0) || treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        emit TreasuryUpdated(address(0), treasury_);
    }

    /// @notice Commitment over the exact payout payload, checked again at execution time.
    function hashPayload(address token, address[] calldata recipients, uint256[] calldata amounts)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(token, recipients, amounts));
    }

    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Maker step: register a batch and commit to its payload.
    function submitBatch(
        bytes32 batchId,
        address token,
        uint256 total,
        uint32 recipientCount,
        bytes32 payloadHash
    ) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (recipientCount == 0) revert EmptyBatch();
        if (recipientCount > MAX_RECIPIENTS_PER_CALL) revert TooManyRecipients(recipientCount);
        if (_batches[batchId].status != BatchStatus.None) revert BatchExists(batchId);

        _batches[batchId] = Batch({
            payloadHash: payloadHash,
            token: token,
            total: total,
            recipientCount: recipientCount,
            status: BatchStatus.Pending,
            submittedBy: msg.sender,
            approvedBy: address(0)
        });

        emit BatchSubmitted(batchId, token, total, recipientCount, payloadHash, msg.sender);
    }

    /// @notice Checker step: a second party approves the batch before it can be executed.
    function approveBatch(bytes32 batchId) external whenNotPaused onlyRole(APPROVER_ROLE) {
        Batch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Pending) revert BatchNotPending(batchId);
        if (batch.submittedBy == msg.sender) revert SelfApprovalForbidden();

        batch.status = BatchStatus.Approved;
        batch.approvedBy = msg.sender;
        emit BatchApproved(batchId, msg.sender);
    }

    function cancelBatch(bytes32 batchId) external onlyRole(OPERATOR_ROLE) {
        Batch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Pending && batch.status != BatchStatus.Approved) {
            revert BatchNotPending(batchId);
        }
        batch.status = BatchStatus.Cancelled;
        emit BatchCancelled(batchId, msg.sender);
    }

    /// @notice Executes an approved batch, pulling funds from the treasury allowance.
    function executeBatch(bytes32 batchId, address[] calldata recipients, uint256[] calldata amounts)
        external
        whenNotPaused
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        Batch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Approved) revert BatchNotApproved(batchId);
        if (recipients.length != amounts.length) revert LengthMismatch();
        if (recipients.length != batch.recipientCount) revert LengthMismatch();
        if (hashPayload(batch.token, recipients, amounts) != batch.payloadHash) revert PayloadMismatch(batchId);

        batch.status = BatchStatus.Executed;

        IERC20 token = IERC20(batch.token);
        address from = treasury;
        uint256 sent;
        for (uint256 i; i < recipients.length; ++i) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            if (recipient == address(0)) revert InvalidRecipient(i);
            if (amount == 0) revert ZeroAmount(i);
            sent += amount;
            token.safeTransferFrom(from, recipient, amount);
            emit PayoutSent(batchId, recipient, amount);
        }

        batch.total = sent;
        emit BatchExecuted(batchId, batch.token, sent, batch.recipientCount);
    }
}
