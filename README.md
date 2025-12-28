# BCH Knowledge Base

A comprehensive reference for CashScript smart contracts and Bitcoin Cash development, including language fundamentals, SDK usage, CashTokens integration, and curated FAQs from BCH developer communities.

## Structure

```
BCH_Knowledge_Base/
├── concepts/                    # Core concepts
│   ├── utxo-vs-account-model.md       # EVM to CashScript translation
│   ├── multi-contract-architecture.md # Multi-contract patterns
│   └── cashscript-mental-model.md     # Design philosophy
├── language/
│   └── language-reference.md          # Comprehensive CashScript reference
├── sdk/
│   ├── contracts/
│   │   └── contract-instantiation.md  # Contract setup and instantiation
│   └── transactions/
│       └── transaction-building.md    # Transaction construction
├── examples/
│   └── real-world/
│       ├── production-patterns.md     # Battle-tested patterns
│       └── parityusd-analysis.md      # 26-contract stablecoin analysis
├── cashtokens/
│   └── overview.md                    # CashTokens integration
├── best-practices/
│   └── security/
│       └── smart-contract-security.md # Security guidelines
├── reference/
│   └── quick-reference.md             # API quick reference
└── faq/                               # Community FAQs
    ├── channels.json                  # FAQ source metadata
    └── telegram/                      # Extracted from Telegram groups
        ├── electron_cash_faq_2025.json    # 327 FAQs, 11 categories
        ├── bch_devs_faq_2025.json         # 305 FAQs, 11 categories
        ├── bchn_faq_2025.json             # 222 FAQs, 9 categories
        ├── cashscript_faq_2025.json       # 120 FAQs, 13 categories
        ├── cashtoken_devs_faq_2025.json   # 81 FAQs, 9 categories
        └── bch_compilers_faq_2025.json    # 34 FAQs, 5 categories
```

## Contents

### Documentation (12 markdown files)

| Section | Files | Description |
|---------|-------|-------------|
| Concepts | 3 | UTXO model, multi-contract architecture, CashScript mental model |
| Language | 1 | Complete CashScript language reference |
| SDK | 2 | Contract instantiation, transaction building |
| Examples | 2 | Production patterns, ParityUSD case study |
| CashTokens | 1 | Token integration overview |
| Best Practices | 1 | Smart contract security |
| Reference | 1 | Quick API reference |

### FAQ Collection (1,089 Q&As from 6 channels)

Curated technical Q&As extracted from BCH developer Telegram groups:

| Channel | FAQs | Categories |
|---------|------|------------|
| Electron Cash | 327 | 11 |
| BCH Devs & Builders | 305 | 11 |
| BCHN | 222 | 9 |
| CashScript | 120 | 13 |
| CashToken Devs | 81 | 9 |
| BCH Compilers | 34 | 5 |

## Key Resources

- [CashScript Documentation](https://cashscript.org/docs/)
- [CashScript GitHub](https://github.com/CashScript/cashscript)
- [CashTokens Specification](https://cashtokens.org/docs/spec/)

## Tools

- **Compiler**: `cashc` - Compiles `.cash` files to artifacts
- **SDK**: `cashscript` - JavaScript/TypeScript SDK
- **Networks**: Mainnet, Chipnet (testnet)
- **Wallets**: Electron Cash, Paytaca, Cashonize

---

*Last updated: 2025-12-28*
