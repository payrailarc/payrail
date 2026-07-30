import { keccak256, stringToHex } from "viem";

export const payoutDistributorAbi = [
  {
    type: "function",
    name: "submitBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "total", type: "uint256" },
      { name: "recipientCount", type: "uint32" },
      { name: "payloadHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approveBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "executeBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hashPayload",
    stateMutability: "pure",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "MAX_RECIPIENTS_PER_CALL",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBatch",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "payloadHash", type: "bytes32" },
          { name: "token", type: "address" },
          { name: "total", type: "uint256" },
          { name: "recipientCount", type: "uint32" },
          { name: "status", type: "uint8" },
          { name: "submittedBy", type: "address" },
          { name: "approvedBy", type: "address" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "BatchSubmitted",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "total", type: "uint256", indexed: false },
      { name: "recipientCount", type: "uint32", indexed: false },
      { name: "payloadHash", type: "bytes32", indexed: false },
      { name: "submittedBy", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BatchApproved",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "approvedBy", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BatchCancelled",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "cancelledBy", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BatchExecuted",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "total", type: "uint256", indexed: false },
      { name: "recipientCount", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutSent",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const BATCH_STATUS = ["None", "Pending", "Approved", "Executed", "Cancelled"] as const;

export type BatchStatusLabel = (typeof BATCH_STATUS)[number];

/** Role ids as declared in the contract: `keccak256("OPERATOR_ROLE")` etc. */
export const OPERATOR_ROLE = keccak256(stringToHex("OPERATOR_ROLE"));
export const APPROVER_ROLE = keccak256(stringToHex("APPROVER_ROLE"));
export const PAUSER_ROLE = keccak256(stringToHex("PAUSER_ROLE"));
