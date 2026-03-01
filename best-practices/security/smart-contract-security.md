# CashScript Smart Contract Security

## Overview

Smart contract security is critical when handling value on the Bitcoin Cash blockchain. This guide covers essential security practices, common vulnerabilities, and defensive programming techniques for CashScript contracts.

## Core Security Principles

### 1. Fail-Safe Defaults

Design contracts to fail securely when conditions aren't met.

```cashscript
contract SecureContract(pubkey owner, int threshold) {
    function spend(sig ownerSig, int amount) {
        // Explicit validation required
        require(checkSig(ownerSig, owner));
        require(amount >= threshold);
        
        // Additional safety checks
        require(tx.outputs.length >= 1);
        require(tx.outputs[0].value >= amount);
    }
}
```

### 2. Input Validation

Never trust function arguments - validate everything.

```cashscript
contract InputValidation(pubkey owner) {
    function spend(sig userSig, int amount, bytes data) {
        // Validate signature
        require(checkSig(userSig, owner));
        
        // Validate amount
        require(amount > 0);
        require(amount <= 100_000_000);  // Max 1 BCH
        
        // Validate data
        require(data.length > 0);
        require(data.length <= 256);  // Reasonable data limit
    }
}
```

### 3. Principle of Least Privilege

Grant minimum necessary permissions.

```cashscript
contract RestrictedAccess(pubkey owner, pubkey operator, int operatorLimit) {
    function ownerSpend(sig ownerSig, int amount) {
        require(checkSig(ownerSig, owner));
        // Owner can spend any amount
    }
    
    function operatorSpend(sig operatorSig, int amount) {
        require(checkSig(operatorSig, operator));
        // Operator has limited spending power
        require(amount <= operatorLimit);
    }
}
```

## Common Vulnerabilities

### 1. Insufficient Input Validation

**Vulnerable Code:**
```cashscript
contract VulnerableContract(pubkey owner) {
    function spend(sig userSig, int amount) {
        require(checkSig(userSig, owner));
        // Missing amount validation!
    }
}
```

**Secure Version:**
```cashscript
contract SecureContract(pubkey owner, int maxAmount) {
    function spend(sig userSig, int amount) {
        require(checkSig(userSig, owner));
        require(amount > 0);
        require(amount <= maxAmount);
    }
}
```

### 2. Time-Based Vulnerabilities

**Vulnerable Code:**
```cashscript
contract VulnerableTimelock(pubkey owner, int lockTime) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));
        // Vulnerable to time manipulation
        require(tx.time > lockTime);
    }
}
```

**Secure Version:**
```cashscript
contract SecureTimelock(pubkey owner, int lockTime) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));
        // Use >= for time comparisons
        require(tx.time >= lockTime);
        
        // Additional validation
        require(lockTime > 0);
    }
}
```

### 3. Signature Malleability

**Vulnerable Code:**
```cashscript
contract VulnerableMultiSig(pubkey pk1, pubkey pk2) {
    function spend(sig s1, sig s2) {
        // Vulnerable to signature substitution
        require(checkSig(s1, pk1));
        require(checkSig(s2, pk2));
    }
}
```

**Secure Version:**
```cashscript
contract SecureMultiSig(pubkey pk1, pubkey pk2) {
    function spend(sig s1, sig s2) {
        // Use checkMultiSig for proper validation
        require(checkMultiSig([s1, s2], [pk1, pk2]));
    }
}
```

### 4. Reentrancy-Like Issues

**Vulnerable Code:**
```cashscript
contract VulnerableState() {
    function spend(int counter) {
        // No validation of state consistency
        require(counter > 0);
    }
}
```

**Secure Version:**
```cashscript
contract SecureState(bytes32 stateHash) {
    function spend(int counter, bytes stateData) {
        // Validate state integrity
        require(sha256(stateData) == stateHash);
        require(counter > 0);
        
        // Extract and validate counter from state
        int currentCounter = int(stateData.split(4)[0]);
        require(counter == currentCounter + 1);
    }
}
```

## Defensive Programming Patterns

### 1. Bounds Checking

```cashscript
contract BoundsChecker(int minValue, int maxValue) {
    function validate(int value) {
        // Explicit bounds checking
        require(value >= minValue);
        require(value <= maxValue);
        
        // Additional safety for array-like operations
        require(minValue <= maxValue);
    }
}
```

### 2. Overflow Protection

```cashscript
contract OverflowProtection() {
    function safeAdd(int a, int b) {
        // Check for addition overflow
        require(a >= 0);
        require(b >= 0);
        
        int result = a + b;
        require(result >= a);  // Overflow check
        require(result >= b);  // Overflow check
    }
    
    function safeMultiply(int a, int b) {
        // Check for multiplication overflow
        require(a >= 0);
        require(b >= 0);
        
        if (a != 0 && b != 0) {
            int result = a * b;
            require(result / a == b);  // Overflow check
        }
    }
}
```

### 3. Access Control

```cashscript
contract AccessControl(pubkey admin, pubkey operator1, pubkey operator2) {
    function adminAction(sig adminSig) {
        require(checkSig(adminSig, admin));
        // Admin-only actions
    }
    
    function operatorAction(sig operatorSig, pubkey operatorPk) {
        // Validate operator is one of the authorized keys
        require(operatorPk == operator1 || operatorPk == operator2);
        require(checkSig(operatorSig, operatorPk));
    }
}
```

### 4. State Validation

```cashscript
contract StateValidation(bytes32 initialStateHash) {
    function updateState(bytes oldState, bytes newState) {
        // Validate old state
        require(sha256(oldState) == initialStateHash);
        
        // Validate state transition
        require(newState.length == oldState.length);
        require(newState != oldState);  // State must change
        
        // Validate new state format
        require(newState.length >= 32);
    }
}
```

## Transaction Security

### 1. Output Validation

```cashscript
contract OutputValidator(bytes20 authorizedRecipient, pubkey owner) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));
        
        // Validate transaction structure
        require(tx.outputs.length >= 1);
        
        // Validate recipient
        bytes expectedBytecode = new LockingBytecodeP2PKH(authorizedRecipient);
        require(tx.outputs[0].lockingBytecode == expectedBytecode);
        
        // Validate amount
        require(tx.outputs[0].value >= 1000);
    }
}
```

### 2. Input Validation

```cashscript
contract InputValidator(bytes32 expectedTokenCategory, pubkey owner) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));

        // Pin own position
        require(this.activeInputIndex == 0);

        // Authenticate co-signer at input 1 by token category
        require(tx.inputs[1].tokenCategory == expectedTokenCategory + 0x01);

        // Limit total inputs to prevent unexpected co-spends
        require(tx.inputs.length <= 3);
    }
}
```

### 3. Fee Validation

**Fixed input/output count:**

```cashscript
contract SimpleFeeValidator(pubkey owner) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));

        // 1-in, 1-out: fee is the difference
        int fee = tx.inputs[this.activeInputIndex].value - tx.outputs[0].value;
        require(fee >= 1000);
        require(fee <= 100_000);
    }
}
```

**Dynamic input/output counts with loops (v0.13.0+ / May 2026):**

```cashscript
contract DynamicFeeValidator(pubkey owner) {
    function spend(sig ownerSig) {
        require(checkSig(ownerSig, owner));

        require(tx.inputs.length <= 10);
        require(tx.outputs.length <= 10);

        int totalInput = 0;
        int totalOutput = 0;

        for (int i = 0; i < tx.inputs.length; i = i + 1) {
            totalInput = totalInput + tx.inputs[i].value;
        }

        for (int i = 0; i < tx.outputs.length; i = i + 1) {
            totalOutput = totalOutput + tx.outputs[i].value;
        }

        int fee = totalInput - totalOutput;
        require(fee >= 1000);
        require(fee <= 100_000);
    }
}
```

## Cryptographic Security

### 1. Hash Validation

```cashscript
contract HashValidator(bytes32 expectedHash) {
    function validate(bytes preimage) {
        // Validate preimage length
        require(preimage.length > 0);
        require(preimage.length <= 1024);  // Reasonable limit
        
        // Validate hash
        require(sha256(preimage) == expectedHash);
        
        // Additional validation for sensitive data
        require(preimage.split(1)[0] != 0x00);  // Prevent null byte attacks
    }
}
```

### 2. Signature Validation

```cashscript
contract SignatureValidator(pubkey trustedKey) {
    function validate(datasig signature, bytes message) {
        // Validate signature format
        require(signature.length > 0);
        require(signature != 0x00);  // Prevent null signature

        // Validate message
        require(message.length > 0);
        require(message.length <= 256);
        
        // Validate signature
        require(checkDataSig(signature, message, trustedKey));
    }
}
```

### 3. Key Validation

```cashscript
contract KeyValidator() {
    function validateKey(pubkey key) {
        // Validate key format
        require(key.length == 33);  // Compressed public key
        
        // Validate key prefix (first byte must be 0x02 or 0x03)
        byte prefix = bytes(key).split(1)[0];
        require(prefix == 0x02 || prefix == 0x03);

        // Prevent null key by checking signature against it
        // (in practice, just use checkSig — invalid keys fail naturally)
    }
}
```

## CashTokens Security

### 1. Token Validation

```cashscript
contract TokenValidator(bytes32 authorizedCategory) {
    function validateToken() {
        // tokenCategory returns 32 bytes for FTs/immutable NFTs,
        // 33 bytes for mutable (+ 0x01) or minting (+ 0x02).
        // For FT-only validation, direct bytes32 comparison works:
        require(tx.outputs[0].tokenCategory == authorizedCategory);
        
        // For mutable NFT validation, append capability byte:
        // require(tx.outputs[0].tokenCategory == authorizedCategory + 0x01);

        // Validate token amount
        require(tx.outputs[0].tokenAmount > 0);
        
        // Prevent token overflow
        require(tx.outputs[0].tokenAmount <= 9_223_372_036_854_775_807);  // Max VM number
    }
}
```

### 2. NFT Security

```cashscript
contract NFTValidator(bytes32 authorizedCategory) {
    function validateNFT(bytes expectedCommitment) {
        // Validate NFT category (mutable NFT — append 0x01)
        require(tx.outputs[0].tokenCategory == authorizedCategory + 0x01);
        
        // Validate NFT commitment
        require(tx.outputs[0].nftCommitment == expectedCommitment);
        require(expectedCommitment.length > 0);
        require(expectedCommitment.length <= 128);  // Max commitment size
    }
}
```

## Bitwise Operation Security

### 1. Shift Amount Validation (May 2026 upgrade)

**Risk**: Invalid shift amounts causing unexpected results.

**Note**: Shift operators (`<<`, `>>`) and bitwise NOT (`~`) require the May 2026 network upgrade.

**Secure Pattern**:
```cashscript
contract SecureBitwise() {
    function safeShift(int value, int shiftAmount) {
        // Validate shift amount is reasonable
        require(shiftAmount >= 0);
        require(shiftAmount <= 64);  // Max meaningful shift

        int result = value << shiftAmount;
        require(result > 0);  // Validate result as expected
    }
}
```

**Best Practices**:
- Validate shift amounts before operations
- Check for zero shifts
- Verify shift results are as expected
- Test boundary cases (0, 1, max bits)

### 2. Bitwise Operation Security

**Risk**: Bitwise operations producing unexpected values or type errors.

**CRITICAL**: CashScript only supports bitwise operators (`& | ^`) on `bytes` types, NOT on `int`.

**Secure Pattern**:
```cashscript
contract BitwiseSecurity(bytes4 mask) {
    function processFlags(bytes4 flags) {
        // Bitwise AND on bytes types
        bytes4 result = flags & mask;

        // Verify result matches expected pattern
        require(result == mask);  // All mask bits must be set
    }
}
```

**Best Practices**:
- Use `bytes` or `bytesN` types for bitwise operations (NOT `int`)
- Use appropriate fixed-length bytes for bit ranges (bytes1, bytes2, bytes4)
- Test with edge values (0x00, 0xFF, all bits set)

### 3. Bit Flag Security

**Risk**: Incorrect flag checking allowing unauthorized access.

**Secure Pattern**:
```cashscript
contract FlagValidator(bytes1 requiredFlags) {
    function checkPermissions(bytes1 userFlags) {
        // Check required flags are ALL set (bitwise AND on bytes)
        bytes1 result = userFlags & requiredFlags;
        require(result == requiredFlags);

        // Check specific bit flags using bytes comparison
        bytes1 allowedFlags = 0xFF;
        bytes1 extraFlags = userFlags & (allowedFlags ^ requiredFlags);
        require(extraFlags == 0x00);  // No unauthorized flags
    }
}
```

**Best Practices**:
- Use `bytes1` for single-byte flag fields
- Validate all required flags are set using `& mask == mask` pattern
- Define explicit flag masks as `bytes` constants
- Test all flag combinations

## Security Testing

### 1. Boundary Testing

```javascript
describe('Contract Security Tests', () => {
    it('should reject negative amounts', async () => {
        const utxos = await contract.getUtxos();
        const contractUtxo = utxos[0];
        await expect(
            new TransactionBuilder({ provider })
                .addInput(contractUtxo, contract.unlock.spend(sigTemplate, -1))
                .addOutput({ to: address, amount: 1000n })
                .send()
        ).rejects.toThrow();
    });

    it('should reject zero amounts', async () => {
        const utxos = await contract.getUtxos();
        const contractUtxo = utxos[0];
        await expect(
            new TransactionBuilder({ provider })
                .addInput(contractUtxo, contract.unlock.spend(sigTemplate, 0))
                .addOutput({ to: address, amount: 1000n })
                .send()
        ).rejects.toThrow();
    });

    it('should reject excessive amounts', async () => {
        const utxos = await contract.getUtxos();
        const contractUtxo = utxos[0];
        await expect(
            new TransactionBuilder({ provider })
                .addInput(contractUtxo, contract.unlock.spend(sigTemplate, 2_100_000_000_000_000n))
                .addOutput({ to: address, amount: 1000n })
                .send()
        ).rejects.toThrow();
    });
});
```

### 2. Attack Simulation

```javascript
describe('Attack Vector Tests', () => {
    it('should prevent signature replay', async () => {
        const utxos = await contract.getUtxos();
        const contractUtxo = utxos[0];
        // Create valid transaction
        const txDetails = await new TransactionBuilder({ provider })
            .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
            .addOutput({ to: address, amount: 1000n })
            .send();

        // Attempt to replay — UTXO is consumed, so no valid input exists
        const utxos2 = await contract.getUtxos();
        // The spent UTXO is no longer available
        expect(utxos2.find(u => u.txid === contractUtxo.txid)).toBeUndefined();
    });
});
```

## Security Checklist

### Pre-Deployment

- [ ] All inputs are validated
- [ ] Bounds checking implemented
- [ ] Overflow protection in place
- [ ] Access control properly implemented
- [ ] Time-based logic uses appropriate comparisons
- [ ] Signature validation follows best practices
- [ ] Token validation includes all necessary checks
- [ ] Error cases are handled gracefully

### Testing

- [ ] Unit tests cover all functions
- [ ] Boundary conditions tested
- [ ] Attack vectors simulated
- [ ] Integration tests with real transactions
- [ ] Fee optimization verified (fees are based on transaction byte size)
- [ ] Multi-signature scenarios tested

### Production

- [ ] Code audited by security experts
- [ ] Deployed on testnet first
- [ ] Monitoring in place
- [ ] Upgrade/migration plan prepared
- [ ] Emergency procedures documented
- [ ] Insurance or backup funds available

## Emergency Response

### 1. Incident Detection

```javascript
// Monitor contract for suspicious activity
async function monitorContract(contract) {
    const utxos = await contract.getUtxos();
    
    for (const utxo of utxos) {
        // Check for unusual patterns
        if (utxo.satoshis > 1000000) {  // Large amount
            console.warn('Large UTXO detected:', utxo);
        }
        
        if (utxo.token && utxo.token.amount > 1000000) {
            console.warn('Large token amount detected:', utxo);
        }
    }
}
```

### 2. Emergency Procedures

```javascript
// Emergency contract pause (if implemented)
async function emergencyPause(contract, adminKey) {
    const adminSig = new SignatureTemplate(adminKey);
    
    try {
        const utxos = await contract.getUtxos();
        const contractUtxo = utxos[0];
        const txDetails = await new TransactionBuilder({ provider })
            .addInput(contractUtxo, contract.unlock.emergencyPause(adminSig))
            .send();
        
        console.log('Emergency pause activated:', txDetails.txid);
    } catch (error) {
        console.error('Emergency pause failed:', error);
    }
}
```

## Best Practices Summary

1. **Always validate inputs** - Never trust function arguments
2. **Use explicit bounds checking** - Prevent overflow and underflow
3. **Implement proper access control** - Restrict sensitive operations
4. **Validate transaction structure** - Check inputs and outputs
5. **Use secure cryptographic practices** - Proper signature validation
6. **Test thoroughly** - Include boundary and attack vector tests
7. **Monitor in production** - Watch for unusual activity
8. **Plan for emergencies** - Have response procedures ready
9. **Keep contracts simple** - Complexity increases attack surface
10. **Regular security audits** - External review of contract code

## Output Count Security (CRITICAL)

### The Minting Attack

**Vulnerability**: Without output count limits, attackers can add unauthorized outputs to mint tokens.

**Attack Vector**:
1. Attacker creates a valid transaction that satisfies all contract constraints
2. Attacker adds extra outputs minting new tokens or NFTs
3. Contract validates expected outputs but ignores the extras
4. Unauthorized tokens enter circulation

### Mandatory Output Limiting

**EVERY contract function MUST limit output count**:

```cashscript
contract SecureContract(bytes32 tokenCategory) {
    function spend() {
        // CRITICAL: ALWAYS include this as first validation
        require(tx.outputs.length <= 4);

        // ... rest of logic
    }
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
contract OutputSecureContract() {
    function processTransaction() {
        // FIRST: Limit outputs
        require(tx.outputs.length <= 5);

        // THEN: Validate specific outputs
        require(tx.outputs[0].lockingBytecode == expectedBytecode);
        require(tx.outputs[0].value >= 1000);

        // Even with validation, output limit prevents extra unauthorized outputs
    }
}
```

## Covenant Preservation Checklist

### The 5-Point Validation

For ANY self-replicating covenant, you MUST validate all five properties:

```cashscript
// THE 5-POINT COVENANT VALIDATION CHECKLIST
// Missing ANY of these creates vulnerabilities

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

**Missing lockingBytecode check**:
```cashscript
// VULNERABLE - attacker can substitute contract
function spend() {
    require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
    require(tx.outputs[0].value == tx.inputs[0].value);
    // Missing: lockingBytecode check!
}
```

**Missing tokenCategory check**:
```cashscript
// VULNERABLE - attacker can substitute token
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

## Minting Authority Control

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
// After initial setup, downgrade minting NFT
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
        // This proves legitimate origin
    }
}
```

## Multi-Contract Security

### Input Position Attacks

**Vulnerability**: Without position validation, attackers can reorder inputs.

**Attack**:
1. Contract expects input 0 = Oracle, input 1 = Main
2. Attacker swaps positions: input 0 = Main, input 1 = Oracle
3. Contract reads wrong data from wrong position

**Defense**:
```cashscript
function operation() {
    // ALWAYS validate your own position first
    require(this.activeInputIndex == 2);

    // ALWAYS validate other contracts at expected positions
    require(tx.inputs[0].tokenCategory == oracleCategory);
    require(tx.inputs[1].tokenCategory == mainCategory);
}
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

## Security Checklist Update

### Multi-Contract Security

- [ ] Output count limited in every function
- [ ] All 5 covenant properties validated
- [ ] Input positions explicitly validated
- [ ] Cross-contract authentication verified
- [ ] Minting authority controlled and contained
- [ ] Same-origin verification for paired contracts
- [ ] Token category arithmetic correct

### Pre-Deployment (Extended)

- [ ] All inputs are validated
- [ ] Bounds checking implemented
- [ ] Overflow protection in place
- [ ] Access control properly implemented
- [ ] Time-based logic uses appropriate comparisons
- [ ] Signature validation follows best practices
- [ ] Token validation includes all necessary checks
- [ ] Error cases are handled gracefully
- [ ] **Output count limited in all functions**
- [ ] **5-point covenant validation complete**
- [ ] **Minting authority secured**
- [ ] **Input positions validated**

Following these security practices will help ensure your CashScript contracts are robust and secure when handling real value on the Bitcoin Cash network.