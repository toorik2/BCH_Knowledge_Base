# CashScript SDK: Contract Instantiation

## Installation

```bash
npm install cashscript  # SDK
npm install -g cashc    # Compiler
```

## Compilation

```javascript
import { compileFile, compileString } from 'cashc';

const artifact = compileFile('contract.cash');
// OR
const artifact = compileString(contractCode);
// OR
import artifact from './contract.json' with { type: 'json' };
```

## Instantiation

```javascript
import { Contract, ElectrumNetworkProvider } from 'cashscript';

const provider = new ElectrumNetworkProvider('mainnet'); // or 'chipnet'
const contract = new Contract(artifact, constructorArgs, { provider });

// With address type
const contract = new Contract(artifact, args, {
    provider,
    addressType: 'p2sh32'  // 'p2sh32' (default), 'p2sh20', or 'p2s'
});
```

**Address Types**:
- `p2sh32`: SHA-256 hash (default, most secure)
- `p2sh20`: RIPEMD-160 hash (legacy)
- `p2s`: Pay to Script direct (efficient, standard in May 2026)

## Properties

```javascript
contract.address      // Contract address
contract.bytecode     // Compiled bytecode
contract.bytesize     // Bytecode size
contract.functions    // Available functions

await contract.getBalance()  // BCH balance in satoshis
await contract.getUtxos()    // Array of UTXOs
```

## Network Providers

```javascript
// Mainnet
new ElectrumNetworkProvider('mainnet')

// Testnet
new ElectrumNetworkProvider('chipnet')

// Custom server
new ElectrumNetworkProvider('mainnet', 'fulcrum.example.com')
```

## CLI Compilation

```bash
cashc contract.cash              # Output JSON artifact
cashc --format ts contract.cash  # Output TypeScript
cashc --output out.json contract.cash
cashc --version
```
