# Multi-Contract Deployment Patterns

**Complex protocols require coordinated contract deployment**:

```cashscript
// CONTRACT 1: Manager (creates campaigns)
contract Manager() {
    function initialize() {
        // Hardcode target contract address at compile time
        require(tx.outputs[1].lockingBytecode ==
            new LockingBytecodeP2SH32(0xe3cab0f5a4aa3b8898d4708dbfa3b4126a723d5d982ac4c2691e33841fa8371f));
    }
}

// CONTRACT 2: Main (holds campaigns)
contract Main() {
    function externalFunction() {
        require(this.activeInputIndex == 1);  // I am input 1
        require(tx.inputs[0].tokenCategory == masterCategory + 0x02);  // Trust input 0
    }
}

// CONTRACT 3-N: Helpers (cancel, claim, refund, stop)
contract Helper() {
    function action() {
        // Each helper has its OWN masterNFT
        require(tx.inputs[0].nftCommitment.split(35)[1] == 0xFFFFFFFFFF);  // Sentinel ID
        // Main contract NFT is input 1
        require(tx.inputs[1].tokenCategory == masterCategory + 0x02);
    }
}
```

## Distributed masterNFT Pattern

- Each contract in system gets ONE masterNFT with sentinel ID (0xFFFFFFFFFF)
- MasterNFTs stay in their respective contracts forever
- Contracts identify each other by shared token category
- Sentinel value distinguishes master from data NFTs

## Deployment Checklist

1. Deploy all contracts (get P2SH32 addresses)
2. Hardcode addresses in source where needed
3. Recompile with addresses
4. Create token category (genesis transaction)
5. Mint masterNFTs for each contract
6. Send masterNFTs to their contracts

**CRITICAL**: Contracts are immutable after deployment. All inter-contract addresses must be correct at compile time.
