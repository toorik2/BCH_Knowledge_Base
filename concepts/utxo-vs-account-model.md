# UTXO vs Account Model - EVM→CashScript Reference

## Core Differences

| Aspect | UTXO (BCH) | Account (EVM) |
|--------|-----------|---------------|
| State | Independent UTXOs, NFT commitments (40B→128B May 2026) | Global state tree |
| Execution | Transaction validation (stateless) | Contract execution (stateful) |
| Concurrency | Parallel UTXO spending | Sequential (nonce) |
| Reentrancy | Impossible (atomic) | Vulnerable |
| Tokens | Native CashTokens | ERC-20/721 |
| Inter-Contract | Multi-input transactions | call/delegatecall |
| Fee | Tx size (bytes) | Gas (opcodes) |

## Transaction Introspection

```cashscript
// Inputs (read from UTXO being spent)
tx.inputs[i].value                    // int: satoshis
tx.inputs[i].lockingBytecode          // bytes: script
tx.inputs[i].tokenCategory            // bytes32 + capability (0x01=mutable, 0x02=minting)
tx.inputs[i].tokenAmount              // int: fungible amount
tx.inputs[i].nftCommitment            // bytes: NFT data (40B→128B May 2026)
tx.inputs[i].outpointTransactionHash  // bytes32: source tx
tx.inputs[i].outpointIndex            // int: source output index
tx.inputs[i].sequenceNumber           // int: nSequence
tx.inputs[i].unlockingBytecode        // bytes: scriptSig

// Outputs (what's being created)
tx.outputs[i].value / .lockingBytecode / .tokenCategory / .tokenAmount / .nftCommitment

// Context
this.activeInputIndex   // int: current input being evaluated
this.activeBytecode     // bytes: current script
tx.time                 // int: <500M=block height, ≥500M=Unix timestamp
tx.locktime             // int: nLocktime (for arithmetic)
this.age                // int: relative blocks (SDK: blocks only)

// Bytecode Constructors
new LockingBytecodeP2PKH(bytes20)    // Standard address
new LockingBytecodeP2SH32(bytes32)   // Contract (secure, default)
new LockingBytecodeP2SH20(bytes20)   // Legacy
new LockingBytecodeNullData(bytes[]) // OP_RETURN (223B max/tx)
```

**Time**: Always `tx.time >= lockTime` (never `>`). `this.age` = blocks only.

## EVM→CashScript Mapping

| Solidity | CashScript |
|----------|-----------|
| `constructor(owner)` | `contract C(pubkey owner)` - immutable per UTXO |
| `mapping(addr=>uint)` | NFT commitment bytes (no O(1) lookup) |
| `uint256 state;` | NFT commitment (40B→128B) |
| `require(cond, "msg")` | `require(cond);` - no messages |
| `msg.sender` | `checkSig(sig, pk)` - explicit verification |
| `msg.value` | `tx.inputs[this.activeInputIndex].value` |
| `transfer(to, amt)` | `require(tx.outputs[0].value >= amt)` |
| `emit Event()` | UTXO change IS the event; OP_RETURN optional |
| `modifier` | Inline `require()` |
| `for/while` | `do {} while()` (v0.13.0+ beta) |
| `storage/memory` | N/A (stack-based) |
| `ERC-20/721` | Native CashTokens |
| `view/pure` | N/A (all on-chain validation) |
| `public/private` | All functions public; use `checkSig` for access |
| `import/library` | N/A (single-file only) |
| `struct` | `bytes` + `.split()` |
| `enum` | `int` constants |
| `address` | `bytes20` (pkh) or `pubkey` (33B) |
| `selfdestruct` | Just don't recreate UTXO |
| `delegatecall` | Multi-input tx with multiple contracts |

## Critical Gotchas

**No Visibility**: All functions public. Access control via `checkSig` or UTXO ownership.

**No Storage**: Stack-based. State in NFT commitments only.

**No O(1) Lookups**: No mappings. Loop over UTXOs or use off-chain indexing.

**No Code Reuse**: No import/library/inheritance. Single-file contracts only.

**No Short-Circuit**: `&&`/`||` evaluate ALL operands. Separate into multiple `require()`.

**No Compound Ops**: Use `x = x + 1` not `x++` or `x += 1`.

**Array Bounds**: Always check `tx.outputs.length > index` before access.

**Bitwise**: Only `& | ^` on `bytes` (not `int`). No shifts/NOT until May 2026.

**Signatures**: `checkSig(0x, pk)` returns false (not failure). Nullfail enforced.

**OP_RETURN**: 223B max/tx. For off-chain metadata only, not storage. UTXO changes ARE events.

**Loops**: `do {} while()` in v0.13.0+ only. Body executes first.

### VM Limits (May 2025)
- Stack element: 10,000 bytes
- Operation cost: `(41 + unlocking_bytecode_length) × 800`
- BigInt arithmetic supported

### May 2026 Upgrade
- NFT commitment: 128 bytes (from 40)
- Unlocking bytecode: 10,000 bytes
- P2S standard, full bitwise ops

## Types

| Type | Size | Notes |
|------|------|-------|
| `bool` | 1B | `! && \|\|` |
| `int` | Variable | -2^63 to 2^63-1, `+ - * / %` |
| `bytes` | Variable | `.split() .slice() .length .reverse()`, `& \| ^` |
| `bytesN` | N bytes | N ∈ [1,64], cast to int only for N≤8 |
| `pubkey` | 33B | Compressed key |
| `sig` | ~65B | Transaction signature |
| `datasig` | ~64B | Data signature |

**Units**: `sats=1`, `bits=100`, `bitcoin=100_000_000` | `seconds=1`, `minutes=60`, `hours=3600`, `days=86400`

## Functions

| Function | Returns | Notes |
|----------|---------|-------|
| `abs/min/max(int)` | `int` | Math |
| `within(x, lo, hi)` | `bool` | `lo <= x < hi` |
| `sha256/hash256` | `bytes32` | Single/double SHA-256 |
| `hash160` | `bytes20` | SHA-256 + RIPEMD-160 |
| `checkSig(sig, pk)` | `bool` | Verify tx signature |
| `checkDataSig(dsig, msg, pk)` | `bool` | Verify data signature |
| `checkMultiSig` | `bool` | NOT in SDK |

## State Model

```
EVM:    storage.balance += amount
UTXO:   consume old UTXO → validate → create new UTXO with updated commitment
```

State = NFT commitment. Update = spend + recreate with new commitment.

## Multi-Contract Translation

| Solidity | CashScript |
|----------|-----------|
| `contractA.call(B)` | Both in same tx as inputs |
| Factory pattern | Main+Sidecar+Function contracts |
| Proxy/upgradeable | Conditionally-replicating covenant |
| `mapping` | NFT commitment bytes |
| Dynamic arrays | Multiple UTXOs |

**Cross-contract call**: Both contracts as inputs, each validates its constraints, tx succeeds only if ALL pass.

```cashscript
contract A(bytes32 contractBCategory) {
    function interact() {
        require(tx.inputs[1].tokenCategory == contractBCategory); // B present
    }
}
```

**Untranslatable**: Dynamic arrays, unbounded mappings, contract creation, `msg.sender` identity. Redesign architecture for UTXO model.

See `multi-contract-architecture.md` for detailed patterns.
