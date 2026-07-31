/**
 * Minimal ABIs for the Umbra stack.
 * NOTE: Solidity's `euint256` / `externalEuint256` are user-defined value types
 * over `bytes32`, so they appear as `bytes32` in the ABI.
 */

export const batchRouterAbi = [
  { type: "function", name: "currentBatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "submitOrder", stateMutability: "nonpayable",
    inputs: [{ name: "encAmount", type: "bytes32" }, { name: "inputProof", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function", name: "getBatch", stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "openedAt", type: "uint64" },
      { name: "closedAt", type: "uint64" },
      { name: "usdcIn", type: "uint256" },
      { name: "wethOut", type: "uint256" },
      { name: "traderCount", type: "uint256" },
    ],
  },
  {
    type: "function", name: "getContributionHandle", stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "trader", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "getShareHandle", stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "trader", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "discloseShareTo", stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "viewer", type: "address" }],
    outputs: [],
  },
  {
    type: "function", name: "discloseContributionTo", stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "viewer", type: "address" }],
    outputs: [],
  },
  // owner-only keeper controls (used by the demo control room)
  { type: "function", name: "openBatch", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "closeBatch", stateMutability: "nonpayable", inputs: [{ name: "batchId", type: "uint256" }], outputs: [] },
  { type: "function", name: "executeBatch", stateMutability: "nonpayable", inputs: [{ name: "batchId", type: "uint256" }], outputs: [] },
  {
    type: "function", name: "finalizeBatch", stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }, { name: "minWethOut", type: "uint256" }, { name: "deadline", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "event", name: "OrderSubmitted", inputs: [
      { name: "batchId", type: "uint256", indexed: true }, { name: "trader", type: "address", indexed: true }] },
  { type: "event", name: "BatchFinalized", inputs: [
      { name: "batchId", type: "uint256", indexed: true },
      { name: "usdcIn", type: "uint256", indexed: false },
      { name: "wethOut", type: "uint256", indexed: false }] },
] as const;

export const cTokenAbi = [
  { type: "function", name: "wrap", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "setOperator", stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }, { name: "until", type: "uint48" }], outputs: [] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "isOperator", stateMutability: "view",
    inputs: [{ name: "holder", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const BATCH_STATUS = ["None", "Open", "Closed", "Executing", "Finalized"] as const;
