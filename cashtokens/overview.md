# CashTokens Integration

## Token Types

| Type | Properties | Use |
|------|------------|-----|
| Fungible (FT) | `tokenCategory`, `tokenAmount` | Divisible value |
| NFT | `tokenCategory`, `nftCommitment`, capability | Unique assets, state |

**Capabilities** (33rd byte of `tokenCategory`):
- `0x00`/absent: Immutable (permanent)
- `0x01`: Mutable (can modify commitment once)
- `0x02`: Minting (can create new NFTs)

**Commitment**: Max 40 bytes (128 bytes in May 2026).

**FT Creation**: ALL fungible tokens created at genesis. Cannot mint post-genesis.

**NFT Creation**: Only via minting capability (0x02) post-genesis.

---

## CashScript Access

```cashscript
// Output properties
tx.outputs[i].tokenCategory  // bytes32 + capability byte
tx.outputs[i].tokenAmount    // int (FT)
tx.outputs[i].nftCommitment  // bytes (NFT)

// Check for tokens
bool hasTokens = tx.outputs[i].tokenCategory != 0x;

// Category + capability check
require(tx.inputs[0].tokenCategory == expectedCategory + 0x01); // Mutable
require(tx.inputs[0].tokenCategory == expectedCategory + 0x02); // Minting
```

---

## SDK Usage

```javascript
// Fungible Token
.to({
    to: address,
    amount: 1000n,
    token: { category: categoryHex, amount: 100n }
})

// NFT
.to({
    to: address,
    amount: 1000n,
    token: {
        category: categoryHex,
        nft: {
            capability: 'none',  // 'none' | 'mutable' | 'minting'
            commitment: Buffer.from('data')
        }
    }
})
```

---

## Finding Tokens

```javascript
const utxos = await contract.getUtxos();
const tokenUtxos = utxos.filter(u => u.token?.amount > 0);
const nftUtxos = utxos.filter(u => u.token?.nft);
const specific = utxos.filter(u => u.token?.category === targetCategory);
```

---

## Common Patterns

### State Storage (NFT Commitment)
```cashscript
require(tx.inputs[0].tokenCategory == stateCategory);
require(tx.outputs[0].tokenCategory == stateCategory);
require(tx.outputs[0].nftCommitment == newState);
```

### Token-Gated Access
```cashscript
require(tx.inputs[1].tokenCategory == requiredCategory);
require(tx.inputs[1].tokenAmount >= minimumAmount);
```

### Token Conservation
```cashscript
int inputTokens = tx.inputs[0].tokenAmount + tx.inputs[1].tokenAmount;
int outputTokens = tx.outputs[0].tokenAmount + tx.outputs[1].tokenAmount;
require(inputTokens >= outputTokens);
```

### Burn to OP_RETURN
```cashscript
require(tx.outputs[burnIdx].lockingBytecode == 0x6a);
require(tx.outputs[burnIdx].tokenCategory == burnCategory);
```

---

## Pitfalls

| Wrong | Right |
|-------|-------|
| `amount = 100` | `amount = 100n` (BigInt) |
| `category = 'name'` | `category = '1234...abcd'` (32-byte hex) |
| `commitment > 40B` | `commitment <= 40B` (128B in May 2026) |
| `capability = 'readonly'` | `capability = 'none' \| 'mutable' \| 'minting'` |
