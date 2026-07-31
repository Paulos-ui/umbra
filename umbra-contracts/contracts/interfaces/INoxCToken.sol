// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/*
 * @title INoxCToken
 * @notice Minimal surface of a Nox ERC-7984 confidential token that also wraps a
 *         public ERC-20. Satisfied by `@iexec-nox/nox-confidential-contracts`'s
 *         `ERC20ToERC7984Wrapper` (which is itself an ERC-7984 token).
 * @dev    Declared locally so the router compiles against a stable, explicit
 *         interface rather than a deep inheritance chain.
 */
interface INoxCToken {
    /// @notice Public ERC-20 backing this confidential token.
    function underlying() external view returns (address);

    /// @notice Wrap `amount` of the public underlying into confidential tokens for `to`.
    function wrap(address to, uint256 amount) external returns (euint256);

    /// @notice Unwrap an encrypted `amount` of confidential tokens from `from` back to `to`.
    function unwrap(address from, address to, euint256 amount) external returns (euint256);

    /// @notice Transfer an encrypted `amount` to `to` (caller must be allowed for the handle).
    function confidentialTransfer(address to, euint256 amount) external returns (euint256);

    /// @notice Pull an external encrypted `amount` from `from` to `to` (caller must be operator).
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint256 amount,
        bytes calldata inputProof
    ) external returns (euint256);

    /// @notice Encrypted balance handle of `account`.
    function confidentialBalanceOf(address account) external view returns (euint256);

    /// @notice Authorize `operator` to move the caller's confidential tokens until `until`.
    function setOperator(address operator, uint48 until) external;

    /**
     * @notice Settle a pending unwrap once the gateway has published the decryption proof.
     * @dev    `unwrap` is ASYNCHRONOUS: it burns the confidential balance, marks the returned
     *         handle publicly decryptable, and emits `UnwrapRequested`. The underlying ERC-20
     *         is only released when someone calls this with the proof fetched off-chain via
     *         the JS SDK's `publicDecrypt(handle)`.
     */
    function finalizeUnwrap(euint256 unwrapRequestId, bytes calldata decryptedAmountAndProof) external;

    /// @notice Emitted by `unwrap`; `unwrapRequestId` is the handle to finalize with.
    event UnwrapRequested(address indexed to, euint256 unwrapRequestId);
}
