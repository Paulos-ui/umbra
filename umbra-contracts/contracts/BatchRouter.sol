// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {INoxCToken} from "./interfaces/INoxCToken.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/**
 * @title  BatchRouter — Umbra's confidential batch router for Uniswap
 * @author Umbra (iExec WTF Hackathon)
 *
 * @notice A dark pool that sits *in front of* an unmodified Uniswap pool.
 *         Traders submit ENCRYPTED order sizes (ERC-7984 confidential tokens).
 *         The router nets a whole batch, unwraps only the AGGREGATE, executes
 *         ONE public swap on Uniswap, then redistributes the proceeds back to
 *         each trader as an ENCRYPTED, per-user confidential balance.
 *
 *         The chain only ever sees the batch total. No individual order size,
 *         and no trader<->size link, is ever revealed on-chain. Uniswap is
 *         untouched; composability with existing liquidity is fully preserved.
 *
 * @dev    Privacy model
 *         --------------
 *         - Order amounts live as `euint256` handles (Nox). Plaintext never
 *           touches the chain.
 *         - The only value that becomes public is the *sum* of the batch, which
 *           is intentionally revealed when the aggregate cUSDC is unwrapped to
 *           real USDC for the swap. That is the whole point of batching: the
 *           total is public, the parts stay in shadow.
 *         - Pro-rata redistribution is an encrypted-value x public-scalar op:
 *           share_i = contribution_i * wethOut / usdcIn   (mul then div on euint256)
 *
 *         Lifecycle
 *         ---------
 *           openBatch()      owner opens a submission window
 *           submitOrder()    traders pull cUSDC in as an encrypted amount
 *           closeBatch()     owner closes submissions
 *           executeBatch()   router unwraps the encrypted aggregate -> USDC
 *                            (async: Nox gateway settles the reveal)
 *           finalizeBatch()  swap on Uniswap, wrap to cWETH, distribute shares
 *
 *         The execute/finalize split exists because unwrapping an encrypted
 *         amount to a public ERC-20 balance is an asynchronous reveal handled
 *         by the Nox gateway. `executeBatch` requests it; once the USDC lands,
 *         `finalizeBatch` does the deterministic settlement.
 */
contract BatchRouter is Ownable, ReentrancyGuard {
    // ----------------------------------------------------------------------
    // Immutable wiring
    // ----------------------------------------------------------------------

    /// @notice Confidential wrapped input token (cUSDC) — an ERC-7984 wrapper over USDC.
    INoxCToken public immutable cTokenIn;
    /// @notice Confidential wrapped output token (cWETH) — an ERC-7984 wrapper over WETH.
    INoxCToken public immutable cTokenOut;
    /// @notice Public underlying of the input token (USDC).
    IERC20 public immutable tokenIn;
    /// @notice Public underlying of the output token (WETH).
    IERC20 public immutable tokenOut;
    /// @notice Unmodified Uniswap v3 swap router used for the single aggregate swap.
    ISwapRouter public immutable swapRouter;
    /// @notice Uniswap pool fee tier (e.g. 3000 = 0.3%).
    uint24 public immutable poolFee;

    // ----------------------------------------------------------------------
    // Batch state
    // ----------------------------------------------------------------------

    enum Status {
        None,
        Open,
        Closed,
        Executing,
        Finalized
    }

    struct Batch {
        Status status;
        uint64 openedAt;
        uint64 closedAt;
        uint256 usdcBefore; // router USDC balance snapshot at executeBatch()
        uint256 usdcIn; // revealed aggregate that actually swapped
        uint256 wethOut; // proceeds of the aggregate swap
        address[] traders; // batch participants (for distribution)
    }

    /// @notice Current batch id (monotonic).
    uint256 public currentBatchId;

    mapping(uint256 batchId => Batch) private _batches;
    /// @dev Encrypted running total of the batch (sum of all contributions).
    mapping(uint256 batchId => euint256) private _encAggregate;
    /// @dev Encrypted per-trader contribution within a batch.
    mapping(uint256 batchId => mapping(address trader => euint256)) private _contribution;
    /// @dev Encrypted per-trader output share, set at finalize.
    mapping(uint256 batchId => mapping(address trader => euint256)) private _share;
    /// @dev Guards against double-counting a trader in the participant list.
    mapping(uint256 batchId => mapping(address trader => bool)) private _joined;

    // ----------------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------------

    event BatchOpened(uint256 indexed batchId, uint64 timestamp);
    event OrderSubmitted(uint256 indexed batchId, address indexed trader);
    event BatchClosed(uint256 indexed batchId, uint256 traderCount);
    event BatchExecuting(uint256 indexed batchId);
    event BatchFinalized(uint256 indexed batchId, uint256 usdcIn, uint256 wethOut);
    event ContributionDisclosed(uint256 indexed batchId, address indexed trader, address indexed viewer);
    event ShareDisclosed(uint256 indexed batchId, address indexed trader, address indexed viewer);

    error InvalidStatus(uint256 batchId, Status expected, Status actual);
    error UnwrapNotSettled();
    error NothingToExecute();
    error NoOrder();

    constructor(
        INoxCToken _cTokenIn,
        INoxCToken _cTokenOut,
        ISwapRouter _swapRouter,
        uint24 _poolFee,
        address _owner
    ) Ownable(_owner) {
        cTokenIn = _cTokenIn;
        cTokenOut = _cTokenOut;
        tokenIn = IERC20(_cTokenIn.underlying());
        tokenOut = IERC20(_cTokenOut.underlying());
        swapRouter = _swapRouter;
        poolFee = _poolFee;
    }

    // ----------------------------------------------------------------------
    // 1. Open
    // ----------------------------------------------------------------------

    /// @notice Open a new submission window. Only one batch is active at a time.
    function openBatch() external onlyOwner returns (uint256 batchId) {
        batchId = ++currentBatchId;
        Batch storage b = _batches[batchId];
        b.status = Status.Open;
        b.openedAt = uint64(block.timestamp);
        emit BatchOpened(batchId, b.openedAt);
    }

    // ----------------------------------------------------------------------
    // 2. Submit  (the private path)
    // ----------------------------------------------------------------------

    /**
     * @notice Submit an encrypted order into the open batch.
     * @dev    The trader must first authorize this router as an ERC-7984 operator
     *         on cTokenIn (one-time `setOperator(router, expiry)` — analogous to
     *         ERC-20 approve). The encrypted amount is pulled from the trader into
     *         the router via `confidentialTransferFrom`, which returns the actual
     *         (still-encrypted) transferred amount. That handle is what we record,
     *         so a trader can never contribute more than their confidential balance.
     *
     * @param encAmount External encrypted amount produced by the JS SDK (`encryptInput`).
     * @param inputProof Matching proof from the JS SDK.
     */
    function submitOrder(externalEuint256 encAmount, bytes calldata inputProof)
        external
        nonReentrant
    {
        uint256 batchId = currentBatchId;
        Batch storage b = _batches[batchId];
        _require(b.status == Status.Open, batchId, Status.Open, b.status);

        // Pull the trader's confidential cUSDC into the router. The returned
        // handle is the real amount moved (capped at their balance).
        euint256 contributed =
            cTokenIn.confidentialTransferFrom(msg.sender, address(this), encAmount, inputProof);

        // Accumulate encrypted per-trader contribution and the batch aggregate.
        // Guard the first write: adding onto an uninitialized handle is undefined,
        // so seed with the contribution itself the first time.
        euint256 prev = _contribution[batchId][msg.sender];
        euint256 newContribution = Nox.isInitialized(prev) ? Nox.add(prev, contributed) : contributed;
        _contribution[batchId][msg.sender] = newContribution;

        euint256 agg = _encAggregate[batchId];
        _encAggregate[batchId] = Nox.isInitialized(agg) ? Nox.add(agg, contributed) : contributed;

        // ACLs: the router must keep working with these handles across txs, and
        // the trader may read their own contribution off-chain via the SDK.
        Nox.allowThis(newContribution);
        Nox.allow(newContribution, msg.sender);
        Nox.allowThis(_encAggregate[batchId]);

        if (!_joined[batchId][msg.sender]) {
            _joined[batchId][msg.sender] = true;
            b.traders.push(msg.sender);
        }

        emit OrderSubmitted(batchId, msg.sender);
    }

    // ----------------------------------------------------------------------
    // 3. Close
    // ----------------------------------------------------------------------

    function closeBatch(uint256 batchId) external onlyOwner {
        Batch storage b = _batches[batchId];
        _require(b.status == Status.Open, batchId, Status.Open, b.status);
        if (b.traders.length == 0) revert NothingToExecute();
        b.status = Status.Closed;
        b.closedAt = uint64(block.timestamp);
        emit BatchClosed(batchId, b.traders.length);
    }

    // ----------------------------------------------------------------------
    // 4. Execute  (reveal only the aggregate)
    // ----------------------------------------------------------------------

    /**
     * @notice Request the reveal of the batch aggregate by unwrapping the router's
     *         confidential cUSDC into real USDC. Only the SUM becomes public here —
     *         never any individual order. The reveal settles asynchronously through
     *         the Nox gateway; once the USDC has landed, call `finalizeBatch`.
     */
    function executeBatch(uint256 batchId) external onlyOwner nonReentrant {
        Batch storage b = _batches[batchId];
        _require(b.status == Status.Closed, batchId, Status.Closed, b.status);

        b.usdcBefore = tokenIn.balanceOf(address(this));
        b.status = Status.Executing;

        // Unwrap the encrypted aggregate: burns router cUSDC, releases USDC to router.
        // The token needs transient access to the handle to operate on it this tx.
        Nox.allowThis(_encAggregate[batchId]);
        Nox.allowTransient(_encAggregate[batchId], address(cTokenIn));
        cTokenIn.unwrap(address(this), address(this), _encAggregate[batchId]);

        emit BatchExecuting(batchId);
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // 5. Finalize  (one public swap + encrypted redistribution)
    // ----------------------------------------------------------------------

    /**
     * @notice Execute the single aggregate swap on Uniswap and redistribute the
     *         proceeds pro-rata as encrypted cWETH balances.
     *
     * @param batchId    The batch to finalize.
     * @param minWethOut Slippage floor for the aggregate swap (amountOutMinimum).
     * @param deadline   Uniswap swap deadline.
     */
    function finalizeBatch(uint256 batchId, uint256 minWethOut, uint256 deadline)
        external
        onlyOwner
        nonReentrant
    {
        uint256 usdcIn;
        uint256 wethOut;

        // Block 1: Handle the Swap (drops `deadline` and `minWethOut` from stack afterwards)
        {
            Batch storage b = _batches[batchId];
            _require(b.status == Status.Executing, batchId, Status.Executing, b.status);

            usdcIn = tokenIn.balanceOf(address(this)) - b.usdcBefore;
            if (usdcIn == 0) revert UnwrapNotSettled();
            b.usdcIn = usdcIn;

            tokenIn.approve(address(swapRouter), usdcIn);
            wethOut = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: address(tokenIn),
                    tokenOut: address(tokenOut),
                    fee: poolFee,
                    recipient: address(this),
                    deadline: deadline,
                    amountIn: usdcIn,
                    amountOutMinimum: minWethOut,
                    sqrtPriceLimitX96: 0
                })
            );
            b.wethOut = wethOut;
        }

        // Wrap the proceeds
        tokenOut.approve(address(cTokenOut), wethOut);
        cTokenOut.wrap(address(this), wethOut);

        // Block 2: Encrypted Redistribution (clean stack)
        {
            euint256 encWethOut = Nox.toEuint256(wethOut);
            euint256 encUsdcIn = Nox.toEuint256(usdcIn);

            uint256 n = _batches[batchId].traders.length;
            for (uint256 i = 0; i < n; ++i) {
                address trader = _batches[batchId].traders[i];
                // Inlined intermediate variables to save stack depth
                euint256 share = Nox.div(Nox.mul(_contribution[batchId][trader], encWethOut), encUsdcIn);

                _share[batchId][trader] = share;
                Nox.allowThis(share);
                Nox.allowTransient(share, address(cTokenOut));
                cTokenOut.confidentialTransfer(trader, share);
                Nox.allow(share, trader);
            }
        }

        _batches[batchId].status = Status.Finalized;
        emit BatchFinalized(batchId, usdcIn, wethOut);
    }

    // ----------------------------------------------------------------------
    // 6. Selective disclosure
    // ----------------------------------------------------------------------

    /// @notice Grant an auditor read access to *only your own* contribution in a batch.
    function discloseContributionTo(uint256 batchId, address viewer) external {
        euint256 c = _contribution[batchId][msg.sender];
        if (!Nox.isInitialized(c)) revert NoOrder();
        Nox.allow(c, viewer);
        emit ContributionDisclosed(batchId, msg.sender, viewer);
    }

    /// @notice Grant an auditor read access to *only your own* output share in a batch.
    function discloseShareTo(uint256 batchId, address viewer) external {
        euint256 s = _share[batchId][msg.sender];
        if (!Nox.isInitialized(s)) revert NoOrder();
        Nox.allow(s, viewer);
        emit ShareDisclosed(batchId, msg.sender, viewer);
    }

    // ----------------------------------------------------------------------
    // Views  (return handles; decrypt off-chain with the JS SDK)
    // ----------------------------------------------------------------------

    function getContributionHandle(uint256 batchId, address trader) external view returns (euint256) {
        return _contribution[batchId][trader];
    }

    function getShareHandle(uint256 batchId, address trader) external view returns (euint256) {
        return _share[batchId][trader];
    }

    function getAggregateHandle(uint256 batchId) external view returns (euint256) {
        return _encAggregate[batchId];
    }

    function getBatch(uint256 batchId)
        external
        view
        returns (
            Status status,
            uint64 openedAt,
            uint64 closedAt,
            uint256 usdcIn,
            uint256 wethOut,
            uint256 traderCount
        )
    {
        Batch storage b = _batches[batchId];
        return (b.status, b.openedAt, b.closedAt, b.usdcIn, b.wethOut, b.traders.length);
    }

    function getTraders(uint256 batchId) external view returns (address[] memory) {
        return _batches[batchId].traders;
    }

    // ----------------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------------

    function _require(bool ok, uint256 batchId, Status expected, Status actual) private pure {
        if (!ok) revert InvalidStatus(batchId, expected, actual);
    }
}
