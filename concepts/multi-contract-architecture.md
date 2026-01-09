# Multi-Contract Architecture in CashScript

Contracts cannot "call" each other. Multiple contracts participate in the SAME transaction, each validating its own constraints.

---

## Pattern 1: Main+Sidecar

**Problem**: One UTXO = one token category. Need NFT state AND fungible tokens.

**Solution**: Sidecar proves same-origin via `outpointTransactionHash`:

```cashscript
contract TokenSidecar() {
    function attach() {
        int mainIdx = this.activeInputIndex - 1;
        require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
                tx.inputs[mainIdx].outpointTransactionHash);
        require(tx.inputs[this.activeInputIndex].outpointIndex ==
                tx.inputs[mainIdx].outpointIndex + 1);
        require(tx.outputs[this.activeInputIndex].lockingBytecode ==
                tx.inputs[this.activeInputIndex].lockingBytecode);
        require(tx.outputs[this.activeInputIndex].value == 1000);
    }
}
```

---

## Pattern 2: Function Contracts

Split operations into separate contracts. Main routes by NFT commitment prefix byte:

```cashscript
contract MainCoordinator(bytes32 systemTokenId) {
    function interact(int functionInputIndex) {
        bytes functionId = tx.inputs[functionInputIndex].nftCommitment.split(1)[0];
        require(tx.inputs[functionInputIndex].tokenCategory == systemTokenId + 0x01);

        if (functionId == 0x00) { require(tx.outputs.length <= 5); /* A logic */ }
        else if (functionId == 0x01) { require(tx.outputs.length <= 7); /* B logic */ }
    }
}
```

Each function contract validates position and authenticates main:

```cashscript
contract FunctionA(bytes32 systemTokenId) {
    function execute() {
        require(this.activeInputIndex == 1);
        require(tx.inputs[0].tokenCategory == systemTokenId + 0x01);
        require(tx.outputs[1].lockingBytecode == tx.inputs[1].lockingBytecode);
        require(tx.outputs[1].value == 1000);
    }
}
```

---

## Pattern 3: Input Position Pinning

Document and enforce exact positions:

```cashscript
//inputs:  0-Price, 1-Main, 2-Sidecar, 3-Function, 4-User
//outputs: 0-Price, 1-Main, 2-Sidecar, 3-Function, 4-Payment
function redeem() {
    require(this.activeInputIndex == 3);
    require(tx.inputs[0].tokenCategory == oracleCategory);
    require(tx.inputs[1].tokenCategory == mainCategory);
}
```

---

## Pattern 4: Covenant Categories

| Type | Changes | Example |
|------|---------|---------|
| Exactly self-replicating | Nothing | Factory, Router |
| State-mutating | NFT commitment | Oracle, Counter |
| State+Balance-mutating | Commitment + BCH | Pool, Treasury |
| Conditionally-replicating | May not recreate | Loan (closeable) |

### 5-Point Validation (MANDATORY)

```cashscript
require(tx.outputs[i].lockingBytecode == tx.inputs[i].lockingBytecode); // 1. Code
require(tx.outputs[i].tokenCategory == tx.inputs[i].tokenCategory);     // 2. Token
require(tx.outputs[i].value == expectedValue);                          // 3. BCH
require(tx.outputs[i].tokenAmount == expectedAmount);                   // 4. FT
require(tx.outputs[i].nftCommitment == newCommitment);                  // 5. State
```

---

## Pattern 5: Token Category Authentication

```cashscript
// tokenCategory = 32-byte categoryId + capability byte
// 0x01 = mutable, 0x02 = minting, absent = immutable

require(tx.inputs[0].tokenCategory == systemTokenId + 0x02); // minting authority
require(tx.inputs[1].tokenCategory == systemTokenId + 0x01); // mutable state

// Extract capability
bytes category, bytes capability = tx.inputs[0].tokenCategory.split(32);
require(capability == 0x02);
```

---

## Pattern 6: Output Count Limiting (CRITICAL)

```cashscript
function anyOperation() {
    require(tx.outputs.length <= 5); // ALWAYS FIRST
    // ...
}
```

Without limits, attackers add outputs minting unauthorized tokens.

---

## Pattern 7: Origin Proof

Verify NFT was legitimately created by chaining same-origin checks:

```cashscript
contract Enforcer() {
    function verify() {
        int factoryIdx = this.activeInputIndex - 1;
        require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
                tx.inputs[factoryIdx].outpointTransactionHash);
    }
}
```

---

## Deployment

1. Deploy all contracts (get addresses)
2. Create token category (genesis tx)
3. Hardcode addresses in source
4. Recompile with trust anchors
5. Redeploy final contracts
6. Mint system NFTs
7. Initialize positions

Contracts are **immutable after deployment**. Plan addresses carefully.

---

## Validation Checklist

**Every Contract**:
- [ ] Output count limited
- [ ] Position documented (`//inputs: ...`)
- [ ] `this.activeInputIndex` validated

**Self-Replicating**:
- [ ] All 5 covenant points validated
- [ ] State transitions verified

**Function Contracts**:
- [ ] Authenticates coordinator
- [ ] Self-replicates at 1000 sats

**Banned**: Generic names (`update`, `handle`, `placeholder`). Use `validateVoteUpdate`, `processRedemption`.
