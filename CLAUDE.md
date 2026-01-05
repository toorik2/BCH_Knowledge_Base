# CLAUDE.md - BCH Knowledge Base

## Project Overview

This is a **Bitcoin Cash (BCH) Knowledge Base** focused on **CashScript smart contracts**. It serves as a comprehensive reference for developers building on Bitcoin Cash, covering:

- CashScript language syntax and semantics
- UTXO-based smart contract architecture
- CashTokens (native fungible and non-fungible tokens)
- SDK usage for contract deployment and interaction
- Security best practices and vulnerability patterns
- Real-world production patterns (including ParityUSD, a 26-contract stablecoin system)
- Community FAQs extracted from BCH developer Telegram groups

## Critical Domain Knowledge

### The UTXO Mental Model

**This is NOT Ethereum.** Bitcoin Cash uses an Unspent Transaction Output (UTXO) model:

| Concept | Ethereum (Account) | Bitcoin Cash (UTXO) |
|---------|-------------------|---------------------|
| State | Global mutable state | State in UTXO outputs |
| Contracts | Execute actions | Validate transactions |
| Tokens | ERC-20 standard | Native CashTokens |
| Storage | Contract storage slots | NFT commitments (40 bytes, 128 in May 2026) |
| Identity | Address | Token category (32-byte hash) |

**Core principle**: A CashScript contract doesn't "do" anything—it only **validates** whether a proposed transaction meets its rules.

### Key CashScript Concepts

1. **Transactions are the unit of computation** - contracts validate UTXO transformations
2. **State lives in NFT commitments** - up to 40 bytes of mutable data per NFT (128 in May 2026)
3. **Token category = identity + authority** - `categoryId + 0x01` = mutable, `+ 0x02` = minting
4. **Contracts authenticate via tokenCategory** - not addresses or storage
5. **Input positions are pinned** - contracts enforce exact positions in transactions

## Repository Structure

```
BCH_Knowledge_Base/
├── concepts/              # Core architectural concepts (UTXO, multi-contract)
├── language/              # CashScript language reference
├── sdk/                   # JavaScript/TypeScript SDK documentation
├── examples/              # Production patterns and case studies
├── cashtokens/            # Token integration guide
├── best-practices/        # Security guidelines
├── reference/             # Quick API reference
├── faq/                   # 1,089 Q&As from 6 Telegram channels
│   ├── channels.json      # FAQ source metadata
│   └── telegram/*.json    # Extracted community FAQs
└── scripts/               # Content preparation tooling
```

## File Naming Conventions

- **Documentation**: `kebab-case.md` (e.g., `language-reference.md`)
- **FAQ JSON**: `snake_case_faq_YYYY.json` (e.g., `cashscript_faq_2025.json`)
- **Directories**: lowercase single words (e.g., `concepts/`, `language/`)

## Working With This Repository

### Adding Documentation

When adding or editing documentation:

1. Use clear heading hierarchy (H1 title, H2 sections, H3 subsections)
2. Include CashScript code examples with `cashscript` language tag
3. Include JavaScript SDK examples with `javascript` language tag
4. Use tables for quick reference comparisons
5. Document state byte layouts with explicit byte positions

### FAQ Data Structure

FAQ files follow this JSON schema:

```json
{
  "name": "Channel name",
  "type": "telegram_extraction",
  "source": "Source description",
  "extraction_date": "YYYY-MM-DD",
  "total_faqs": <number>,
  "categories": [
    {
      "name": "Category name",
      "faqs": [
        {"q": "Question text", "a": "Answer text"}
      ]
    }
  ]
}
```

### Content Preparation Pipeline

Run `npm run prepare-content` to transform the knowledge base for xAI Collections ingestion. This:
- Copies markdown files with flattened names to `prepared-content/docs/`
- Converts FAQ categories to individual markdown files in `prepared-content/faq/`

## Security-Critical Patterns

**When writing or reviewing CashScript code, ALWAYS verify:**

### The 5-Point Covenant Validation

Every self-replicating contract MUST validate:

```cashscript
require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode); // 1. Same code
require(tx.outputs[0].tokenCategory == tx.inputs[0].tokenCategory);     // 2. Same token
require(tx.outputs[0].value == expectedValue);                          // 3. BCH amount
require(tx.outputs[0].tokenAmount == expectedAmount);                   // 4. Token amount
require(tx.outputs[0].nftCommitment == newCommitment);                  // 5. State data
```

**Missing ANY of these creates critical vulnerabilities.**

### Output Count Limiting

EVERY function MUST limit outputs to prevent minting attacks:

```cashscript
require(tx.outputs.length <= 5);  // FIRST validation in every function
```

### Input Position Enforcement

Always validate contract positions:

```cashscript
require(this.activeInputIndex == 2);  // Pin own position
require(tx.inputs[0].tokenCategory == oracleCategory + 0x01);  // Authenticate others
```

### Minting Authority Protection

Minting NFTs (`+ 0x02`) can create unlimited tokens:
- Never release minting NFTs to user addresses
- Validate all outputs in transactions with minting contracts
- Downgrade to mutable (`+ 0x01`) when minting isn't needed

## Common Mistakes to Avoid

1. **Thinking in accounts** - There are no persistent storage slots; state is in UTXOs
2. **Forgetting output limits** - Attackers can add outputs to mint unauthorized tokens
3. **Missing covenant validations** - All 5 properties must be checked
4. **Trusting input positions** - Always verify tokenCategory at each position
5. **Using wrong number encoding** - CashScript uses Script Number format, not standard integers
6. **Ignoring byte layout documentation** - State must be packed/unpacked correctly

## Number Encoding Warning

CashScript integers use Bitcoin's Script Number encoding:
- Little-endian, variable-length
- Sign bit in MSB of last byte
- NOT standard 2's complement

Use `int(bytes)` for parsing, `bytesN(int)` for encoding. Always specify exact byte lengths.

## Key External Resources

- [CashScript Documentation](https://cashscript.org/docs/)
- [CashScript GitHub](https://github.com/CashScript/cashscript)
- [CashTokens Specification](https://cashtokens.org/docs/spec/)

## Build Commands

```bash
npm install              # Install dependencies
npm run prepare-content  # Prepare content for xAI Collections
```

## When Answering Questions About This Codebase

1. **For CashScript questions**: Reference `language/language-reference.md` and `concepts/`
2. **For SDK questions**: Reference `sdk/` directory
3. **For security questions**: Reference `best-practices/security/smart-contract-security.md`
4. **For patterns**: Reference `examples/` and `concepts/multi-contract-architecture.md`
5. **For practical Q&As**: Search the FAQ JSON files in `faq/telegram/`

Always ground answers in the UTXO model. If a question assumes Ethereum-style semantics, clarify the difference before answering.
