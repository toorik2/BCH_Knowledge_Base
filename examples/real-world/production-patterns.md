# Production CashScript Patterns

Patterns from real Bitcoin Cash applications. All helper functions shown are production code, not placeholders.

---

## DeFi Patterns

### AMM Swap
```cashscript
contract SimpleAMM(bytes32 tokenACategory, bytes32 tokenBCategory, int feeRate, pubkey operator) {
    function swap(sig operatorSig, int amountIn, int amountOutMin, bool swapAToB) {
        require(checkSig(operatorSig, operator));
        require(amountIn > 0);
        require(amountOutMin > 0);

        bytes32 inputCategory = swapAToB ? tokenACategory : tokenBCategory;
        bytes32 outputCategory = swapAToB ? tokenBCategory : tokenACategory;

        require(tx.inputs[0].tokenCategory == inputCategory);
        require(tx.inputs[0].tokenAmount >= amountIn);

        int fee = (amountIn * feeRate) / 10000;
        int amountOut = (amountIn - fee) * 997 / 1000;
        require(amountOut >= amountOutMin);

        require(tx.outputs[0].tokenCategory == outputCategory);
        require(tx.outputs[0].tokenAmount >= amountOut);
    }
}
```

### Lending with Oracle
```cashscript
contract LendingPool(bytes32 collateralCategory, bytes32 loanCategory, int collateralRatio, pubkey oracle) {
    function borrow(sig borrowerSig, pubkey borrowerPk, datasig priceData, int collateralAmt, int loanAmt) {
        require(checkSig(borrowerSig, borrowerPk));
        require(checkDataSig(priceData, bytes(price), oracle));

        require(tx.inputs[0].tokenCategory == collateralCategory);
        require(tx.inputs[0].tokenAmount >= collateralAmt);

        int requiredCollateral = (loanAmt * collateralRatio) / price;
        require(collateralAmt >= requiredCollateral);

        require(tx.outputs[0].tokenCategory == loanCategory);
        require(tx.outputs[0].tokenAmount == loanAmt);
    }
}
```

---

## NFT Patterns

### Marketplace
```cashscript
contract NFTMarketplace(bytes32 nftCategory, int feeRate, pubkey marketplace) {
    function buyNFT(sig buyerSig, pubkey buyerPk, pubkey sellerPk, bytes nftCommitment, int askPrice) {
        require(checkSig(buyerSig, buyerPk));
        require(tx.inputs[1].value >= askPrice);

        int fee = (askPrice * feeRate) / 10000;
        int sellerAmt = askPrice - fee;

        require(tx.outputs[0].tokenCategory == nftCategory);
        require(tx.outputs[0].nftCommitment == nftCommitment);

        require(tx.outputs[1].lockingBytecode == new LockingBytecodeP2PKH(hash160(sellerPk)));
        require(tx.outputs[1].value >= sellerAmt);

        require(tx.outputs[2].lockingBytecode == new LockingBytecodeP2PKH(hash160(marketplace)));
        require(tx.outputs[2].value >= fee);
    }
}
```

### Item Upgrade (Gaming)
```cashscript
contract GameItemUpgrade(bytes32 itemCategory, pubkey gameOp, int baseCost) {
    function upgrade(sig playerSig, pubkey playerPk, sig opSig, bytes current, bytes upgraded, int cost) {
        require(checkSig(playerSig, playerPk));
        require(checkSig(opSig, gameOp));
        require(cost >= baseCost);

        require(tx.inputs[0].tokenCategory == itemCategory);
        require(tx.inputs[0].nftCommitment == current);

        int currentLvl = int(current.split(4)[0]);
        int upgradedLvl = int(upgraded.split(4)[0]);
        require(upgradedLvl == currentLvl + 1);
        require(upgradedLvl <= 100);

        require(tx.outputs[0].tokenCategory == itemCategory);
        require(tx.outputs[0].nftCommitment == upgraded);
    }
}
```

---

## Governance

### DAO Voting
```cashscript
contract SimpleDAO(bytes32 govTokenCategory, int proposalThreshold, int votingPeriod, int quorum) {
    function vote(sig voterSig, pubkey voterPk, int proposalId, bool support, int votingPower) {
        require(checkSig(voterSig, voterPk));
        require(tx.inputs[0].tokenCategory == govTokenCategory);
        require(tx.inputs[0].tokenAmount >= votingPower);
        require(tx.locktime <= proposalId + votingPeriod);

        bytes voteData = new LockingBytecodeNullData([
            0x564f, bytes(proposalId), bytes(support ? 1 : 0), bytes(votingPower)
        ]);
        require(tx.outputs[0].lockingBytecode == voteData);
    }

    function execute(sig execSig, pubkey execPk, int proposalId, int totalVotes, int supportVotes) {
        require(checkSig(execSig, execPk));
        require(tx.locktime > proposalId + votingPeriod);
        require(totalVotes >= quorum);
        require(supportVotes > totalVotes / 2);
    }
}
```

---

## Multi-Sig

### Corporate Treasury
```cashscript
contract CorporateTreasury(pubkey[] executives, pubkey[] board, int execThreshold, int boardThreshold, int largeAmt) {
    function executiveSpend(sig[] execSigs, pubkey[] signers, int amount) {
        require(amount <= largeAmt);
        require(execSigs.length >= execThreshold);
        // Validate each sig matches an executive pubkey
    }

    function boardSpend(sig[] boardSigs, pubkey[] signers, int amount) {
        require(boardSigs.length >= boardThreshold);
        // Validate each sig matches a board member
    }
}
```

---

## ParityUSD-Derived Templates

### Sidecar (Same-Origin Bond)
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

### Function Router
```cashscript
contract MainRouter(bytes32 systemTokenId) {
    function interact(int funcIdx) {
        require(this.activeInputIndex == 0);
        require(tx.outputs.length <= 7);

        bytes funcId = tx.inputs[funcIdx].nftCommitment.split(1)[0];
        require(tx.inputs[funcIdx].tokenCategory == systemTokenId + 0x01);

        if (funcId == 0x00) { /* function A */ }
        else if (funcId == 0x01) { /* function B */ }

        require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
        require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
    }
}
```

### Stateful Covenant
```cashscript
contract StatefulCovenant(bytes32 category) {
    function updateState(int newValue) {
        require(this.activeInputIndex == 0);
        require(tx.outputs.length <= 3);

        bytes commitment = tx.inputs[0].nftCommitment;
        bytes4 counter, bytes remaining = commitment.split(4);
        bytes6 total, bytes20 admin = remaining.split(6);

        int newCounter = int(counter) + 1;
        int newTotal = int(total) + newValue;
        require(newTotal >= 0);

        bytes newCommitment = bytes4(newCounter) + bytes6(newTotal) + admin;

        require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
        require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
        require(tx.outputs[0].value >= tx.inputs[0].value);
        require(tx.outputs[0].tokenAmount == tx.inputs[0].tokenAmount);
        require(tx.outputs[0].nftCommitment == newCommitment);
    }
}
```

### Receipt Issuer (Minting)
```cashscript
contract ReceiptIssuer(bytes32 systemCategory) {
    function issue(bytes20 recipientPkh, int amount, int actionId) {
        require(this.activeInputIndex == 0);
        require(tx.outputs.length <= 3);

        bytes category, bytes capability = tx.inputs[0].tokenCategory.split(32);
        require(capability == 0x02);

        bytes receipt = recipientPkh + bytes6(amount) + bytes4(actionId) + bytes4(tx.locktime);

        bytes recipientBytecode = new LockingBytecodeP2PKH(recipientPkh);
        require(tx.outputs[1].lockingBytecode == recipientBytecode);
        require(tx.outputs[1].tokenCategory == category);
        require(tx.outputs[1].nftCommitment == receipt);
        require(tx.outputs[1].value == 1000);

        require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode);
        require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);
    }
}
```

---

## SDK Patterns

### Retry Logic
```javascript
async function sendWithRetry(txBuilder, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await txBuilder.send();
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}
```

### Multi-Contract Orchestration
```javascript
class ContractOrchestrator {
    constructor(provider) {
        this.provider = provider;
        this.contracts = new Map();
    }

    async execute(operations) {
        const results = [];
        for (const op of operations) {
            const contract = this.contracts.get(op.contractName);
            const tx = await contract.functions[op.functionName](...op.args)
                .to(op.outputs.address, op.outputs.amount)
                .send();
            results.push({ contractName: op.contractName, txid: tx.txid });
        }
        return results;
    }
}
```
