# CashScript SDK: Transaction Building

## Overview

The CashScript SDK consists of 4 classes that form one cohesive structure to build BCH smart contract applications: the `Contract` class, the `TransactionBuilder` class, the `NetworkProvider` class, and the `SignatureTemplate` class.

The typical SDK flow is: compile an artifact with `cashc`, instantiate a `NetworkProvider`, provide it to instantiate a `Contract` from the artifact, then use `contract.unlock` to create unlockers for the `TransactionBuilder`. During transaction building, use `SignatureTemplate` to generate signatures.

```javascript
import { Contract, ElectrumNetworkProvider, TransactionBuilder, SignatureTemplate } from 'cashscript';
import artifact from './contract.json' with { type: 'json' };

const provider = new ElectrumNetworkProvider('chipnet');
const contract = new Contract(artifact, constructorArgs, { provider });

const sigTemplate = new SignatureTemplate(aliceWif);
const unlocker = contract.unlock.transfer(sigTemplate);

const txDetails = await new TransactionBuilder({ provider })
    .addInput(utxo, unlocker)
    .addOutput({ to: address, amount: amount })
    .send();
```

> **Note**: The old `contract.functions` simple transaction builder was deprecated in v0.12.0 and removed in v0.13.0. Use `TransactionBuilder` with `contract.unlock` instead.

### Pay to Script (P2S) Support

Bitcoin Cash supports Pay to Script (P2S) outputs, allowing direct script usage without hashing overhead. P2S becomes standard in the May 2026 upgrade and reduces transaction size by 23-35 bytes per output compared to P2SH. The unlocking bytecode limit unifies to 10,000 bytes in May 2026, enabling complex contract logic.

## Instantiating a TransactionBuilder

```typescript
new TransactionBuilder(options: TransactionBuilderOptions)
```

To start, instantiate a transaction builder and pass in a `NetworkProvider` instance and other options.

```typescript
interface TransactionBuilderOptions {
    provider: NetworkProvider;
    maximumFeeSatoshis?: bigint;
    maximumFeeSatsPerByte?: number;
    allowImplicitFungibleTokenBurn?: boolean;
}
```

The `maximumFeeSatoshis` and `maximumFeeSatsPerByte` options act as safety checks — an error is thrown when building the transaction if the fee exceeds the configured limit. The `allowImplicitFungibleTokenBurn` option (default: `false`) controls whether the builder throws when fungible tokens in the inputs are not accounted for in the outputs.

## Basic Transaction Building

### Simple Transfer

```javascript
const provider = new ElectrumNetworkProvider('mainnet');
const contract = new Contract(artifact, constructorArgs, { provider });
const sigTemplate = new SignatureTemplate(privateKey);

const contractUtxos = await contract.getUtxos();
const contractUtxo = contractUtxos[0];

const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: 'bitcoincash:qr7gmtgmvsdtuwcskladnsrqrzf24td68qxg9rsqca', amount: 100000n })
    .send();

console.log('Transaction ID:', txDetails.txid);
```

### Multi-Output Transaction

```javascript
const contractUtxos = await contract.getUtxos();
const contractUtxo = contractUtxos[0];

const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: 'bitcoincash:qr7gmtgmvsdtuwcskladnsrqrzf24td68qxg9rsqca', amount: 50000n })
    .addOutput({ to: 'bitcoincash:qrhea03074073ff3zv9whh0nggxc7k03ssh8jv9mkx', amount: 30000n })
    .send();
```

## P2PKH Input Integration

```javascript
const aliceUtxos = await provider.getUtxos(aliceAddress);
const aliceUtxo = aliceUtxos[0];
const aliceTemplate = new SignatureTemplate(alicePrivateKey);
const contractUtxos = await contract.getUtxos();
const contractUtxo = contractUtxos[0];

const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(contractSig))
    .addInput(aliceUtxo, aliceTemplate.unlockP2PKH())
    .addOutput({ to: bobAddress, amount: 100000n })
    .send();
```

## OP_RETURN Data

```javascript
const contractUtxos = await contract.getUtxos();
const contractUtxo = contractUtxos[0];

// Simple OP_RETURN
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .addOpReturnOutput(['Hello, Bitcoin Cash!'])
    .send();

// Protocol-specific OP_RETURN (hex-prefixed strings treated as hex)
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .addOpReturnOutput(['0x6d02', 'memo.cash message'])
    .send();
```

## CashTokens Integration

Bitcoin Cash supports CashTokens for fungible and non-fungible token functionality. Token commitments are currently max 40 bytes (128 bytes in May 2026 upgrade).

### Fungible Token Outputs

```javascript
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({
        to: address,
        amount: 1000n,
        token: {
            category: tokenCategory,
            amount: 100n
        }
    })
    .send();
```

### NFT Outputs

```javascript
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({
        to: address,
        amount: 1000n,
        token: {
            category: tokenCategory,
            amount: 0n,
            nft: {
                capability: 'none',
                commitment: 'unique-data-hex'
            }
        }
    })
    .send();
```

## Time Constraints

### Absolute Time Locks

```javascript
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .setLocktime(1640995200)  // Unix timestamp
    .send();
```

## Transaction Debugging

### Debug Mode

```javascript
const txBuilder = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount });

// Debug locally (returns intermediate values and results)
const debugResult = txBuilder.debug();

// Get VM resource usage
const vmUsage = txBuilder.getVmResourceUsage(true); // verbose output
```

### BitAuth URI

```javascript
const txBuilder = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount });

const uri = txBuilder.getBitauthUri();
console.log('Debug URI:', uri);
```

### Build Without Broadcasting

```javascript
// build() is synchronous and returns the hex string
const txHex = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .build();

console.log('Transaction hex:', txHex);
```

## Error Handling

### Transaction Errors

```javascript
try {
    const txDetails = await new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
        .addOutput({ to: address, amount: amount })
        .send();
} catch (error) {
    // FailedTransactionError includes a BitAuth URI for debugging
    console.error('Transaction error:', error.message);
}
```

## Complete Examples

### Escrow Contract Transaction

```javascript
import { Contract, ElectrumNetworkProvider, TransactionBuilder, SignatureTemplate } from 'cashscript';

const provider = new ElectrumNetworkProvider('mainnet');
const escrowContract = new Contract(escrowArtifact, [
    buyerPubkey,
    sellerPubkey,
    arbiterPubkey,
    escrowAmount
], { provider });

const buyerSig = new SignatureTemplate(buyerPrivateKey);
const sellerSig = new SignatureTemplate(sellerPrivateKey);

const escrowUtxos = await escrowContract.getUtxos();
const escrowUtxo = escrowUtxos[0];

const txDetails = await new TransactionBuilder({ provider })
    .addInput(escrowUtxo, escrowContract.unlock.complete(buyerSig, sellerSig))
    .addOutput({ to: sellerAddress, amount: escrowAmount })
    .send();
```

### Complex Multi-Input Transaction

```javascript
const provider = new ElectrumNetworkProvider('mainnet');

const contractUtxos = await contract.getUtxos();
const userUtxos = await provider.getUtxos(userAddress);
const userUtxo = userUtxos[0];

const userSig = new SignatureTemplate(userPrivateKey);
const contractSig = new SignatureTemplate(contractPrivateKey);

const txDetails = await new TransactionBuilder({ provider, maximumFeeSatsPerByte: 2.0 })
    .addInput(contractUtxos[0], contract.unlock.spend(contractSig))
    .addInput(contractUtxos[1], contract.unlock.spend(contractSig))
    .addInput(userUtxo, userSig.unlockP2PKH())
    .addOutput({ to: recipientAddress, amount: 100000n })
    .addOutput({ to: changeAddress, amount: 50000n })
    .send();
```

### Multiple Inputs with Shared Unlocker

```javascript
const contractUtxos = await contract.getUtxos();
const unlocker = contract.unlock.spend(sigTemplate);

const txDetails = await new TransactionBuilder({ provider })
    .addInputs(contractUtxos, unlocker)  // Share unlocker across all inputs
    .addOutput({ to: recipientAddress, amount: 100000n })
    .send();
```

## Best Practices

### 1. Fee Safety

```javascript
// Set a maximum fee rate to prevent accidental overpayment
const txDetails = await new TransactionBuilder({ provider, maximumFeeSatsPerByte: 2.0 })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .send();
```

### 2. Input Validation

```javascript
// Validate inputs before transaction
const balance = await contract.getBalance();
const requiredAmount = amount + estimatedFee;

if (balance < requiredAmount) {
    throw new Error('Insufficient contract balance');
}
```

### 3. Error Recovery

```javascript
async function sendTransactionWithRetry(txBuilder, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await txBuilder.send();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            console.log(`Attempt ${i + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
```

### 4. Transaction Monitoring

```javascript
async function monitorTransaction(txid) {
    const provider = new ElectrumNetworkProvider('mainnet');

    while (true) {
        try {
            const rawTx = await provider.getRawTransaction(txid);
            if (rawTx) {
                console.log('Transaction found on network');
                break;
            }
        } catch (error) {
            console.log('Transaction not found, waiting...');
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
    }
}
```

## TransactionDetails

The `send()` method returns a `TransactionDetails` object:

```typescript
interface TransactionDetails {
    inputs: Uint8Array[];
    locktime: number;
    outputs: Uint8Array[];
    version: number;
    txid: string;
    hex: string;
}
```

## Transaction Analysis

### Fee Calculation

The transaction fee is the difference between total input satoshis and total output satoshis. You can calculate it from the `TransactionBuilder` before or after building:

```javascript
import { encodeTransaction } from '@bitauth/libauth';

const txBuilder = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount });

// Calculate fee from inputs and outputs
const totalInputAmount = txBuilder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
const totalOutputAmount = txBuilder.outputs.reduce((sum, output) => sum + output.amount, 0n);
const feeSats = totalInputAmount - totalOutputAmount;

// Calculate fee rate from the built transaction
const libauthTx = txBuilder.buildLibauthTransaction();
const txSizeBytes = encodeTransaction(libauthTx).byteLength;
const feeRate = Number(feeSats) / txSizeBytes;

console.log(`Fee: ${feeSats} sats (${feeRate.toFixed(2)} sats/byte, ${txSizeBytes} bytes)`);
```

### Input/Output Analysis

```javascript
const txDetails = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.spend(sigTemplate))
    .addOutput({ to: address, amount: amount })
    .send();

console.log('Transaction Analysis:');
console.log('- TXID:', txDetails.txid);
console.log('- Inputs:', txDetails.inputs.length);
console.log('- Outputs:', txDetails.outputs.length);
console.log('- Hex:', txDetails.hex);
```
