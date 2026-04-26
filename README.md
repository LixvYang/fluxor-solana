# Fluxor

<div align="center">

**Shared Economy Reading Platform on Solana**

[![Solana](https://img.shields.io/badge/Solana-14F195?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)

**Turn readers into investors. Early buyers earn ongoing rewards from subsequent purchases.**

[Live Demo](https://fluxor-read-web.vercel.app) • [Documentation](#docs) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Core Innovation](#core-innovation)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Fluxor is a **backend-less paid article platform** built on **Solana** and **MagicBlock PER** (Private Ephemeral Rollups). It enables creators to monetize content while automatically incentivizing early readers to promote their work.

### The Problem

Traditional paid content platforms suffer from:
- ❌ **One-way revenue**: Readers pay without returns, early supporters lack incentives
- ❌ **Centralized control**: Platforms dictate distribution and can censor content
- ❌ **Rampant piracy**: Early readers have no stake in preventing unauthorized sharing

### The Solution

Fluxor introduces a **reader incentive mechanism** that transforms early buyers into promoters:

- ✅ **Early readers earn 40%** of subsequent purchases
- ✅ **Fully decentralized** with no content censorship
- ✅ **Privacy-protected** content using MagicBlock PER
- ✅ **Anti-piracy by design**: Early readers lose money if content is pirated

---

## Core Innovation

### Revenue Distribution

Every purchase is split three ways:

| Role | Share | Purpose |
|------|-------|---------|
| **Platform** | 10% | Sustainable operations |
| **Author** | 50% | Direct creator income |
| **Early Readers** | 40% | Promotion incentive |

### Example: How It Works

Assume an article costs **1 SOL**:

| Purchase | Reader Pool | A's Reward | B's Reward |
|----------|-------------|------------|------------|
| A buys | 0 readers | 0 SOL | — |
| B buys | 1 reader | 0.4 SOL | 0 SOL |
| C buys | 2 readers | 0.2 SOL | 0.2 SOL |
| D buys | 3 readers | 0.13 SOL | 0.13 SOL |

**Total Earnings:**
- **A (1st buyer)**: 0.73 SOL
- **B (2nd buyer)**: 0.33 SOL
- **C (3rd buyer)**: 0.13 SOL
- **D (4th buyer)**: 0 SOL (hasn't earned yet)

The earlier you discover quality content, the more you earn from future buyers.

---

## Architecture

Fluxor leverages a dual-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Solana L1 Layer                        │
│  • Article registration                                     │
│  • Purchase & payment (SOL)                                 │
│  • Automatic revenue distribution                           │
│  • Reward claiming                                          │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                 MagicBlock PER Layer                        │
│  • Private article storage (Markdown)                       │
│  • Permission-based access control                          │
│  • Only purchasers can read content                         │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                     Frontend dApp                           │
│  • React + TypeScript                                       │
│  • Direct connection to DevNet                              │
│  • No backend required                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies

- **Solana** - High-performance L1 blockchain for public transactions
- **MagicBlock PER** - Privacy-preserving rollup for content storage
- **Anchor Framework** - Solana smart contract development
- **React + TypeScript** - Modern frontend framework
- **Rust** - Smart contract implementation language

---

## Features

### MVP (v0.1) - Current

#### For Creators
- ✅ Publish Markdown articles directly to the blockchain
- ✅ Set custom price and purchase limits
- ✅ Update article content post-publish
- ✅ Claim earnings automatically

#### For Readers
- ✅ Browse article listings
- ✅ Purchase articles with SOL
- ✅ Read privacy-protected content
- ✅ View real-time revenue sharing
- ✅ Claim rewards with one click

#### Technical
- ✅ **No backend required** - purely frontend + blockchain
- ✅ **Privacy by design** - content stored in MagicBlock PER
- ✅ **Automatic distribution** - smart contracts handle all splits
- ✅ **Transparent** - all transactions on-chain and verifiable

---

## Quick Start

### Prerequisites

- Rust toolchain
- Node.js 18+
- Solana CLI
- Anchor CLI
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/LixvYang/fluxor-solana.git
cd fluxor-solana

# Install dependencies
pnpm install
anchor build
```

### Local Development

```bash
# Start local validator
solana-test-validator

# Deploy program
anchor deploy

# Run tests
anchor test

# Start frontend
cd apps/web
pnpm dev
```

### Live Demo

Visit [fluxor-read-web.vercel.app](https://fluxor-read-web.vercel.app) to try the live application on Solana DevNet.

---

## Project Structure

```
fluxor-solana/
├── programs/
│   └── fluxor_solana/          # Solana smart contracts
│       ├── src/
│       │   ├── instructions/   # Instruction handlers
│       │   ├── state.rs        # State account definitions
│       │   ├── error.rs        # Error definitions
│       │   └── lib.rs          # Program entry point
│       └── tests/              # Unit tests
├── apps/
│   └── web/                    # React frontend dApp
│       ├── src/
│       │   ├── domain/         # Type definitions
│       │   ├── hooks/          # React hooks
│       │   ├── lib/            # Client libraries
│       │   └── App.tsx         # Main application
│       └── vite.config.ts      # Vite configuration
├── tests/                      # Integration tests
├── scripts/                    # Utility scripts
├── presentation/               # Slide deck (Slidev)
└── docs.md                     # Technical documentation
```

---

## Development

### Smart Contracts

```bash
# Build
anchor build

# Test (LiteSVM)
pnpm test:lite

# Test (RPC)
pnpm test:rpc

# Deploy to DevNet
anchor deploy --provider.cluster devnet
```

### Frontend

```bash
cd apps/web

# Development
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Code Quality

```bash
# Format code
pnpm lint:fix
```

---

## Roadmap

### v0.2 - Content Optimization
- [ ] Multi-account storage for larger articles (500KB+)
- [ ] Paginated article indexing for scalability
- [ ] Improved content chunking system

### v0.3 - Payment Expansion
- [ ] USDC / USDT support
- [ ] Multi-currency pricing
- [ ] Article version history
- [ ] Batch reward claiming

### v0.4 - Social Features
- [ ] Comments and reactions
- [ ] Author following
- [ ] Personal library
- [ ] Reading history

### v1.0+ - Ecosystem
- [ ] Secondary market (NFT-based reading rights)
- [ ] Subscription model
- [ ] Mobile applications
- [ ] Cross-chain expansion
- [ ] DAO governance

See [docs.md](docs.md) for detailed technical documentation.

---

## Universal Applicability

The Fluxor model extends beyond articles. Any **valuable, distributable digital content with paywall access** can use this mechanism:

- 📚 **Research Reports** - Early investors share in subsequent sales
- 💻 **Code Libraries** - Open source with sustainable funding
- 🎨 **Creative Assets** - Design templates, presets, plugins
- 📊 **Datasets** - AI training data, research datasets
- 🎓 **Online Courses** - Video content with built-in affiliate incentives

**Core Pattern:** Turn "early buyers" into "promoters" and "consumption" into "investment."

---

## Anti-Piracy Innovation

Fluxor creates a game-theoretic barrier to piracy:

**Traditional Model:**
- Reader buys content → Screenshots and shares → No consequences

**Fluxor Model:**
- Reader buys content → Sharing content = Losing future revenue
- Early readers become **copyright stakeholders**
- Community self-policing against piracy

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the ISC License.

---

## Acknowledgments

- **Solana** - High-performance blockchain infrastructure
- **MagicBlock** - Privacy-preserving compute layer
- **Anchor** - Solana development framework
- **Slidev** - Presentation tool for the deck

---

## Contact

- **GitHub Issues**: [Bug reports and feature requests](https://github.com/LixvYang/fluxor-solana/issues)
- **Discussions**: [Community discussions](https://github.com/LixvYang/fluxor-solana/discussions)

---

<div align="center">

**Built with ❤️ for the decentralized content economy**

[⬆ Back to Top](#fluxor)

</div>
