# CashScript Core Reference

**Single authoritative reference for CashScript development on Bitcoin Cash.**

---

## 1. UTXO Mental Model (READ THIS FIRST)

### This is NOT Ethereum

Bitcoin Cash uses an Unspent Transaction Output (UTXO) model. A CashScript contract doesn't "do" anything - it only **validates** whether a proposed transaction meets its rules.

| Aspect | UTXO (CashScript/BCH) | Account (EVM/Solidity) |
|--------|----------------------|------------------------|
| **State** | No global state, independent atomic UTXOs | Global state tree, persistent storage |
| **Execution** | Transaction-level validation, stateless scripts | Contract-level execution, stateful |
| **Concurrency** | Parallel spending of different UTXOs | Sequential (nonce-based) |
| **Persistence** | UTXO chains, NFT commitments (40 bytes, 128 in May 2026) | Storage slots, mappings, state variables |
| **Transaction** | Multiple inputs → Multiple outputs | Single sender → Single recipient |
| **Gas/Fees** | Fee based on tx size (bytes) | Computational steps (opcode-based) |
| **Introspection** | Full tx visibility (`tx.inputs[]`, `tx.outputs[]`) | Limited (`msg.sender`, `msg.value`) |
| **Reentrancy** | N/A (atomic transactions) | Vulnerable (requires guards) |
| **Tokens** | Native CashTokens (FT/NFT) | ERC-20/721 contract standards |
| **Inter-Contract** | Via multi-input transactions | `call`, `delegatecall`, `staticcall` |
| **Signatures** | Explicit `checkSig(sig, pk)` | Implicit `msg.sender` recovery |

### The Core Question

For every contract, ask: **"What transformation of UTXOs does this contract permit?"**

Not "what does this contract do" but "what does this contract ALLOW to happen to itself?"

### State Lives in UTXOs

```
UTXO → consumed & recreated → state carried in new UTXO
```
- **Mutable NFT commitment** = where state lives (40 bytes, 128 in May 2026)
- **Contract recreation** = how state persists
- **NFT capability** = authority identifier

### Mental Model: UTXO State Continuity

```
EVM: storage.balance += amount (in-place state update)

CashScript:
1. Consume UTXO with current balance (input)
2. Validate input has expected balance state: require(tx.inputs[0].nftCommitment == oldState)
3. Create new UTXO with updated balance (output)
4. Enforce balance conservation: sum(inputs) == sum(outputs) + fee
5. Set new state: require(tx.outputs[0].nftCommitment == newState)
```

---

## 2. Type System

| Type | Size | Operations | Methods | Conversions |
|------|------|-----------|---------|-------------|
| `bool` | 1 bit | `! && \|\| == !=` | - | - |
| `int` | Variable | `+ - * / % < <= > >= == !=` | - | `bytes(int)` `bytesN(int)` |
| `string` | Variable | `+ == !=` | `.length` `.reverse()` `.split(i)` `.slice(s,e)` | `bytes(string)` |
| `bytes` | Variable | `+ == != & \| ^` | `.length` `.reverse()` `.split(i)` `.slice(s,e)` | - |
| `bytesN` | N bytes (1-64) | Same as bytes | Same as bytes | `bytesN(any)` |
| `pubkey` | 33 bytes | `== !=` | - | Auto to bytes |
| `sig` | ~65 bytes | `== !=` | - | Auto to bytes |
| `datasig` | ~64 bytes | `== !=` | - | Auto to bytes |

**Common bytesN**: `bytes1` (byte), `bytes4` (prefix), `bytes20` (hash160), `bytes32` (sha256), `bytes64` (signature)

### Script Number Encoding

BCH Script uses sign-magnitude encoding: the MSB of the last byte indicates sign, values are little-endian, and minimal encoding is required (no unnecessary leading zeros).

**Maximum positive values by byte size:**
- `bytes1`: 127 (2^7 - 1)
- `bytes2`: 32,767 (2^15 - 1)
- `bytes4`: 2,147,483,647 (2^31 - 1)
- `bytes8`: 9,223,372,036,854,775,807 (2^63 - 1)

**Why MSB matters**: The sign bit occupies the MSB of the final byte. If you use the full byte range, values with a set MSB are interpreted as negative.

**Post-May 2025**: BigInt support enables arbitrary precision up to 10,000 bytes (matching stack element limit). The encoding rules remain the same.

### Type Casting Limit

Only `bytes1` through `bytes8` can be cast to `int`. Larger bounded bytes types cause a compile error:

```cashscript
// OK
bytes8 amount = bytes8(commitment.slice(0, 8));
require(int(amount) > 0);

// COMPILE ERROR
bytes16 liquidity = bytes16(commitment.slice(0, 16));
require(int(liquidity) > 0);  // ❌ "Type 'bytes16' is not castable to type 'int'"
```

### Operators

| Category | Operators | Valid Types | Notes |
|----------|-----------|-------------|-------|
| Arithmetic | `+ - * / %` | `int` | Integer only, div/0 fails |
| Comparison | `< <= > >= == !=` | `int` `bool` `bytes` `string` | - |
| Logical | `! && \|\|` | `bool` | **NO short-circuit** (all operands evaluated) |
| Bitwise | `& \| ^` | `bytes` only | NOT supported on int. No shift or invert |
| Concatenation | `+` | `string` `bytes` | - |
| Unary | `+ - !` | `int` `bool` | - |

### Units

| BCH Units | Value | Time Units | Value |
|-----------|-------|------------|-------|
| `sats` | 1 | `seconds` | 1 |
| `finney` | 100,000 | `minutes` | 60 |
| `bits` | 100 | `hours` | 3,600 |
| `bitcoin` | 100,000,000 | `days` | 86,400 |
| - | - | `weeks` | 604,800 |

---

## 3. Global Variables & Introspection

### Transaction Properties

| Variable | Type | Description |
|----------|------|-------------|
| `tx.time` | `int` | Absolute time lock (nLocktime). <500M=block height, ≥500M=Unix timestamp |
| `tx.version` | `int` | Transaction version |
| `tx.locktime` | `int` | Transaction locktime value |
| `tx.inputs` | `Input[]` | Transaction inputs array |
| `tx.outputs` | `Output[]` | Transaction outputs array |

### Input Properties

```cashscript
tx.inputs[i].value                    // int: BCH amount in satoshis
tx.inputs[i].lockingBytecode          // bytes: Input scriptPubKey
tx.inputs[i].unlockingBytecode        // bytes: Input scriptSig
tx.inputs[i].outpointTransactionHash  // bytes32: UTXO source tx hash
tx.inputs[i].outpointIndex            // int: UTXO source output index
tx.inputs[i].sequenceNumber           // int: nSequence value
tx.inputs[i].tokenCategory            // bytes: 32-byte ID + optional capability
tx.inputs[i].nftCommitment            // bytes: NFT data (40 bytes, 128 in May 2026)
tx.inputs[i].tokenAmount              // int: Fungible token amount
```

### Output Properties

```cashscript
tx.outputs[i].value            // int: BCH amount in satoshis
tx.outputs[i].lockingBytecode  // bytes: Output script bytecode
tx.outputs[i].tokenCategory    // bytes: 32-byte ID + optional capability
tx.outputs[i].nftCommitment    // bytes: NFT data (40 bytes, 128 in May 2026)
tx.outputs[i].tokenAmount      // int: Fungible token amount
```

**Note**: Outputs do NOT have `outpointTransactionHash`, `outpointIndex`, `unlockingBytecode`, `sequenceNumber`.

### Contract Context

```cashscript
this.activeInputIndex   // int: Current input being evaluated
this.activeBytecode     // bytes: Current input's locking bytecode
this.age                // int: Relative UTXO age in blocks (SDK limitation)
```

### Locking Bytecode Constructors

```cashscript
new LockingBytecodeP2PKH(bytes20 pkHash)       // Pay to public key hash
new LockingBytecodeP2SH20(bytes20 scriptHash)  // Pay to script hash (20-byte, legacy)
new LockingBytecodeP2SH32(bytes32 scriptHash)  // Pay to script hash (32-byte, default)
new LockingBytecodeNullData(bytes[] chunks)    // OP_RETURN data output
```

---

## 4. Built-in Functions

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `abs` | `(int)` | `int` | Absolute value |
| `min` | `(int, int)` | `int` | Minimum of two |
| `max` | `(int, int)` | `int` | Maximum of two |
| `within` | `(int x, int lower, int upper)` | `bool` | `x >= lower && x < upper` (upper exclusive) |
| `sha256` | `(any)` | `bytes32` | SHA-256 hash |
| `sha1` | `(any)` | `bytes20` | SHA-1 hash |
| `ripemd160` | `(any)` | `bytes20` | RIPEMD-160 hash |
| `hash160` | `(any)` | `bytes20` | SHA-256 then RIPEMD-160 |
| `hash256` | `(any)` | `bytes32` | Double SHA-256 |
| `checkSig` | `(sig, pubkey)` | `bool` | Transaction signature. NULLFAIL: invalid=fail, `0x`=false |
| `checkMultiSig` | `([sig, ...], [pubkey, ...])` | `bool` | Multi-sig. NOT in TypeScript SDK |
| `checkDataSig` | `(datasig, bytes, pubkey)` | `bool` | Data signature. NULLFAIL applies |
| `bytes` | `(any)` | `bytes` | Type conversion |
| `bytesN` | `(any)` | `bytesN` | Fixed-length conversion (pads/truncates) |

---

## 5. CashTokens Essentials

### Token Category (Identity)

Every CashToken belongs to a **token category** identified by a 32-byte category ID.

```cashscript
bytes32 tokenCategory = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
```

### Token Types

**Fungible Tokens (FT)**: Divisible tokens with amounts, represented by `tokenAmount` property.

**Non-Fungible Tokens (NFT)**: Unique tokens with capabilities and commitments.

### NFT Capabilities (The 33rd Byte)

`tokenCategory` is 33 bytes: 32-byte categoryId + 1-byte capability flag.

| Capability | Byte | Description |
|------------|------|-------------|
| Immutable | `0x` (absent) | Cannot modify NFT commitment when spent |
| Mutable | `0x01` | Can modify commitment, downgrade to immutable |
| Minting | `0x02` | Can create unlimited NFTs, downgrade to mutable/immutable |

### Token Category Arithmetic

```cashscript
bytes32 systemTokenId = 0x1234...;

// Validate minting NFT
require(tx.inputs[0].tokenCategory == systemTokenId + 0x02);

// Validate mutable NFT
require(tx.inputs[1].tokenCategory == systemTokenId + 0x01);

// Validate immutable NFT (no suffix)
require(tx.inputs[2].tokenCategory == systemTokenId);

// Extract category and capability
bytes category, bytes capability = tx.inputs[0].tokenCategory.split(32);
require(capability == 0x02); // Must be minting
```

### Token Properties Check

```cashscript
// Check if output has tokens
bool hasTokens = tx.outputs[0].tokenCategory != 0x;

// Prevent tokens on output (pure BCH)
require(tx.outputs[N].tokenCategory == 0x);
```

### Token Constraints

- One NFT per output maximum
- All tokens in output must share same category
- Fungible token amount: 1 to 9,223,372,036,854,775,807 (64-bit)
- NFT commitment: max 40 bytes (128 in May 2026)
- Category byte order: unreversed (OP_HASH256 format)

---

## 6. SDK Quick Start

### Installation

```bash
npm install cashscript
npm install -g cashc  # Compiler (optional)
```

### Contract Instantiation

```javascript
import { Contract, ElectrumNetworkProvider } from 'cashscript';
import { compileFile } from 'cashc';

// Compile contract
const artifact = compileFile('contract.cash');

// Create provider
const provider = new ElectrumNetworkProvider('mainnet');  // or 'chipnet'

// Create contract instance
const ownerPubkey = Buffer.from('03...', 'hex');
const contract = new Contract(artifact, [ownerPubkey], { provider });

console.log('Address:', contract.address);
console.log('Balance:', await contract.getBalance());
```

### Transaction Building

```javascript
import { SignatureTemplate } from 'cashscript';

const sigTemplate = new SignatureTemplate(privateKey);

// Simple spend
const txDetails = await contract.functions
    .spend(sigTemplate)
    .to('bitcoincash:qr...', 1000n)
    .send();

// With CashTokens
const txDetails = await contract.functions
    .transfer(sigTemplate)
    .to({
        to: 'bitcoincash:qr...',
        amount: 1000n,
        token: {
            category: '1234...abcdef',
            amount: 100n  // Fungible tokens
        }
    })
    .send();

// With NFT
const txDetails = await contract.functions
    .mintNFT(sigTemplate)
    .to({
        to: 'bitcoincash:qr...',
        amount: 1000n,
        token: {
            category: '1234...abcdef',
            nft: {
                capability: 'mutable',  // 'none', 'mutable', 'minting'
                commitment: Buffer.from('data-here')
            }
        }
    })
    .send();
```

### Address Types

```javascript
const options = {
    provider: provider,
    addressType: 'p2sh32'  // default, more secure
    // or 'p2sh20' (legacy) or 'p2s' (direct script, more efficient)
};
```

---

## 7. Byte Extraction: split() vs slice()

| Method | Signature | Returns | Use Case |
|--------|-----------|---------|----------|
| `split(index)` | `.split(i)` | `(bytes, bytes)` tuple | Head/tail separation |
| `slice(start, end)` | `.slice(s, e)` | `bytes` | Extract from middle |

### When to Use Which

**split()** - Best for extracting from START or END, or sequential destructuring:
```cashscript
// First 20 bytes
bytes20 ownerPkh = bytes20(commitment.split(20)[0]);

// Last 4 bytes (of 40-byte commitment)
bytes4 suffix = bytes4(commitment.split(36)[1]);

// Sequential destructuring
bytes20 owner, bytes rest = commitment.split(20);
bytes8 balance, bytes rest2 = rest.split(8);
```

**slice()** - Best for extracting from the MIDDLE:
```cashscript
// Bytes 64-71 from commitment
bytes8 reserveBytes = bytes8(commitment.slice(64, 72));
int reserve = int(reserveBytes);
```

### Common Extraction Patterns

```
Commitment: [field0(20) | field1(8) | field2(32) | field3(4)] = 64 bytes

Field 0 (offset 0, size 20):   bytes20(commitment.split(20)[0])
Field 1 (offset 20, size 8):   bytes8(commitment.slice(20, 28))
Field 2 (offset 28, size 32):  bytes32(commitment.slice(28, 60))
Field 3 (offset 60, size 4):   bytes4(commitment.split(60)[1])
```

---

## 8. NFT Commitment Data Storage

### Production Pattern: Structured Commitment

```cashscript
// Layout: userPkh(20) + reserved(18) + lockBlocks(2) = 40 bytes total

// WRITE: Pack into commitment
require(tx.outputs[0].nftCommitment == userPkh + bytes18(0) + bytes2(lockBlocks));

// READ: Unpack from commitment
bytes20 storedPkh = bytes20(tx.inputs[0].nftCommitment.split(20)[0]);
bytes2 stakeBlocks = bytes2(tx.inputs[0].nftCommitment.split(38)[1]);
int blocks = int(stakeBlocks);
```

### Partial Commitment Updates

```cashscript
// Update only last N bytes
bytes restCommitment = tx.inputs[0].nftCommitment.split(31)[0];
int newPledgeID = int(pledgeID) + 1;
require(tx.outputs[0].nftCommitment == restCommitment + bytes4(newPledgeID) + campaignID);

// Update only first N bytes
bytes existingTail = tx.inputs[0].nftCommitment.split(2)[1];
require(tx.outputs[0].nftCommitment == bytes2(newFee) + existingTail);
```

### Common Layouts (40 bytes)

```
[pubkeyhash(20) + fee(2) + adminPkh(18)]                    // Admin contract
[pubkeyhash(20) + reserved(18) + blocks(2)]                 // Time-locked
[pledgeAmt(6) + padding(21) + endBlock(4) + id(4) + campaignID(5)]  // Receipt NFT
```

---

## 9. Common Patterns

### Self-Replicating Covenant

```cashscript
function process() {
    // Limit outputs (CRITICAL - prevent minting attacks)
    require(tx.outputs.length <= 5);

    // Self-replicate: all 5 properties
    require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
    require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
    require(tx.outputs[0].value == tx.inputs[0].value);
    require(tx.outputs[0].tokenAmount == tx.inputs[0].tokenAmount);
    require(tx.outputs[0].nftCommitment == newCommitment);  // State can change
}
```

### UTXO-Based Authorization (No Signature)

```cashscript
function userAction(bytes20 userPkh) {
    // User proves ownership by spending their UTXO
    require(tx.inputs[1].lockingBytecode == new LockingBytecodeP2PKH(userPkh));
}
```

### Time-Locked Release

```cashscript
function unlock() {
    require(tx.time >= lockTime);      // Absolute: ALWAYS use >=
    require(this.age >= requiredAge);  // Relative: blocks only
}
```

### Input Position Validation

```cashscript
function myOperation() {
    // ALWAYS validate your own position
    require(this.activeInputIndex == 2);

    // Validate other contracts at expected positions
    require(tx.inputs[0].tokenCategory == oracleCategory + 0x01);
    require(tx.inputs[1].tokenCategory == mainCategory + 0x01);
}
```

### Fee Accounting

```cashscript
// Minimum dust amounts
require(tx.outputs[0].value == 1000);  // Safe dust for token UTXO

// Explicit fee subtraction
require(tx.outputs[0].value == tx.inputs[0].value - 3000);  // fee + dust

// Fee collection into contract
bytes2 stakeFee = bytes2(tx.inputs[0].nftCommitment.split(2)[0]);
require(tx.outputs[0].value == tx.inputs[0].value + int(stakeFee));
```

---

## 10. Solidity → CashScript Mapping

| Solidity | CashScript | Notes |
|----------|-----------|-------|
| `constructor(address _owner)` | `contract MyContract(pubkey owner)` | Immutable per UTXO |
| `uint256 balance;` | NFT commitment | State in 40-byte commitment |
| `mapping(address => uint)` | N/A | No O(1) lookups |
| `require(condition, "msg")` | `require(condition);` | No error messages |
| `msg.sender` | `checkSig(sig, pubkey)` | Explicit signature verification |
| `msg.value` | `tx.inputs[this.activeInputIndex].value` | Sum inputs, validate outputs |
| `transfer(recipient, amount)` | `require(tx.outputs[0].value >= amount)` | Covenant-based |
| `emit Event(data)` | N/A | Transaction IS the event |
| `for(uint i=0; i<n; i++)` | `do { i=i+1; } while(i<n)` | Beta in v0.13.0 |
| `x++`, `x += 1` | `x = x + 1;` | No compound assignment |
| `import` | N/A | Single file contracts |
| `interface/library` | N/A | No code reuse mechanisms |
| `enum` | `int PENDING = 0;` | Use int constants |
| `struct` | bytes + `.split()` | Pack into bytes |

---

## 11. Critical Gotchas

### No Short-Circuit Evaluation
```cashscript
// ❌ DANGEROUS - both sides always evaluated
array.length > 0 && array[0] == value

// ✅ SAFE - separate statements
require(array.length > 0);
require(array[0] == value);
```

### Time Comparison
```cashscript
// ❌ WRONG
require(tx.time > lockTime);

// ✅ CORRECT - ALWAYS use >=
require(tx.time >= lockTime);
```

### No Compound Assignment
```cashscript
// ❌ NOT SUPPORTED
x++; x += 1; x -= 1;

// ✅ CORRECT
x = x + 1;
```

### Bitwise on bytes Only
```cashscript
// ❌ COMPILE ERROR - bitwise on int
int flags = 0x05;
require((flags & 0x01) == 0x01);

// ✅ CORRECT - use bytes
bytes1 flags = 0x05;
require((flags & 0x01) == 0x01);
```

### Array Bounds
```cashscript
// ❌ DANGEROUS - no automatic bounds checking
tx.outputs[5].value

// ✅ SAFE - always validate first
require(tx.outputs.length > 5);
require(tx.outputs[5].value >= amount);
```

---

## 12. VM Limits (Current)

**May 2025 Active:**
- Stack element limit: 10,000 bytes (was 520 bytes)
- 201-opcode limit: REMOVED, replaced by operation cost system
- Operation cost budget: (41 + unlocking_bytecode_length) × 800
- BigInt support: enabled for large number arithmetic

**May 2026 Upgrade:**
- NFT commitment: 128 bytes (currently 40 bytes)
- P2S (Pay to Script) becomes standard
- 10,000 bytes unlocking bytecode limit

---

## 13. Contract Template

```cashscript
pragma cashscript ^0.13.0;

/*  --- ContractName Mutable NFT State ---
    bytes20 userPkh = 0x...
    bytes2 lockBlocks = 0x0000
*/

contract ContractName(bytes32 tokenCategory) {
    //////////////////////////////////////////////////////////////////////////////////////////
    //  Brief description of what this function does.
    //
    //inputs:
    //  0   masterNFT                 [NFT]       (from this contract)
    //  1   userBCH                   [BCH]       (from user)
    //outputs:
    //  0   masterNFT                 [NFT]       (to this contract)
    //  1   result                    [BCH]       (to user)
    //////////////////////////////////////////////////////////////////////////////////////////
    function operate(bytes20 userPkh) {
        // 1. Validate position
        require(this.activeInputIndex == 0);

        // 2. Limit outputs (CRITICAL)
        require(tx.outputs.length <= 3);

        // 3. Authenticate
        require(tx.inputs[0].tokenCategory == tokenCategory + 0x01);
        require(tx.inputs[1].lockingBytecode == new LockingBytecodeP2PKH(userPkh));

        // 4. Business logic
        bytes commitment = tx.inputs[0].nftCommitment;
        // ... process ...

        // 5. Self-replicate (5-point covenant)
        require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
        require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
        require(tx.outputs[0].value == 1000);
        require(tx.outputs[0].tokenAmount == tx.inputs[0].tokenAmount);
        require(tx.outputs[0].nftCommitment == newCommitment);
    }
}
```

---

## Quick Reference Links

- **Security & Architecture**: See `SECURITY_ARCHITECTURE.md`
- **FAQ & Troubleshooting**: See `FAQ_DISTILLED.md`
- **CashScript Docs**: https://cashscript.org/docs/
- **CashTokens Spec**: https://cashtokens.org/docs/spec/
