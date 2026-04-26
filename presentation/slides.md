---
theme: default
background: https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1920
class: text-center
highlighter: shiki
lineNumbers: false
info: |
  ## Fluxor - 共享经济阅读平台
  Solana + MagicBlock 无后端付费文章
drawings:
  persist: false
transition: slide-left
title: Fluxor
mdc: true
---

# Fluxor

共享经济阅读平台

让读者、作者、平台三方共赢

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    按空格键继续 <carbon:arrow-right class="inline"/>
  </span>
</div>

---
transition: fade-out
---

# 问题：传统付费阅读的痛点

<v-clicks>

## 📰 传统模式（如纽约时报）

<div class="grid grid-cols-2 gap-4 pt-4">
<div>

### ❌ 单向收益
- **平台** 收取订阅费
- **作者** 获得固定稿酬
- **读者** 只付钱，无回报

</div>
<div>

### ❌ 中心化控制
- 平台决定内容分发
- 读者无法参与收益
- 早期支持者无激励

</div>
</div>

</v-clicks>

---
layout: two-cols
---

# 解决方案：共享经济阅读

::left::

## 🔄 三方共赢

<div class="mt-8">

**作者** (50%)
- 发布即收益
- 自动分账

**读者** (40%)
- 购买即投资
- 早期读者躺赚

**平台** (10%)
- 可持续运营
- 无需内容审核

</div>

::right::

## 💡 核心创新

<div class="mt-8">

1. **购买 = 投资**
   - 早期购买者获得后续购买者分润
   
2. **无后端架构**
   - 纯链上，前端直连 DevNet
   
3. **隐私保护**
   - MagicBlock PER 保护正文

</div>

---
layout: center
class: text-center
---

# 为什么这样设计？

<div class="grid grid-cols-3 gap-8 pt-8">

<div>

## 📖 读者激励

早期发现好文章，
购买后自动获得
后续读者分润

</div>

<div>

## ✍️ 作者激励

无需营销，
读者主动传播
赚取分润

</div>

<div>

## 🌐 去中心化

无内容审查，
无平台封杀，
真正自由发布

</div>

</div>

---
layout: two-cols
---

# 分润机制设计

::left::

## 💰 收益分配

<div class="text-xl">

| 角色 | 比例 |
|------|------|
| 平台 | 10% |
| 作者 | 50% |
| 读者 | 40% |

</div>

<div class="mt-8 text-sm">

**精妙之处：**
- 读者成为"分销商"
- 自传播机制
- 早期发现奖励

</div>

::right::

## 📊 分润示例

<div class="text-sm">

假设文章价格 **1 SOL**

| 购买者 | 读者池 | A的奖励 | B的奖励 |
|--------|--------|---------|---------|
| A | 0人 | 0 SOL | — |
| B | 1人 | 0.4 SOL | 0 SOL |
| C | 2人 | 0.2 SOL | 0.2 SOL |
| D | 3人 | 0.13 SOL | 0.13 SOL |

**A 总计：0.73 SOL** | **B 总计：0.33 SOL**

</div>

<div class="mt-4 text-xs opacity-70">
*第一笔购买的读者奖励归作者 | B从第3笔购买才开始获得分润
</div>

---
layout: center
---

# 技术架构

<div class="grid grid-cols-2 gap-12 pt-8">

<div>

## ⛓️ Solana L1

- 文章注册
- 购买付款
- 自动分账
- 收益 claim

**公开数据层**

</div>

<div>

## 🔐 MagicBlock PER

- 隐私文章存储
- 权限控制
- 只有购买者可读

**隐私数据层**

</div>

</div>

---
layout: two-cols
---

# MagicBlock 如何实现隐私？

::left::

## 🔒 技术原理

1. **委托模式**
   - 文章账户委托到 PER
   - 数据加密存储

2. **权限控制**
   - Permission Account
   - 只有授权钱包可读

3. **购买即授权**
   - 交易成功自动添加权限
   - 无需等待

::right::

```mermaid {scale: 0.7}
graph LR
    A[购买] --> B[支付SOL]
    B --> C[添加权限]
    C --> D[读取文章]
    
    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style C fill:#bfb,stroke:#333
    style D fill:#ffb,stroke:#333
```

---
layout: image-right
image: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800
---

# MVP 功能：无后端架构

## ✅ 已实现

<div class="grid grid-cols-2 gap-4 text-sm">

<div>

### 创作者
- ✅ 发布 Markdown 文章
- ✅ 设置价格和购买上限
- ✅ 更新文章内容
- ✅ Claim 收益

</div>

<div>

### 读者
- ✅ 浏览文章列表
- ✅ 购买文章
- ✅ 阅读隐私内容
- ✅ 查看分润
- ✅ Claim 奖励

</div>

</div>

<div class="mt-6 text-xs opacity-70">
前端直连 DevNet，无需任何后端服务
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
📝 <strong>写文章</strong>
- Markdown 编辑器
- 一键发布
- 实时预览
</div>

<div>
💰 <strong>购买阅读</strong>
- 连接钱包
- 一键购买
- 即时解锁
</div>

<div>
📊 <strong>收益追踪</strong>
- 实时分润
- 一键 Claim
- 透明可查
</div>

</div>

---
layout: two-cols
---

# 路线图

::left::

## 🚀 v1.0 - 智能后端

<div class="text-sm">

- AI 文章分类
- 智能推荐
- 搜索功能
- 热门榜单

</div>

## 🚀 v2.0 - 社交功能

<div class="text-sm">

- 点赞/评论
- 关注作者
- 阅读历史
- 书架管理

</div>

::right::

## 🚀 v3.0 - 增强收益

<div class="text-sm">

- 打赏功能
- 打赏增加分润比例
- USDC 支付
- 多货币支持

</div>

## 🚀 v4.0 - 内容生态

<div class="text-sm">

- 图片上传
- 视频嵌入
- 系列文章
- 订阅制

</div>

---
layout: center
class: text-center
---

# 核心竞争优势：反盗版博弈

<div class="grid grid-cols-2 gap-12 pt-8 text-left">

<div>

## 🎯 传统盗版问题

<v-clicks>

<div class="bg-red-500 bg-opacity-10 p-4 rounded-lg mb-4">

### ❌ 单次购买，无限传播
- 一人购买，截图分享
- 读者无激励阻止盗版
- 作者损失惨重

</div>

<div class="bg-red-500 bg-opacity-10 p-4 rounded-lg">

### ❌ 早期读者无所谓
- 反正已经看过内容
- 分享给别人无损失
- 甚至可能获得"好评"

</div>

</v-clicks>

</div>

<div>

## 🛡️ Fluxor 的解决方案

<v-clicks>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg mb-4">

### ✅ 早期读者有分润权
- 购买越早，后续收益越大
- 盗版 = 损失自己的收益

</div>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg">

### ✅ 读者相互博弈
- 早期读者主动阻止盗版
- 甚至主动推广正版
- "我买了，你也买，我有钱赚"

</div>

</v-clicks>

</div>

</div>

<v-click>

<div class="mt-8 bg-blue-500 bg-opacity-20 p-6 rounded-lg">

## 💡 精妙之处：让盗版者成为正版守护者

早期读者不再是无利益相关者，而是**版权利益共同体**

</div>

</v-click>

---
layout: center
class: text-center
---

# 核心价值

<div class="grid grid-cols-3 gap-8 pt-8 text-left">

<div class="bg-blue-500 bg-opacity-10 p-4 rounded-lg">

## 🎯 读者

早期发现 = 被动收入
<br>
购买即投资

</div>

<div class="bg-green-500 bg-opacity-10 p-4 rounded-lg">

## ✍️ 作者

自动传播机制
<br>
专注创作
<br>
反盗版保护

</div>

<div class="bg-purple-500 bg-opacity-10 p-4 rounded-lg">

## 🌐 去中心化

无平台审查
<br>
完全自由

</div>

</div>

---
layout: center
class: text-center
---

# 让内容创作真正自由

<div class="text-3xl pt-8">

🚀 **Fluxor - 共享经济阅读平台**

</div>

<div class="pt-12">

早期读者 = 早期投资者

</div>

<div class="pt-12 text-center text-sm">

**在线体验**
fluxor-read-web.vercel.app

</div>

---
layout: end
---

# 感谢聆听

<div class="grid grid-cols-2 gap-12 pt-8">

<div>

## 🤝 交流

<div class="text-sm">

欢迎交流技术细节
和商业模式探讨

</div>

</div>

<div>

## 📊 技术栈

<div class="text-sm">

- **Solana** - 公共数据层
- **MagicBlock** - 隐私计算层
- **Anchor** - 智能合约框架
- **React** - 前端框架

</div>

</div>

</div>

<div class="pt-12 text-center">

# Q & A

</div>
