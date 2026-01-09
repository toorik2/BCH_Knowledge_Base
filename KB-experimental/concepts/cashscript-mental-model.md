# CashScript Mental Model

Core principle: Contracts **validate** transformations, they don't execute them. The question is "what does this contract ALLOW to happen to itself?"

## UTXO State Pattern

```
UTXO → validate → recreate with new state
```
- State = NFT commitment (40B→128B May 2026)
- Persistence = contract recreation
- Authority = NFT capability (0x01 mutable, 0x02 minting)

## 5-Point Covenant Validation (MANDATORY)

Every self-replicating contract must validate ALL 5:

```cashscript
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);  // 1. Code
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);      // 2. Token
require(tx.outputs[0].value == expectedValue);                           // 3. BCH
require(tx.outputs[0].tokenAmount == expectedAmount);                    // 4. FT amount
require(tx.outputs[0].nftCommitment == newCommitment);                   // 5. State
```

**Missing ANY = critical vulnerability.**

## Covenant Types

| Type | Changes | Example |
|------|---------|---------|
| Exactly self-replicating | Nothing | Factory, Router |
| State-mutating | NFT commitment | Price oracle |
| State+Balance-mutating | Commitment + BCH | Liquidity pool |
| Conditionally-replicating | May not recreate | Loan (closeable) |

## Multi-Contract Patterns

**Main+Sidecar**: One UTXO holds one token category. Sidecar proves same-origin via `outpointTransactionHash` equality.

**Function Contracts**: Split logic into separate contracts, authenticate by NFT commitment first-byte identifier.

**Input Position**: Pin indices with `require(this.activeInputIndex == N)`. Document: `// Inputs: 0-Price, 1-Loan, 2-Sidecar, 3-Function`

**Token Category Auth**: `categoryId + 0x01` = mutable, `+ 0x02` = minting. Minting = highest authority.

## Output Protection (CRITICAL)

```cashscript
require(tx.outputs.length <= 5);  // ALWAYS limit first
// Then validate each output's tokenCategory
```

Minting NFTs can create ANY token. Every output must be validated.

## Time

- `tx.time`: absolute (block height if <500M, else timestamp)
- `this.age`: relative blocks since UTXO creation
- Always use `>= lockTime` (never `>`)

## Design Process

1. Define value flows (BCH, tokens)
2. Identify state (what's tracked in commitments)
3. Design contract topology (containers, functions, sidecars)
4. Document transaction layouts
5. Code constraints

See `multi-contract-architecture.md` for detailed patterns and `smart-contract-security.md` for security checklist.
