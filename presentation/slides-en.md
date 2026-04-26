---
theme: default
background: https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920
class: text-center
highlighter: shiki
lineNumbers: false
info: |
  ## Fluxor - Shared Economy Reading Platform
  Solana + MagicBlock Backend-less Paid Articles
drawings:
  persist: false
transition: slide-left
title: Fluxor
mdc: true
---

# Fluxor

Shared Economy Reading Platform

Where Readers, Authors, and Platform All Win

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    Press Space to continue <carbon:arrow-right class="inline"/>
  </span>
</div>

---
transition: fade-out
---

# The Problem: Traditional Paid Content Pain Points

<v-clicks>

## 📰 Traditional Model (e.g., New York Times)

<div class="grid grid-cols-2 gap-4 pt-4">
<div>

### ❌ One-way Revenue
- **Platform** takes subscription fees
- **Authors** get fixed payments
- **Readers** pay only, no returns

</div>
<div>

### ❌ Centralized Control
- Platform controls distribution
- Readers can't participate in revenue
- Early supporters have no incentive

</div>
</div>

</v-clicks>

---
layout: two-cols
---

# Solution: Shared Economy Reading

::left::

## 🔄 Three-Way Win

<div class="mt-8">

**Authors** (50%)
- Earn on publish
- Auto revenue split

**Readers** (40%)
- Purchase = Investment
- Early readers earn passively

**Platform** (10%)
- Sustainable operations
- No content moderation needed

</div>

::right::

## 💡 Core Innovation

<div class="mt-8">

1. **Purchase = Investment**
   - Early buyers earn from subsequent buyers

2. **Backend-less Architecture**
   - Pure on-chain, frontend connects to DevNet

3. **Privacy Protection**
   - MagicBlock PER protects content

</div>

---
layout: center
class: text-center
---

# Why This Design?

<div class="grid grid-cols-3 gap-8 pt-8">

<div>

## 📖 Reader Incentive

Discover quality content early,
purchase it, automatically earn
revenue from future readers

</div>

<div>

## ✍️ Author Incentive

No marketing needed,
readers actively promote
to earn revenue share

</div>

<div>

## 🌐 Decentralized

No content censorship,
no platform bans,
truly free publishing

</div>

</div>

---
layout: two-cols
---

# Revenue Distribution Mechanism

::left::

## 💰 Revenue Split

<div class="text-xl">

| Role | Share |
|------|-------|
| Platform | 10% |
| Author | 50% |
| Readers | 40% |

</div>

<div class="mt-8 text-sm">

**The brilliance:**
- Readers become "distributors"
- Self-propagating mechanism
- Early discovery rewards

</div>

::right::

## 📊 Distribution Example

<div class="text-sm">

Assume article price **1 SOL**

| Buyer | Reader Pool | A's Reward | B's Reward |
|-------|-------------|------------|------------|
| A | 0 | 0 SOL | — |
| B | 1 | 0.4 SOL | 0 SOL |
| C | 2 | 0.2 SOL | 0.2 SOL |
| D | 3 | 0.13 SOL | 0.13 SOL |

**A Total: 0.73 SOL** | **B Total: 0.33 SOL**

</div>

<div class="mt-4 text-xs opacity-70">
*First purchase reader reward goes to author | B earns from 3rd purchase onward
</div>

---
layout: center
---

# Technical Architecture

<div class="grid grid-cols-2 gap-12 pt-8">

<div>

## ⛓️ Solana L1

- Article registration
- Purchase payments
- Auto revenue distribution
- Reward claiming

**Public Data Layer**

</div>

<div>

## 🔐 MagicBlock PER

- Private article storage
- Permission control
- Only purchasers can read

**Privacy Data Layer**

</div>

</div>

---
layout: two-cols
---

# How MagicBlock Enables Privacy?

::left::

## 🔒 Technical Principles

1. **Delegation Model**
   - Article accounts delegated to PER
   - Encrypted data storage

2. **Permission Control**
   - Permission Account
   - Only authorized wallets can read

3. **Purchase = Authorization**
   - Transaction success auto-adds permission
   - No waiting required

::right::

```mermaid {scale: 0.7}
graph LR
    A[Purchase] --> B[Pay SOL]
    B --> C[Add Permission]
    C --> D[Read Article]

    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style C fill:#bfb,stroke:#333
    style D fill:#ffb,stroke:#333
```

---
layout: image-right
image: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800
---

# MVP Features: Backend-less Architecture

## ✅ Implemented

<div class="grid grid-cols-2 gap-4 text-sm">

<div>

### For Creators
- ✅ Publish Markdown articles
- ✅ Set price & purchase limit
- ✅ Update article content
- ✅ Claim earnings

</div>

<div>

### For Readers
- ✅ Browse article listings
- ✅ Purchase articles
- ✅ Read private content
- ✅ View revenue share
- ✅ Claim rewards

</div>

</div>

<div class="mt-6 text-xs opacity-70">
Frontend connects directly to DevNet, no backend services needed
</div>

---
layout: center
class: text-center
---

# Live Demo

<div class="text-2xl">

🔗 <strong>fluxor-read-web.vercel.app</strong>

</div>

<div class="grid grid-cols-3 gap-4 pt-8 text-left text-sm">

<div>
📝 <strong>Write Articles</strong>
- Markdown editor
- One-click publish
- Real-time preview
</div>

<div>
💰 <strong>Buy & Read</strong>
- Connect wallet
- One-click purchase
- Instant unlock
</div>

<div>
📊 <strong>Earnings Tracker</strong>
- Real-time revenue share
- One-click claim
- Transparent & verifiable
</div>

</div>

---
layout: two-cols
---

# Roadmap

::left::

## 🚀 v0.2 - Content Optimization

<div class="text-sm">

- Multi-account storage (500KB+ articles)
- Paginated indexing for scalability
- Improved chunking system

</div>

## 🚀 v0.3 - Payment Expansion

<div class="text-sm">

- USDC / USDT support
- Multi-currency pricing
- Article version history
- Batch reward claiming

</div>

::right::

## 🚀 v0.4 - Social Features

<div class="text-sm">

- Comments & reactions
- Follow authors
- Reading history
- Personal library

</div>

## 🚀 v1.0+ - Ecosystem

<div class="text-sm">

- Tipping functionality
- Image & video upload
- Subscription model
- Mobile applications
</div>

---
layout: center
class: text-center
---

# Core Competitive Advantage: Anti-Piracy Game Theory

<div class="grid grid-cols-2 gap-12 pt-8 text-left">

<div>

## 🎯 Traditional Piracy Problem

<v-clicks>

<div class="bg-red-500 bg-opacity-10 p-4 rounded-lg mb-4">

### ❌ Single Purchase, Infinite Distribution
- One person buys, screenshots and shares
- Readers have no incentive to stop piracy
- Authors suffer massive losses

</div>

<div class="bg-red-500 bg-opacity-10 p-4 rounded-lg">

### ❌ Early Readers Indifferent
- Already consumed the content
- Sharing costs them nothing
- Might even gain "reputation"

</div>

</v-clicks>

</div>

<div>

## 🛡️ Fluxor's Solution

<v-clicks>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg mb-4">

### ✅ Early Readers Have Revenue Share
- Earlier purchase = more future earnings
- Piracy = losing their own revenue

</div>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg">

### ✅ Readers Game Theory
- Early readers actively prevent piracy
- Even promote genuine copies
- "I bought, you buy too, I earn money"

</div>

</v-clicks>

</div>

</div>

<v-click>

<div class="mt-8 bg-blue-500 bg-opacity-20 p-6 rounded-lg">

## 💡 The Brilliance: Turn Pirates into Copyright Guardians

Early readers are no longer uninterested parties — they're **copyright stakeholders**

</div>

</v-click>

---
layout: center
class: text-center
---

# Core Value Proposition

<div class="grid grid-cols-3 gap-8 pt-8 text-left">

<div class="bg-blue-500 bg-opacity-10 p-4 rounded-lg">

## 🎯 For Readers

Early discovery = Passive income
<br>
Purchase = Investment

</div>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg">

## ✍️ For Authors

Auto-promotion mechanism
<br>
Focus on creation
<br>
Anti-piracy protection

</div>

<div class="bg-purple-500 bg-opacity-10 p-4 rounded-lg">

## 🌐 Decentralized

No platform censorship
<br>
Complete freedom

</div>

</div>

---
layout: center
class: text-center
---

# Universal Applicability

**Beyond Articles — Any Digital Content**

<div class="text-left pt-8 max-w-4xl mx-auto">

## The Core Pattern

> **Any valuable, distributable digital content with paywall access can use this mechanism.**

</div>

<div class="grid grid-cols-2 gap-4 pt-8 text-left text-sm">

<div class="bg-white bg-opacity-5 p-4 rounded-lg">

### 📚 Knowledge Content
- Research reports
- Online courses
- Investment strategies
- Tutorials & guides

</div>

<div class="bg-white bg-opacity-5 p-4 rounded-lg">

### 💻 Developer Tools
- Code libraries
- API access
- Design resources
- UI components

</div>

<div class="bg-white bg-opacity-5 p-4 rounded-lg">

### 🎨 Creative Content
- Music & audio
- Photography
- Game assets
- Video content

</div>

<div class="bg-white bg-opacity-5 p-4 rounded-lg">

### 📊 Data Services
- Datasets
- Research data
- Analytics data
- Training data

</div>

</div>

<div class="mt-8 text-sm opacity-70">

**Core Innovation:** Transform "early buyers" into "promoters" and "consumption" into "investment."

</div>

---
layout: center
class: text-center
---

# Truly Free Content Creation

<div class="text-3xl pt-8">

🚀 <strong>Fluxor - Shared Economy Reading Platform</strong>

</div>

<div class="pt-12">

Early Readers = Early Investors

</div>

<div class="pt-12 text-sm">

<strong>fluxor-solana.github.io</strong>

</div>

---
layout: end
---

# Thank You

<div class="grid grid-cols-2 gap-12 pt-8">

<div>

## 🤝 Let's Connect

<div class="text-sm">

Welcome to discuss technical details
and business model exploration

</div>

<div class="mt-4 text-xs opacity-70">

GitHub: github.com/LixvYang/fluxor-solana

</div>

</div>

<div>

## 📊 Tech Stack

<div class="text-sm">

- **Solana** — Public data layer
- **MagicBlock** — Privacy compute layer
- **Anchor** — Smart contract framework
- **React** — Frontend framework

</div>

</div>

</div>

<div class="pt-12 text-center">

# Q & A

</div>
