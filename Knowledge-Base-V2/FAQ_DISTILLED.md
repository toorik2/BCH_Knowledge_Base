# CashScript FAQ: Essential Developer Knowledge

**Curated community wisdom from BCH developer channels. ~160 essential Q&As.**

---

## Troubleshooting: Common Errors

### "Locktime requirement not satisfied"
**Q**: What does this error mean?

**A**: The transaction has a locktime that hasn't been reached yet. If using `tx.time` checks in your contract, you need to set the locktime with `txb.setLocktime()` to match your contract's requirements. Tip: Try `setLocktime(0)` first to isolate the issue.

---

### "bad-txns-nonfinal, non-final transaction"
**Q**: Why do I get this error?

**A**: You set a blockheight as locktime which has not been reached yet. The transaction cannot be mined until the locktime is met. Check your `setLocktime()` value and ensure the blockchain has passed that time/block.

---

### Locktime fails even though time has passed
**Q**: Why does my locktime transaction fail even though the time has passed?

**A**: The blockchain uses "median time past" - a trailing measure because it's decentralized. When using `tx.time` with seconds-based locktime, you may need to wait longer than expected. The blockchain time can lag behind real-world time.

---

### "missing inputs"
**Q**: What does "missing inputs" error mean?

**A**: Your transaction is missing one or more inputs. Check that you're correctly using `transactionBuilder.addInput(someUtxo, someUnlocker)`. Try `console.log(someUtxo)` before adding it to verify your UTXO data is correct.

---

### "Script evaluated without error but finished with false/empty top stack element"
**Q**: Why do I get this error?

**A**: This is related to your contract logic, not the compiler. Ensure you're using matching versions of cashc and cashscript SDK (v0.11+ recommended). Use `.debug()` to step through your contract logic in Bitauth IDE.

---

### High transaction fee errors
**Q**: How do I debug high fee errors?

**A**: Add logging before sending:
```javascript
const totalInputAmount = transactionBuilder.inputs.reduce(
    (acc, input) => acc + BigInt(input.valueSatoshis), 0n
);
const totalOutputAmount = transactionBuilder.outputs.reduce(
    (acc, output) => acc + BigInt(output.valueSatoshis), 0n
);
const txFeeSats = totalInputAmount - totalOutputAmount;
```
High fee errors usually mean you're failing to account for some value in the inputs.

---

## SDK Gotchas

### TransactionBuilder.addOutput() format
**Q**: What is the correct format for `addOutput()`?

**A**: Use an object parameter:
```javascript
txb.addOutput({ to: address, amount: bigintValue });
```
Don't pass separate arguments. See cashscript.org/docs/sdk/transaction-builder#addoutput

---

### Compiler/SDK version matching
**Q**: Do I need to match cashc version with SDK version?

**A**: Yes. To properly use debug tooling, cashc v0.11 outputs additional data in the artifact. If you're on cashc v0.8 but cashscript v0.11, debugging tooling won't work as well. Both should be on the same major version.

---

### TypeScript recommended
**Q**: Should I use TypeScript with CashScript?

**A**: Yes, strongly recommended. CashScript is a TypeScript library with full type checking. Many errors difficult to debug in JavaScript are caught immediately by TypeScript. Compile artifacts in .ts format using `cashc --ts`.

---

### txb.build() is not async
**Q**: Is `txb.build()` async?

**A**: No, `txb.build()` is not async. You don't need to await it.

---

### Creating CashTokens with SDK
**Q**: How do I create CashTokens using the SDK?

**A**: Use the advanced transaction builder with the `token` parameter:
```javascript
const txDetails = await contract.functions
    .transfer(sigTemplate)
    .to({
        to: contract.tokenAddress,
        amount: 1000n,
        token: {
            amount: 100n,
            category: contractUtxos[0].txid
        }
    })
    .send();
```

---

### Console.log introspection values
**Q**: Why can't I console.log tx introspection values?

**A**: You can only log variables, not introspection statements. Assign the introspection value to a variable first, then log the variable.

---

## Language Clarifications

### Locktime: block number vs timestamp
**Q**: How does locktime work?

**A**: Values less than 500,000,000 are interpreted as block numbers. Values 500,000,000 or higher are interpreted as Unix timestamps. Set via `txBuilder.setLocktime()`, check in contract via `tx.time`.

---

### split() vs slice()
**Q**: How do I get only part of a bytes value without using split's tuple?

**A**: Use `.slice(start, end)` instead of `.split()` if you don't need the second part:
```cashscript
commitment.slice(0, 5)  // First 5 bytes, no tuple
```

---

### Tuple destructuring
**Q**: Why can't I assign a tuple to already declared variables?

**A**: Tuple destructuring must happen when declaring variables. You cannot assign a tuple to already declared variables. Structure your code to declare variables at the point of splitting.

---

### No global constants (yet)
**Q**: Does CashScript support global constants?

**A**: Currently, constants can only be defined within functions and get put on the stack. Global constants that inline at compile time are planned (GitHub issue #80).

---

### Variable-length data in bytestring
**Q**: How can multiple variable-sized items be stored in a single bytestring?

**A**: Use length-prefixed encoding:
```cashscript
bytes1(data.length) + bytes(data) + bytes1(data2.length) + bytes(data2)
```
This is essentially "compiled OP_PUSH" - manually implementing what a push opcode does.

---

### this.activeBytecode vs unlockingBytecode
**Q**: What's the difference between `this.activeBytecode` and `tx.inputs[i].unlockingBytecode`?

**A**:
- `tx.inputs[i].unlockingBytecode` = scriptSig of a specific input
- `this.activeBytecode` = contract bytecode of the input being evaluated (does NOT contain unlocking arguments)

---

### tx.time type
**Q**: What is the type of `tx.time`?

**A**: `tx.time` is an int (bigint). To convert to bytes for NFT commitment, use casting. Note: `tx.time` represents the locktime value set in the transaction via `txBuilder.setLocktime()`.

---

### Loops
**Q**: Does CashScript support loops?

**A**: Yes, CashScript @next version has `do-while` loops. Install `cashc@next` to use them. The syntax is documented at next.cashscript.org/docs/language/contracts#loops-beta. Native loop opcodes (OP_BEGIN/OP_UNTIL) are part of May 2026 upgrade.

---

### Reusable functions
**Q**: Does CashScript support reusable functions?

**A**: Not yet. CashScript "functions" are spending conditions, not reusable code blocks. Reusable functions with typed inputs/outputs are planned but require significant development work.

---

## CashTokens Specifics

### Leaving out token = burning
**Q**: What happens if I leave out a token from a transaction output?

**A**: Leaving out a token burns it. If you have tokens in an input and don't include them in an output, they are permanently destroyed.

---

### Checking NFT capability
**Q**: How can I check if a token is an NFT and what its capability is?

**A**: The capability is the 33rd byte of tokenCategory:
- `0x` (empty) = no NFT
- `0x00` = immutable NFT
- `0x01` = mutable NFT
- `0x02` = minting NFT

Check `tx.inputs[i].tokenCategory.length > 32` to verify it's an NFT.

---

### Token category endianness
**Q**: Why doesn't my token category match between contract and explorer?

**A**: CashScript uses little endianness, explorers display big endianness. You need to reverse the byte order when comparing.

---

### Common token category mistakes
**Q**: What are common mistakes with token categories?

**A**: Two issues:
1. Script uses different endianness from explorers - may need to reverse bytes
2. `.tokenCategory` appends capability byte to the 32-byte tokenId, making it 33 bytes for NFTs

---

### Merging NFTs
**Q**: How can I merge NFTs in a contract?

**A**: Burn input NFTs by not including them in outputs, then create a new one. Pattern: "burn N and create 1" - require specific input categories and ensure they're not in outputs while outputting a new NFT with merged properties.

---

### ERC20 to CashTokens mapping
**Q**: How do ERC20 tokens map to BCH?

**A**: Basic fungible functionality (create, transfer, query) uses native CashTokens - no contracts needed. For advanced features (custom supply, hooks, restrictions), create a CashScript wrapper. Key insight: basic ERC20 = native CashTokens; extended ERC20 = CashScript + CashTokens.

---

## State Management

### Simulated state is antipattern
**Q**: What is the best way to manage contract state?

**A**: Simulated state (modifying constructor arguments) is now considered an antipattern. Store contract state externally in an NFT commitment. This keeps the contract address stable while allowing state changes.

---

### No global state
**Q**: Can I store data in a CashScript contract like Solidity?

**A**: BCH does not have global state. Create a CashToken NFT and store data in its commitment (40 bytes now, 128 bytes May 2026). Your contract introspects this local transferrable state.

---

### Why no global state?
**Q**: Why doesn't BCH have global state like Ethereum?

**A**: It's an advantage - global state is bad for scalability. BCH uses UTXO model where state is carried with tokens. You can achieve similar functionality with slightly different patterns.

---

## Architecture Decisions

### Why use contracts vs server?
**Q**: Why use CashScript smart contracts instead of a JavaScript server?

**A**: Smart contracts hold funds trustlessly - even the creator cannot access them. With a server, you control a key and can change code anytime. Contracts commit to constraints that cannot be changed. "Code as law."

---

### Multi-contract mental model
**Q**: What's a good mental model for multi-contract systems?

**A**: Three patterns:
1. Different contracts with unique tokenIds and own state (e.g., borrowing + pool)
2. Sidecar contracts holding different tokens from main contract
3. Function contracts attached to main verifier (separate add/withdraw/liquidate)

---

### Contract size limits
**Q**: What is the current contract size limit?

**A**: Since May 2025, the 520-byte stack element limit increased to 10,000 bytes. The 201-opcode limit was replaced by an operation cost system. Consensus limits are much more generous now.

---

### Factory bytecode mismatch
**Q**: Why does my factory contract produce different bytecode than `new Contract()`?

**A**: CashScript performs bytecode optimization. The artifact's `debug.bytecode` is unoptimized (for Bitauth IDE), while actual bytecode is optimized. Use the CashScript-compiled (optimized) bytecode as factory parameter.

---

### Getting contract address inside contract
**Q**: How do I get the contract address inside a CashScript function?

**A**: Use `tx.inputs[this.activeInputIndex].lockingBytecode` for the P2SH locking bytecode (closest to "address"). `this.activeBytecode` gets the contract's bytecode including constructor args.

---

## Debugging

### Bitauth IDE integration
**Q**: How can I see line-by-line mapping of CashScript to opcodes?

**A**: Use `const uri = await transactionBuilder.getBitauthUri();`. This opens Bitauth IDE with CashScript source, compiled opcodes, and execution results.

---

### Mocknet and upgrades
**Q**: Does mocknet support upcoming BCH VM upgrades?

**A**: Yes, mocknet allows configuring which VM is used. CashScript @next has BCH 2026 as default mocknet, allowing testing new opcodes before mainnet activation.

---

### Dev vs prod bytecode
**Q**: Is there a difference between dev and prod bytecode?

**A**: As of v0.11.0, the sourcemap and debug info work with optimized bytecode. Your contracts are exactly the same in dev as in prod.

---

### Testing multiple contracts
**Q**: Can I test multiple contracts in a single transaction?

**A**: Yes, the CashScript playground supports combining multiple contracts in one transaction with debugging. Preview at cashscript-playground-git-multi-contract-lahana.vercel.app

---

## WalletConnect

### Built-in support
**Q**: Does CashScript have WalletConnect support?

**A**: Yes, CashScript v0.11.1 adds BCH WalletConnect integration. TransactionBuilder has a method to generate a WalletConnect transaction object for signing.

---

### Debugging with WalletConnect
**Q**: How do I debug when using WalletConnect?

**A**: The transactionBuilder has placeholders, so `.debug()` won't work directly. Replace placeholders with a test wallet using SignatureTemplate with a private key (WIF format), then all debugging works.

---

### Datasig limitations
**Q**: What are the limitations of datasigs with WalletConnect?

**A**: Works well for standard signatures, but datasigs are problematic: using a hash placeholder means wallets blindly sign that hash (security issue), and without a hash, data length isn't deterministic.

---

## Ecosystem & Versions

### May 2025 upgrade (ACTIVE)
**Q**: What features came with the May 2025 BCH upgrade?

**A**: VM Limits removal and BigInt support, allowing more complex contracts. Stack element limit increased to 10,000 bytes.

---

### May 2026 upgrade (UPCOMING)
**Q**: What's coming in May 2026?

**A**: Native loops (OP_BEGIN/OP_UNTIL), 128-byte NFT commitments (up from 40 bytes), and P2S standard.

---

### Learning resources
**Q**: How do I learn CashScript?

**A**:
- Official docs: cashscript.org
- Video tutorials: youtube.com/watch?v=Ft2jo9spIHg
- Interactive challenges: arena.layer1.cash
- Telegram: t.me/CashScript

---

### Reference implementations
**Q**: Where can I find advanced open-source contracts?

**A**: ParityUSD open-sourced 26 contracts forming one of the most advanced BCH applications. See parityusd.com/blog/open-source-contracts

---

## Quick Reference Links

- **Core Language Reference**: See `CORE_REFERENCE.md`
- **Security & Architecture**: See `SECURITY_ARCHITECTURE.md`
- **CashScript Docs**: cashscript.org/docs/
- **Playground**: playground.cashscript.org
- **Telegram**: t.me/CashScript
