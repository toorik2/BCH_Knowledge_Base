# CashScript Quick Reference

## Contract Structure
```cashscript
pragma cashscript ^0.12.1;
contract Name(pubkey owner, bytes32 category) {
    function spend(sig s, int amt) { require(checkSig(s, owner)); }
}
```

## Types
| Type | Example |
|------|---------|
| `bool` | `true`, `false` |
| `int` | `42`, `-100`, `1_000_000` |
| `bytes` | `0x1234abcd` |
| `bytesN` | `bytes4`, `bytes20`, `bytes32` |
| `pubkey` | 33-byte compressed key |
| `sig` | Tx signature |
| `datasig` | Data signature |

## Operators
| Op | Types |
|----|-------|
| `+ - * / %` | `int` |
| `< <= > >= == !=` | all |
| `! && \|\|` | `bool` (no short-circuit) |
| `& \| ^` | `bytes` only |

## Built-ins
| Function | Returns |
|----------|---------|
| `abs/min/max(int)` | `int` |
| `within(x, lo, hi)` | `bool` (`lo <= x < hi`) |
| `sha256/hash256(bytes)` | `bytes32` |
| `hash160(bytes)` | `bytes20` |
| `checkSig(sig, pubkey)` | `bool` |
| `checkDataSig(dsig, msg, pk)` | `bool` |

## Introspection
```cashscript
tx.inputs[i].value / .lockingBytecode / .tokenCategory / .tokenAmount / .nftCommitment
tx.outputs[i].value / .lockingBytecode / .tokenCategory / .tokenAmount / .nftCommitment
tx.inputs[i].outpointTransactionHash / .outpointIndex
this.activeInputIndex / this.activeBytecode
tx.time / tx.locktime / this.age
```

## Bytecode Constructors
```cashscript
new LockingBytecodeP2PKH(bytes20)
new LockingBytecodeP2SH32(bytes32)
new LockingBytecodeNullData(bytes[])
```

## Units
`sats=1`, `bits=100`, `bitcoin=100_000_000`
`seconds=1`, `minutes=60`, `hours=3600`, `days=86400`

## SDK Quick Start
```javascript
import { Contract, ElectrumNetworkProvider, SignatureTemplate } from 'cashscript';
import { compileFile } from 'cashc';

const artifact = compileFile('contract.cash');
const provider = new ElectrumNetworkProvider('mainnet');
const contract = new Contract(artifact, [constructorArgs], { provider });

const tx = await contract.functions
    .spend(new SignatureTemplate(privateKey))
    .to(address, 10000n)
    .send();
```

## 5-Point Covenant (ALWAYS validate all 5)
```cashscript
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
require(tx.outputs[0].value == expectedValue);
require(tx.outputs[0].tokenAmount == expectedAmount);
require(tx.outputs[0].nftCommitment == newCommitment);
```

## Token Categories
```cashscript
categoryId + 0x01  // mutable NFT
categoryId + 0x02  // minting NFT
categoryId         // immutable NFT
```

## Common Patterns
```cashscript
// Output limit (FIRST LINE)
require(tx.outputs.length <= 5);

// Position validation
require(this.activeInputIndex == 0);

// Time lock
require(tx.time >= lockTime);

// Same-origin (sidecar)
require(tx.inputs[i].outpointTransactionHash == tx.inputs[j].outpointTransactionHash);

// State from commitment
bytes4 counter, bytes remaining = tx.inputs[0].nftCommitment.split(4);
```
