# CashScript Smart Contract Security

## Core Principles

1. **Fail closed**: All conditions must pass, or tx fails
2. **Validate everything**: Never trust function arguments
3. **Limit outputs**: FIRST line of every function
4. **Explicit positions**: Pin `this.activeInputIndex` and validate other contracts

---

## CRITICAL: Output Count Limiting

**Attack**: Without limits, attackers add outputs minting unauthorized tokens.

```cashscript
function anyOperation() {
    require(tx.outputs.length <= 5); // ALWAYS FIRST
    // ... rest of logic
}
```

| Operation | Limit |
|-----------|-------|
| Transfer | 3-4 |
| Swap | 5-6 |
| Complex DeFi | 7-10 |
| Maximum | 50 |

---

## 5-Point Covenant Validation

Every self-replicating covenant MUST validate ALL 5:

```cashscript
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode); // 1. Code
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);     // 2. Token
require(tx.outputs[0].value == expectedValue);                          // 3. BCH
require(tx.outputs[0].tokenAmount == expectedAmount);                   // 4. FT
require(tx.outputs[0].nftCommitment == newCommitment);                  // 5. State
```

**Missing ANY = critical vulnerability.**

---

## Minting Authority Protection

Minting NFTs (`+ 0x02`) create unlimited tokens. If one escapes, system is compromised.

```cashscript
// Keep minting authority in contract
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);

// Downgrade when possible
require(tx.outputs[0].tokenCategory == category + 0x01); // Mutable only

// Burn when done
require(tx.outputs[burnIdx].lockingBytecode == 0x6a); // OP_RETURN
```

---

## Input Position Security

**Attack**: Without validation, attackers reorder inputs.

```cashscript
function operation() {
    require(this.activeInputIndex == 2);                     // Pin own position
    require(tx.inputs[0].tokenCategory == oracleCategory);   // Auth oracle
    require(tx.inputs[1].tokenCategory == mainCategory);     // Auth main
}
```

**Never trust input data without verifying token category first.**

---

## Same-Origin Verification

For Main+Sidecar pairs:

```cashscript
require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
        tx.inputs[mainIdx].outpointTransactionHash);
require(tx.inputs[this.activeInputIndex].outpointIndex ==
        tx.inputs[mainIdx].outpointIndex + 1);
```

---

## Common Vulnerabilities

### Time Comparisons
```cashscript
require(tx.time >= lockTime); // CORRECT
// require(tx.time > lockTime); // WRONG
```

### Missing Bounds
```cashscript
require(amount > 0);
require(amount <= maxAmount);
require(tx.outputs.length > index); // Before array access
```

### Overflow
```cashscript
int result = a + b;
require(result >= a); // Overflow check
```

### Bitwise on Wrong Type
```cashscript
// WRONG: bitwise on int
// bytes result = someInt & 0xFF;

// CORRECT: bitwise on bytes
bytes4 result = someBytes4 & 0x000000FF;
```

---

## Token Security

```cashscript
// Validate category
require(tx.outputs[0].tokenCategory == authorizedCategory);

// Validate commitment
require(tx.outputs[0].nftCommitment.length > 0);
require(tx.outputs[0].nftCommitment.length <= 40); // 128 in May 2026
```

---

## Checklist

**Every Function**:
- [ ] Output count limited (first line)
- [ ] `this.activeInputIndex` validated
- [ ] All accessed inputs authenticated
- [ ] Array bounds checked

**Self-Replicating**:
- [ ] All 5 covenant properties validated
- [ ] State transitions verified

**Minting Contracts**:
- [ ] Minting authority stays in contract
- [ ] All outputs validated for token category
- [ ] Consider downgrading/burning after setup

**Multi-Contract**:
- [ ] Cross-contract authentication via tokenCategory
- [ ] Same-origin verification for pairs
- [ ] Position documentation in comments

**Pre-Deploy**:
- [ ] Testnet deployment
- [ ] Boundary testing (0, max, negative)
- [ ] Attack simulation
- [ ] External audit for high-value systems
