# CashScript SDK: Transaction Building

## Basic Transaction

```javascript
import { SignatureTemplate } from 'cashscript';

const sigTemplate = new SignatureTemplate(privateKey);

const txDetails = await contract.functions
    .functionName(arg1, arg2)
    .to('bitcoincash:qr...', 100000n)
    .send();

console.log('TXID:', txDetails.txid);
```

## Multi-Output

```javascript
const txDetails = await contract.functions
    .spend(sigTemplate)
    .to(address1, 50000n)
    .to(address2, 30000n)
    .send();
```

## Options

```javascript
contract.functions
    .spend(sigTemplate)
    .to(address, amount)
    .withFeePerByte(1.1)         // Custom fee rate
    .withHardcodedFee(1000n)     // Fixed fee
    .withMinChange(5000n)        // Minimum change
    .withoutChange()             // No change output
    .withOpReturn(['data'])      // OP_RETURN
    .withTime(timestamp)         // Absolute timelock
    .withAge(blocks)             // Relative timelock
    .send();
```

## Manual Input Selection

```javascript
const utxos = await contract.getUtxos();
const txDetails = await contract.functions
    .spend(sigTemplate)
    .from(utxos[0])
    .to(address, amount)
    .send();
```

## TransactionBuilder (Advanced)

```javascript
import { TransactionBuilder } from 'cashscript';

const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addInput(userUtxo, sigTemplate.unlockP2PKH())
    .addOutput({ to: address, amount: 50000n })
    .setMaxFee(2000n)
    .send();
```

## CashTokens

```javascript
// Fungible Token
.to({
    to: address,
    amount: 1000n,
    token: { category: tokenCategory, amount: 100n }
})

// NFT
.to({
    to: address,
    amount: 1000n,
    token: {
        category: tokenCategory,
        nft: {
            capability: 'none',  // 'none', 'mutable', 'minting'
            commitment: Buffer.from('data')
        }
    }
})
```

## Debugging

```javascript
// Debug info
const debugInfo = await contract.functions.spend(sig).to(addr, amt).debug();

// Build without sending
const txHex = await contract.functions.spend(sig).to(addr, amt).build();

// BitAuth URI for visualization
const uri = await contract.functions.spend(sig).to(addr, amt).bitauthUri();
```

## P2S Support

Pay to Script (P2S) reduces tx size by 23-35 bytes vs P2SH. Standard in May 2026. Unlocking bytecode limit: 10,000 bytes.

```javascript
const contract = new Contract(artifact, args, {
    provider,
    addressType: 'p2s'
});
```

## Error Handling

| Error | Cause |
|-------|-------|
| Script failed | `require()` condition failed |
| Insufficient funds | Not enough BCH |
| Invalid signature | Wrong key or format |
| Network error | Connection issue |

```javascript
try {
    await contract.functions.spend(sig).to(addr, amt).send();
} catch (error) {
    if (error.message.includes('insufficient funds')) {
        // Handle insufficient balance
    } else if (error.message.includes('script failed')) {
        // Handle contract validation failure
    }
}
```
