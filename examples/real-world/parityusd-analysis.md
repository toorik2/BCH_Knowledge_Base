# ParityUSD Analysis

Production stablecoin with **26 CashScript contracts** demonstrating mature multi-contract architecture.

## System Structure

```
ParityUSD (26 contracts)
├── Loan Module (10): Loan + LoanSidecar + 8 function contracts
├── LoanKey Module (3): Factory + OriginEnforcer + OriginProof
├── Redeemer Module (3): Redeemer + Redemption + RedemptionSidecar
├── Stability Pool (8): Pool + Sidecar + Collector + Payout + 4 functions
└── Core (2): Parity (borrowing) + PriceContract (oracle)
```

---

## Key Architectural Patterns

### 1. Main+Sidecar (Token Separation)
One UTXO = one token category. Sidecar holds additional tokens, proves same-origin:
```cashscript
require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
        tx.inputs[mainIdx].outpointTransactionHash);
```

### 2. Function Contracts (Modular Logic)
Main contract routes by first-byte identifier:
```cashscript
bytes funcId = tx.inputs[funcIdx].nftCommitment.split(1)[0];
if (funcId == 0x00) { /* liquidate */ }
else if (funcId == 0x01) { /* manage */ }
```
Benefits: Only load code for current operation, easy to add functions.

### 3. Strict Position Layout
Every function documents and enforces positions:
```
//inputs: 0-Price, 1-Loan, 2-Sidecar, 3-Function, 4-LoanKey, 5-feeBCH
function redeem() {
    require(this.activeInputIndex == 3);
    require(tx.inputs[0].tokenCategory == parityTokenId + 0x01);
}
```

### 4. Token Category Authentication
```cashscript
// categoryId + 0x01 = mutable, + 0x02 = minting
require(tx.inputs[0].tokenCategory == parityTokenId + 0x01);
require(tx.inputs[0].nftCommitment.split(1)[0] == 0x00); // Price identifier
```

---

## State Layout Example (Loan NFT, 27 bytes)

```
bytes1  identifier        = 0x01
bytes6  borrowedAmount
bytes6  beingRedeemed
bytes1  status            (0x00=new, 0x01=single, 0x02=mature)
bytes4  lastPeriodInterestPaid
bytes2  currentInterestRate
bytes2  nextInterestRate
bytes1  interestManager
bytes2  minRateManager
bytes2  maxRateManager
```

Parse: `bytes id, bytes remaining = commitment.split(1); bytes6 amt, remaining = remaining.split(6);`

---

## Covenant Categories in Practice

| Covenant | Changes | ParityUSD Examples |
|----------|---------|-------------------|
| Exactly self-replicating | Nothing | Redeemer, LoanKeyFactory |
| State-mutating | Commitment | Parity, PriceContract |
| State+Balance-mutating | Commitment + BCH | StabilityPool |
| Conditionally-replicating | May close | Loans |

---

## Security Patterns Applied

1. **Output limiting**: `require(tx.outputs.length <= 10);` in every function
2. **5-point covenant**: All 5 properties validated
3. **Fixed value anchors**: Function contracts output exactly 1000 sats
4. **Burn to OP_RETURN**: `require(tx.outputs[5].lockingBytecode == 0x6a);`
5. **Minimum amounts**: `require(borrowAmount >= 100_00);` prevents griefing

---

## Origin Proof Chain

Proves NFT legitimately created:
```
Factory → Enforcer (verifies co-creation) → Proof (verifies co-creation) → [verified NFT]
```

---

## Time Without Block Height

```cashscript
int currentPeriod = (tx.locktime - startBlockHeight) / periodLengthBlocks;
require(tx.locktime < 500000000); // Must be block height
require(currentPeriod > storedPeriod);
```

---

## Key Lessons

1. **Functions ARE contracts**: 8 functions = 8 separate contract files
2. **Sidecar for multi-token**: Can't hold NFT state + fungible tokens in one UTXO
3. **No O(1) lookups**: Must loop or use commitment bytes
4. **No dynamic dispatch**: Explicit `if/else` on identifier bytes
5. **Position is data**: Input index encodes role in transaction
6. **Every contract validates**: If nothing to validate, contract shouldn't exist

---

## EVM→CashScript Translation Summary

| EVM | CashScript |
|-----|-----------|
| Contract function | Separate contract file |
| Storage mapping | NFT commitment bytes |
| `otherContract.call()` | Multi-input transaction |
| Dynamic arrays | Multiple UTXOs |
| Constructor storage | Constructor params (immutable) |
| Function selector | First-byte identifier in commitment |
