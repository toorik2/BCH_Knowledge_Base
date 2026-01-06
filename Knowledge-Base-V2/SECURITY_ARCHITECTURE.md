# CashScript Security & Architecture Guide

**Security patterns and multi-contract architecture for production CashScript systems.**

---

## 1. The 5-Point Covenant Validation (MANDATORY)

For ANY self-replicating covenant, you MUST validate ALL five properties. **Missing ANY creates critical vulnerabilities.**

```cashscript
// 1. Same contract code (prevents code injection)
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);

// 2. Same token category (prevents category substitution)
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);

// 3. Expected satoshi value (prevents value extraction)
require(tx.outputs[0].value == expectedValue);

// 4. Expected token amount (prevents token extraction)
require(tx.outputs[0].tokenAmount == expectedTokenAmount);

// 5. Expected/new state commitment (prevents state manipulation)
require(tx.outputs[0].nftCommitment == newCommitment);
```

### Common Mistakes

**Missing lockingBytecode check** - attacker can substitute contract:
```cashscript
// VULNERABLE
function spend() {
    require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
    require(tx.outputs[0].value == tx.inputs[0].value);
    // Missing: lockingBytecode check!
}
```

**Missing tokenCategory check** - attacker can substitute token:
```cashscript
// VULNERABLE
function spend() {
    require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
    require(tx.outputs[0].value == tx.inputs[0].value);
    // Missing: tokenCategory check!
}
```

### Covenant Type Security

| Covenant Type | What MUST Be Validated |
|--------------|------------------------|
| Exactly self-replicating | All 5 properties unchanged |
| State-mutating | 4 properties + valid new state |
| Balance-mutating | 3 properties + valid new value + valid new state |
| Conditionally-replicating | Full validation when replicating |

---

## 2. Output Count Security (CRITICAL)

### The Minting Attack

**Vulnerability**: Without output count limits, attackers can add unauthorized outputs to mint tokens.

**Attack Vector**:
1. Attacker creates a valid transaction satisfying contract constraints
2. Attacker adds extra outputs minting new tokens or NFTs
3. Contract validates expected outputs but ignores the extras
4. Unauthorized tokens enter circulation

### Mandatory Output Limiting

**EVERY contract function MUST limit output count as FIRST validation**:

```cashscript
function anyOperation() {
    // CRITICAL: ALWAYS include this FIRST
    require(tx.outputs.length <= 5);

    // ... rest of logic
}
```

### Standard Output Limits

| Operation Type | Recommended Limit | Reason |
|---------------|-------------------|--------|
| Simple transfer | 3-4 | Input + output + change |
| Swap/exchange | 5-6 | Multiple participants |
| Complex DeFi | 7-10 | Multiple contracts + change |
| Batch operations | 15-20 | Multiple recipients |
| Maximum | 50 | Transaction size limits |

### Secure Pattern

```cashscript
contract SecureContract() {
    function process() {
        // FIRST: Limit outputs
        require(tx.outputs.length <= 5);

        // THEN: Validate specific outputs
        require(tx.outputs[0].lockingBytecode == expectedBytecode);
        require(tx.outputs[0].value >= 1000);

        // Even with validation, output limit prevents extra unauthorized outputs
    }
}
```

---

## 3. Multi-Contract Architecture Patterns

### Pattern 1: Main+Sidecar

**Problem**: BCH allows only one token category per UTXO output. A contract managing both NFT (state) and fungible tokens cannot hold them in a single UTXO.

**Solution**: Pair every "main" contract with a "sidecar" that holds additional tokens.

```
┌─────────────────┐      ┌─────────────────────┐
│   Main.cash     │      │  MainSidecar.cash   │
│   (NFT state)   │◄────►│  (fungible tokens)  │
└─────────────────┘      └─────────────────────┘
```

**The Attach Pattern** - Sidecar proves it belongs to main contract:

```cashscript
contract TokenSidecar() {
    function attach() {
        int mainIndex = this.activeInputIndex - 1;

        // CRITICAL: Prove same-transaction origin
        require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
                tx.inputs[mainIndex].outpointTransactionHash);

        // CRITICAL: Prove sequential output indices
        require(tx.inputs[this.activeInputIndex].outpointIndex ==
                tx.inputs[mainIndex].outpointIndex + 1);

        // Self-replicate
        require(tx.outputs[this.activeInputIndex].lockingBytecode ==
                tx.inputs[this.activeInputIndex].lockingBytecode);
        require(tx.outputs[this.activeInputIndex].value == 1000);
    }
}
```

### Pattern 2: Function Contracts

**Problem**: Complex contracts with many functions become hard to maintain and expensive.

**Solution**: Split each logical "function" into a separate contract authenticated by NFT commitment bytes.

```
MainCoordinator.cash
   │
   ├── functionA.cash     (NFT commitment prefix: 0x00)
   ├── functionB.cash     (NFT commitment prefix: 0x01)
   ├── functionC.cash     (NFT commitment prefix: 0x02)
   └── functionD.cash     (NFT commitment prefix: 0x03)
```

**Routing Pattern**:

```cashscript
contract MainCoordinator(bytes32 systemTokenId) {
    function interact(int functionInputIndex) {
        // Extract function identifier from function contract's NFT
        bytes functionId = tx.inputs[functionInputIndex].nftCommitment.split(1)[0];

        // Authenticate the function contract
        require(tx.inputs[functionInputIndex].tokenCategory == systemTokenId + 0x01);

        // Route to appropriate validation
        if (functionId == 0x00) {
            require(tx.outputs.length <= 5);
            // Function A constraints...
        } else if (functionId == 0x01) {
            require(tx.outputs.length <= 7);
            // Function B constraints...
        }
    }
}
```

### Pattern 3: Strict Input Position

**Rule**: Every contract must know exactly which input index it occupies.

**Why**: Without explicit position validation, attackers could reorder inputs to bypass validation.

```cashscript
function myOperation() {
    // ALWAYS validate your own position first
    require(this.activeInputIndex == 2);

    // Define expected positions
    // Index 0: Price oracle
    // Index 1: Main contract
    // Index 2: This function contract (self)
    // Index 3: User BCH

    // Validate each position
    require(tx.inputs[0].tokenCategory == oracleCategory + 0x01);
    require(tx.inputs[1].tokenCategory == mainCategory + 0x01);
    require(tx.inputs[3].tokenCategory == 0x); // Pure BCH

    // Now safe to use these indices
}
```

### Position Documentation Pattern

Always document input/output positions in function headers:

```cashscript
//////////////////////////////////////////////////////////////////////////////////////////
//  Process a redemption operation.
//
//inputs:
//  0   PriceOracle               [NFT]       (from PriceOracle contract)
//  1   MainContract              [NFT]       (from Main contract)
//  2   MainSidecar               [NFT]       (from Sidecar contract)
//  3   redeemFunction            [NFT]       (from Redeem contract - this)
//  4   userKey                   [NFT]       (from user)
//  5   feeBCH                    [BCH]       (from fee payer)
//outputs:
//  0   PriceOracle               [NFT]       (to PriceOracle contract)
//  1   MainContract              [NFT]       (to Main contract)
//  2   MainSidecar               [NFT]       (to Sidecar contract)
//  3   redeemFunction            [NFT]       (to Redeem contract)
//  4   userPayment               [BCH]       (to user)
//////////////////////////////////////////////////////////////////////////////////////////
function redeem() {
    require(this.activeInputIndex == 3);
    // ...
}
```

---

## 4. Minting Authority Control

### The Minting NFT Problem

Minting NFTs (capability `0x02`) can create unlimited tokens. If a minting NFT escapes to an untrusted address, the entire token system is compromised.

### Secure Minting Patterns

**1. Never release minting authority**:
```cashscript
contract MintingController(bytes32 category) {
    function mint(int amount) {
        // Verify this contract holds minting NFT
        require(tx.inputs[0].tokenCategory == category + 0x02);

        // CRITICAL: Keep minting NFT in contract
        require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
        require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);

        // Never send minting NFT to user addresses
    }
}
```

**2. Downgrade minting to mutable when possible**:
```cashscript
// After initial setup, downgrade
require(tx.outputs[0].tokenCategory == category + 0x01); // Mutable only
```

**3. Burn minting authority when done**:
```cashscript
// Send minting NFT to OP_RETURN to destroy it
require(tx.outputs[destroyIdx].lockingBytecode == 0x6a);
require(tx.outputs[destroyIdx].tokenCategory == category + 0x02);
```

### Origin Proof for Legitimate Creation

When minting new NFTs, prove they came from authorized source:

```cashscript
contract AuthorizedMinter(bytes32 factoryCategory) {
    function mint() {
        // Verify factory is present
        require(tx.inputs[0].tokenCategory == factoryCategory + 0x02);
        // New NFTs must be in same transaction as factory
    }
}
```

---

## 5. Cross-Contract Trust Model

### Token Category as Identity + Authority

Contracts authenticate each other using deterministic category offsets:

```cashscript
bytes32 systemTokenId = 0x1234...;

// Different contracts/NFTs use offsets:
// systemTokenId + 0x00 = immutable NFTs
// systemTokenId + 0x01 = mutable NFTs
// systemTokenId + 0x02 = minting NFTs

// Validate another contract has minting authority
require(tx.inputs[0].tokenCategory == systemTokenId + 0x02);
```

### Cross-Contract Authentication

**Rule**: Never trust a contract just because it's in the transaction.

```cashscript
// INSECURE - trusts any input at position 0
function insecure() {
    bytes data = tx.inputs[0].nftCommitment;
    // ... uses data without verification
}

// SECURE - verifies contract identity before trusting
function secure() {
    // Verify category and identifier
    require(tx.inputs[0].tokenCategory == trustedCategory + 0x01);
    require(tx.inputs[0].nftCommitment.split(1)[0] == 0x00);

    // NOW safe to use data
    bytes data = tx.inputs[0].nftCommitment.split(1)[1];
}
```

### Same-Origin Verification

For sidecar/main pairs, verify same-transaction origin:

```cashscript
function verifySidecar() {
    int mainIdx = this.activeInputIndex - 1;

    // CRITICAL: Same transaction hash proves co-creation
    require(tx.inputs[this.activeInputIndex].outpointTransactionHash ==
            tx.inputs[mainIdx].outpointTransactionHash);

    // CRITICAL: Sequential indices proves ordering
    require(tx.inputs[this.activeInputIndex].outpointIndex ==
            tx.inputs[mainIdx].outpointIndex + 1);
}
```

---

## 6. State Management Security

### NFT Commitment as Structured State

State is stored as tightly-packed bytes in NFT commitments:

```cashscript
/*  --- State Mutable NFT (10 items, 27 bytes) ---
    byte identifier == 0x01
    bytes6 borrowedTokenAmount (tokens)
    bytes6 amountBeingRedeemed (tokens)
    byte status (0x00 newLoan, 0x01 single period, 0x02 mature loan)
    bytes4 lastPeriodInterestPaid
    byte2 currentInterestRate
    byte2 nextInterestRate
    byte interestManager
    bytes2 minRateManager
    bytes2 maxRateManager
*/
```

### First Byte as Type Identifier

Use first byte to distinguish contract types sharing same tokenId:

```cashscript
// Same systemTokenId, different contract types
0x00 = Price contract
0x01 = Loan contract
0x04 = startRedemption function
0x07 = payInterest function

// Validation
require(tx.inputs[0].nftCommitment.split(1)[0] == 0x00); // Must be price contract
```

### State Validation

```cashscript
contract StateValidator(bytes32 stateHash) {
    function updateState(bytes oldState, bytes newState) {
        // Validate old state
        require(sha256(oldState) == stateHash);

        // Validate state transition
        require(newState.length == oldState.length);
        require(newState != oldState);  // State must change

        // Validate new state format
        require(newState.length >= 32);
    }
}
```

---

## 7. NFT Capability as State Machine

Token capabilities encode contract state, not just permissions:

```
MINTING (0x02)     →    MUTABLE (0x01)      →    IMMUTABLE (0x)
Active state            Stopped state            Final state
Can modify freely       Can modify once more     Proof/receipt only
```

**State transition pattern**:
```cashscript
// Downgrade from minting to mutable (stop/cancel campaign)
require(tx.outputs[1].tokenCategory == tx.inputs[1].tokenCategory.split(32)[0] + 0x01);

// Downgrade from minting to immutable (create receipt)
require(tx.outputs[1].tokenCategory == tx.inputs[0].tokenCategory.split(32)[0]);

// Verify state
bytes category, bytes capability = tx.inputs[1].tokenCategory.split(32);
require(capability == 0x02);  // Must be minting (active)
```

### Receipt NFT Pattern

Immutable NFTs serve as cryptographic receipts/proofs:

```cashscript
function pledge(int pledgeAmount) {
    // Create IMMUTABLE receipt NFT (proof of pledge)
    require(tx.outputs[1].tokenCategory == tx.inputs[0].tokenCategory.split(32)[0]);
    require(tx.outputs[1].lockingBytecode == tx.inputs[1].lockingBytecode);  // To user
    require(tx.outputs[1].value == 1000);  // Dust
    require(tx.outputs[1].tokenAmount == 0);  // No fungible tokens

    // Receipt contains proof data
    require(tx.outputs[1].nftCommitment ==
        bytes6(pledgeAmount) + bytes21(0) + endBlock + bytes4(pledgeID) + campaignID
    );
}
```

---

## 8. Input Position Attacks

### The Attack

Without position validation, attackers can reorder inputs:
1. Contract expects input 0 = Oracle, input 1 = Main
2. Attacker swaps positions: input 0 = Main, input 1 = Oracle
3. Contract reads wrong data from wrong position

### Defense

```cashscript
function operation() {
    // ALWAYS validate your own position first
    require(this.activeInputIndex == 2);

    // ALWAYS validate other contracts at expected positions
    require(tx.inputs[0].tokenCategory == oracleCategory);
    require(tx.inputs[1].tokenCategory == mainCategory);
}
```

---

## 9. Common Vulnerabilities

### 1. Insufficient Input Validation

**Vulnerable**:
```cashscript
function spend(sig userSig, int amount) {
    require(checkSig(userSig, owner));
    // Missing amount validation!
}
```

**Secure**:
```cashscript
function spend(sig userSig, int amount) {
    require(checkSig(userSig, owner));
    require(amount > 0);
    require(amount <= maxAmount);
}
```

### 2. Time-Based Vulnerabilities

**Vulnerable**:
```cashscript
// WRONG - strict inequality
require(tx.time > lockTime);
```

**Secure**:
```cashscript
// CORRECT - use >=
require(tx.time >= lockTime);
require(lockTime > 0);
```

### 3. Missing Output Token Validation

**Vulnerable**:
```cashscript
// Allows attacker to add tokens to output
require(tx.outputs[0].value == 1000);
```

**Secure**:
```cashscript
require(tx.outputs[0].value == 1000);
require(tx.outputs[0].tokenCategory == 0x);  // Pure BCH only
```

### 4. Overflow in State Counters

**Vulnerable**:
```cashscript
int newID = int(currentID) + 1;
require(tx.outputs[0].nftCommitment == bytes4(newID) + rest);
```

**Secure**:
```cashscript
int newID = int(currentID) + 1;
require(newID != 2147483647);  // Check BEFORE using
require(tx.outputs[0].nftCommitment == bytes4(newID) + rest);
```

---

## 10. Security Checklist

### Pre-Deployment

**Covenant Validation**:
- [ ] All 5 properties validated for self-replicating contracts
- [ ] Correct capability flags checked (0x01 mutable, 0x02 minting)
- [ ] NFT commitment structure validated (first byte identifier)

**Authority**:
- [ ] All input contracts authenticated via tokenCategory
- [ ] Position indices enforced with `this.activeInputIndex`
- [ ] No unauthorized tokens can be created

**Minting Protection**:
- [ ] Output count limited in ALL functions
- [ ] Each output's tokenCategory validated
- [ ] Change outputs restricted to BCH-only or known tokens

**State**:
- [ ] State byte layouts documented
- [ ] All state transitions validated
- [ ] No state can be corrupted by invalid input

**Value**:
- [ ] BCH values validated (minimum 1000 sats typically)
- [ ] Value changes calculated correctly
- [ ] No value can leak

**Time**:
- [ ] Locktime uses `>=` not `>`
- [ ] `this.age` used for relative locks (blocks only)

**Edge Cases**:
- [ ] Division by zero prevented
- [ ] Minimum amounts enforced
- [ ] Partial operations handled correctly

### Testing

- [ ] Unit tests cover all functions
- [ ] Boundary conditions tested
- [ ] Attack vectors simulated
- [ ] Integration tests with real transactions

### Production

- [ ] Code audited by security experts
- [ ] Deployed on testnet first
- [ ] Monitoring in place
- [ ] Emergency procedures documented

---

## 11. Deployment Checklist

When deploying a multi-contract system:

1. **Deploy all contracts** - Get P2SH32 addresses
2. **Create token category** - Genesis transaction
3. **Hardcode addresses** - Embed in source where needed
4. **Recompile** - With embedded addresses
5. **Redeploy** - Final deployment with trust anchors
6. **Mint system NFTs** - Create master/function/sidecar NFTs
7. **Initialize positions** - Send NFTs to their contracts
8. **Test transactions** - Verify all positions work

**Critical Note**: Contracts are **immutable after deployment**. All inter-contract addresses must be correct at compile time.

---

## Quick Reference Links

- **Core Language Reference**: See `CORE_REFERENCE.md`
- **FAQ & Troubleshooting**: See `FAQ_DISTILLED.md`
