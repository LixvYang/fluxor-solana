# Fluxor on Solana + MagicBlock PER：无后端付费文章最终方案

## 1. 方案定位

本方案是一个**无业务后端**的 Solana 付费文章平台方案。

核心目标：

- 作者可以发布 Markdown 付费文章。
- 文章全文不公开上 Solana L1。
- 文章全文存入 MagicBlock Private Ephemeral Rollup（PER）隐私账户。
- 只有购买过文章的钱包可以读取正文。
- 购买资金进入每篇文章自己的链上金库 `ArticleVault`。
- 作者、平台、早期读者都从链上金库中自行 claim 收益。
- 不为每个购买者创建独立购买账户。
- 每篇文章设置最大购买次数，例如 100 次。
- 不需要业务后端、数据库、内容服务器或密钥服务器。

需要依赖的外部服务：

```text
Solana RPC
MagicBlock PER RPC
前端静态网站
```

不需要自建：

```text
数据库
Indexer
内容服务器
密钥服务器
中心化分账服务
```

---

## 2. 总体架构

```text
前端 dApp
  ├─ 创建文章
  ├─ 购买文章
  ├─ 解锁 MagicBlock 阅读权限
  ├─ 读取 PER Markdown 正文
  └─ claim 收益

Solana L1 Program
  ├─ Article
  ├─ ReaderList
  ├─ ArticleVault
  ├─ 购买逻辑
  ├─ 分润逻辑
  └─ claim 逻辑

MagicBlock PER
  ├─ ArticlePrivateContent
  └─ Permission Account
```

职责划分：

```text
Solana L1：负责购买、资金、分润、读者列表、claim。
MagicBlock PER：负责保存 Markdown 全文和阅读权限。
前端：负责所有用户交互、文章创建、购买、读取和 claim。
```

---

## 3. 为什么可以不需要后端

因为文章全文不再放到后端存储，而是直接放进 MagicBlock PER 的隐私账户。

购买状态由 Solana L1 的 `ReaderList` 记录。

阅读权限由 MagicBlock 的 `Permission Account` 控制。

资金由 Solana L1 的 `ArticleVault` 托管。

因此不需要后端来做：

```text
保存正文
解密正文
判断用户是否购买
计算分润
人工打款
```

所有核心状态都在链上或 PER 中。

---

## 4. 核心产品规则

### 4.1 文章格式

文章正文使用 Markdown 文本。

```md
# 标题

这里是正文。

## 小节

更多内容。
```

Markdown 以 UTF-8 bytes 存入 MagicBlock PER 隐私账户。

### 4.2 内容限制

为了避免隐私账户变成大文件存储，MVP 建议限制：

```text
单篇文章最大 32KB 或 64KB
不允许 base64 图片
图片只能使用外链
不支持附件原文
购买后不允许修改正文
```

### 4.3 购买上限

每篇文章创建时设置最大购买次数：

```text
max_purchases = 100
```

表示该文章最多只能被 100 个钱包购买。

购买满后，新的购买交易失败。

### 4.4 收益分配

默认分配：

```text
平台：10%
作者：50%
早期读者：40%
```

使用 bps 表示：

```text
platform_fee_bps = 1000
author_bps = 5000
reward_bps = 4000
```

总和必须等于：

```text
10000
```

---

## 5. 第一位读者的特殊规则

第一位读者购买文章时，之前没有早期读者，所以这笔购买的读者奖励池无人可分。

推荐规则：

```text
第一笔购买的 reader_reward_pool 归作者。
```

也就是第一笔购买：

```text
平台：10%
作者：90%
读者奖励：0%
```

从第二笔购买开始：

```text
平台：10%
作者：50%
之前所有读者平分 40%
```

---

## 6. Solana L1 账户设计

### 6.1 GlobalConfig

平台全局配置。

```rust
pub struct GlobalConfig {
    pub admin: Pubkey,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,

    pub min_price: u64,
    pub max_purchases_limit: u32,

    pub article_count: u64,
    pub paused: bool,
}
```

字段说明：

| 字段                  | 说明                     |
| --------------------- | ------------------------ |
| `admin`               | 平台管理员               |
| `platform_fee_bps`    | 平台费率                 |
| `reward_bps`          | 早期读者奖励比例         |
| `author_bps`          | 作者收益比例             |
| `min_price`           | 最低文章价格             |
| `max_purchases_limit` | 单篇文章最大购买次数上限 |
| `article_count`       | 文章计数                 |
| `paused`              | 平台级暂停开关           |

约束：

```text
platform_fee_bps + reward_bps + author_bps == 10000
```

---

### 6.2 Article

每篇文章一个 Article 账户。

```rust
pub struct Article {
    pub id: u64,
    pub author: Pubkey,
    pub price: u64,

    pub max_purchases: u32,
    pub purchase_count: u32,
    pub total_paid: u64,

    pub reader_list: Pubkey,
    pub vault: Pubkey,

    pub private_content_account: Pubkey,
    pub permission_account: Pubkey,

    pub title_hash: [u8; 32],
    pub preview_hash: [u8; 32],
    pub content_hash: [u8; 32],

    pub acc_reward_per_reader: u128,

    pub author_pending: u64,
    pub author_claimed: u64,

    pub platform_pending: u64,
    pub platform_claimed: u64,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,

    pub created_at: i64,

    pub bump: u8,
    pub vault_bump: u8,
}
```

关键字段：

| 字段                      | 说明                            |
| ------------------------- | ------------------------------- |
| `private_content_account` | MagicBlock PER 中的正文隐私账户 |
| `permission_account`      | MagicBlock PER 中的权限账户     |
| `reader_list`             | Solana L1 读者列表              |
| `vault`                   | 文章金库                        |
| `acc_reward_per_reader`   | 早期读者累计奖励指数            |
| `author_pending`          | 作者可领取金额                  |
| `platform_pending`        | 平台可领取金额                  |

注意：

```text
Article 不存 Markdown 全文。
Article 只存正文 hash 和 PER 账户引用。
```

---

### 6.3 ReaderList

每篇文章一个 ReaderList 账户。

```rust
pub struct ReaderList {
    pub article: Pubkey,
    pub reader_count: u32,
    pub max_readers: u32,

    pub readers: Vec<Pubkey>,
    pub reward_debts: Vec<u128>,
}
```

数组关系：

```text
readers[i] 对应 reward_debts[i]
```

示例：

```text
readers[0] = A
reward_debts[0] = A 的奖励债务

readers[1] = B
reward_debts[1] = B 的奖励债务
```

由于 `max_purchases` 有上限，例如 100，所以遍历去重和查找 reader index 是可控的。

---

### 6.4 ArticleVault

每篇文章一个链上金库。

MVP 先支持 SOL。

PDA seeds：

```text
["vault", article_pda]
```

资金流：

```text
买家付款 → ArticleVault
ArticleVault → 作者 claim
ArticleVault → 平台 claim
ArticleVault → 读者 claim
```

---

### 6.5 ArticleIndexPage

无后端版本需要链上文章索引，否则前端很难展示文章列表。

建议使用分页索引。

```rust
pub struct ArticleIndexPage {
    pub page_index: u32,
    pub article_count: u32,
    pub articles: Vec<Pubkey>,
}
```

每页例如保存 100 个 Article PDA。

PDA seeds：

```text
["article_index", page_index]
```

创建文章时，合约把新文章追加到当前索引页。

如果当前页满了，创建下一页。

---

## 7. MagicBlock PER 账户设计

### 7.1 ArticlePrivateContent

存放文章 Markdown 全文。

```rust
pub struct ArticlePrivateContent {
    pub article: Pubkey,
    pub author: Pubkey,

    pub content_hash: [u8; 32],
    pub content_len: u32,

    pub markdown: Vec<u8>,

    pub created_at: i64,
}
```

字段说明：

| 字段           | 说明                   |
| -------------- | ---------------------- |
| `article`      | 对应 Solana L1 Article |
| `author`       | 作者钱包               |
| `content_hash` | Markdown 正文 hash     |
| `content_len`  | 正文长度               |
| `markdown`     | UTF-8 Markdown bytes   |
| `created_at`   | 创建时间               |

---

### 7.2 Permission Account

每篇文章一个 MagicBlock Permission Account。

用于控制谁能读取 `ArticlePrivateContent`。

初始成员：

```text
author_wallet:
- AUTHORITY
- TX_MESSAGE
```

购买后新增：

```text
buyer_wallet:
- TX_MESSAGE
```

含义：

```text
AUTHORITY：可以管理权限成员。
TX_MESSAGE：可以读取受权限控制的文章内容相关数据。
```

普通买家只给读取权限，不给 `AUTHORITY`。

---

## 8. PDA 设计

### GlobalConfig

```text
["global_config"]
```

### Article

推荐使用作者指定的 nonce 或 article_id。

```text
["article", author, article_nonce]
```

这样前端可以提前推导 `article_pda`，再创建 MagicBlock 私密账户。

### ReaderList

```text
["reader_list", article_pda]
```

### ArticleVault

```text
["vault", article_pda]
```

### ArticleIndexPage

```text
["article_index", page_index]
```

---

## 9. Solana L1 指令设计

最终 L1 指令：

```text
initialize_config
update_config
create_article
buy_article
unlock_article_access
claim_author_revenue
claim_platform_fee
claim_reader_reward
```

如果后续可以在 `buy_article` 中 CPI 更新 MagicBlock Permission，则可以移除 `unlock_article_access`。

---

## 10. initialize_config

初始化平台配置。

### 参数

```rust
platform_fee_bps: u16
reward_bps: u16
author_bps: u16
min_price: u64
max_purchases_limit: u32
```

### 校验

```text
platform_fee_bps + reward_bps + author_bps == 10000
max_purchases_limit > 0
```

### 行为

```text
1. 创建 GlobalConfig
2. 设置 admin = signer
3. 设置费率
4. 设置 min_price
5. 设置 max_purchases_limit
6. paused = false
```

---

## 11. update_config

管理员更新配置。

### 可更新字段

```text
admin
platform_fee_bps
reward_bps
author_bps
min_price
max_purchases_limit
paused
```

### 校验

```text
signer == config.admin
platform_fee_bps + reward_bps + author_bps == 10000
```

注意：

```text
旧文章使用创建时快照的费率，不受 update_config 影响。
```

---

## 12. create_article

作者创建文章。

### 参数

```rust
article_nonce: [u8; 32]
price: u64
max_purchases: u32
title_hash: [u8; 32]
preview_hash: [u8; 32]
content_hash: [u8; 32]
private_content_account: Pubkey
permission_account: Pubkey
```

### 校验

```text
config.paused == false
price >= config.min_price
max_purchases > 0
max_purchases <= config.max_purchases_limit
```

### 行为

```text
1. 创建 Article
2. 创建 ReaderList
3. 创建 ArticleVault
4. 快照当前费率到 Article
5. 写入 private_content_account
6. 写入 permission_account
7. 初始化 purchase_count = 0
8. 初始化 total_paid = 0
9. 初始化 acc_reward_per_reader = 0
10. 初始化 author_pending = 0
11. 初始化 platform_pending = 0
12. 写入 ArticleIndexPage
13. emit ArticleCreated
```

### 说明

`create_article` 之前，前端应先创建 MagicBlock PER 中的：

```text
ArticlePrivateContent
Permission Account
```

然后把这两个账户地址传给 `create_article`。

---

## 13. buy_article

读者购买文章。

### 参数

```rust
amount: u64
```

推荐要求：

```text
amount == article.price
```

### 校验

```text
config.paused == false
buyer != article.author
article.purchase_count < article.max_purchases
amount == article.price
buyer 不在 ReaderList.readers 中
```

### 行为

```text
1. buyer 支付 price 到 ArticleVault
2. 计算 platform_fee
3. 计算 reward_pool
4. 计算 author_amount
5. 更新 platform_pending
6. 更新 author_pending
7. 更新 acc_reward_per_reader
8. buyer 加入 ReaderList
9. 设置 buyer 的 reward_debt
10. article.purchase_count += 1
11. article.total_paid += price
12. emit ArticlePurchased
```

注意：

```text
buy_article 只完成购买和分润状态更新。
如果无法在该指令中同步 MagicBlock 权限，则用户还需要执行 unlock_article_access。
```

---

## 14. buy_article 分润逻辑

设：

```text
price = article.price
```

计算：

```text
platform_fee = price * platform_fee_bps / 10000
reward_pool = price * reward_bps / 10000
author_amount = price - platform_fee - reward_pool
```

使用 `price - platform_fee - reward_pool` 计算作者金额，可以避免整数除法导致总和不等于 price。

---

### 14.1 第一位购买者

如果：

```text
article.purchase_count == 0
```

则之前没有读者。

规则：

```text
第一笔购买的 reward_pool 给作者。
```

执行：

```text
platform_pending += platform_fee
author_pending += author_amount + reward_pool
acc_reward_per_reader 不变
```

然后：

```text
readers.push(buyer)
reward_debts.push(acc_reward_per_reader)
```

---

### 14.2 第二位及之后购买者

如果：

```text
article.purchase_count > 0
```

则：

```text
previous_reader_count = article.purchase_count
```

奖励池分给之前所有读者：

```text
acc_reward_per_reader += reward_pool * PRECISION / previous_reader_count
```

然后：

```text
platform_pending += platform_fee
author_pending += author_amount
```

当前买家加入时：

```text
readers.push(buyer)
reward_debts.push(acc_reward_per_reader)
```

这样当前买家不会分到自己这笔购买产生的奖励。

---

## 15. PRECISION 精度

Solana 使用整数计算，需要放大精度。

建议：

```rust
const PRECISION: u128 = 1_000_000_000_000;
```

奖励指数更新：

```text
acc_reward_per_reader += reward_pool * PRECISION / previous_reader_count
```

读者 claim：

```text
claimable = (acc_reward_per_reader - reward_debt) / PRECISION
```

---

## 16. unlock_article_access

该指令用于无后端情况下，让已购买用户自己解锁 MagicBlock 阅读权限。

如果未来 `buy_article` 可以直接 CPI 调用 MagicBlock Permission Program 更新权限，则可以不需要该指令。

### 参数

```rust
article: Pubkey
permission_account: Pubkey
buyer: Pubkey
```

### 校验

```text
buyer 是 signer
permission_account == article.permission_account
buyer 已经在 ReaderList.readers 中
buyer 还不是 Permission Account member
```

### 行为

```text
调用 MagicBlock Permission 更新流程
把 buyer 加入 permission_account members
给 buyer 设置 flags = TX_MESSAGE
emit ArticleAccessUnlocked
```

### 作用

```text
购买成功后，用户调用 unlock_article_access，获得读取 PER Markdown 的权限。
```

---

## 17. claim_reader_reward

读者领取自己的早期奖励。

### 参数

```rust
reader_index: u32
```

### 前端准备

前端读取 ReaderList：

```text
reader_index = readers.indexOf(user_wallet)
```

### 校验

```text
reader_index < reader_count
reader_list.readers[reader_index] == signer
```

### 计算

```text
pending_scaled = article.acc_reward_per_reader - reader_list.reward_debts[reader_index]
claimable = pending_scaled / PRECISION
```

### 执行

如果：

```text
claimable > 0
```

则：

```text
ArticleVault 转 claimable 给 reader
reader_list.reward_debts[reader_index] += claimable * PRECISION
emit ReaderRewardClaimed
```

注意：

```text
不要直接设置 reward_debt = acc_reward_per_reader。
推荐增加 claimable * PRECISION，以保留整数除法的小数残差。
```

---

## 18. claim_author_revenue

作者领取收益。

### 校验

```text
signer == article.author
article.author_pending > 0
```

### 执行

```text
amount = article.author_pending
ArticleVault 转 amount 给 author
article.author_claimed += amount
article.author_pending = 0
emit AuthorRevenueClaimed
```

---

## 19. claim_platform_fee

平台领取手续费。

### 建议 GlobalConfig 增加

```rust
pub platform_fee_receiver: Pubkey
```

### 校验

```text
signer == config.admin
article.platform_pending > 0
```

### 执行

```text
amount = article.platform_pending
ArticleVault 转 amount 给 platform_fee_receiver
article.platform_claimed += amount
article.platform_pending = 0
emit PlatformFeeClaimed
```

注意：

```text
平台费不是购买时进入平台地址。
平台费也先进入 ArticleVault，之后由平台 claim。
```

---

## 20. 链上事件

### ArticleCreated

```rust
pub struct ArticleCreated {
    pub article: Pubkey,
    pub article_id: u64,
    pub author: Pubkey,
    pub price: u64,
    pub max_purchases: u32,
    pub private_content_account: Pubkey,
    pub permission_account: Pubkey,
    pub content_hash: [u8; 32],
    pub created_at: i64,
}
```

### ArticlePurchased

```rust
pub struct ArticlePurchased {
    pub article: Pubkey,
    pub article_id: u64,
    pub buyer: Pubkey,
    pub author: Pubkey,
    pub amount: u64,
    pub purchase_index: u32,
    pub purchased_at: i64,
}
```

### ArticleAccessUnlocked

```rust
pub struct ArticleAccessUnlocked {
    pub article: Pubkey,
    pub buyer: Pubkey,
    pub permission_account: Pubkey,
    pub unlocked_at: i64,
}
```

### ReaderRewardClaimed

```rust
pub struct ReaderRewardClaimed {
    pub article: Pubkey,
    pub reader: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}
```

### AuthorRevenueClaimed

```rust
pub struct AuthorRevenueClaimed {
    pub article: Pubkey,
    pub author: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}
```

### PlatformFeeClaimed

```rust
pub struct PlatformFeeClaimed {
    pub article: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}
```

---

## 21. 作者发文流程

无后端情况下，全部由前端完成。

### 步骤 1：作者输入文章

前端收集：

```text
title
preview
markdown
price
max_purchases
```

计算：

```text
title_hash = sha256(title)
preview_hash = sha256(preview)
content_hash = sha256(markdown)
content_len = markdown.length
```

---

### 步骤 2：推导 Article PDA

建议使用作者生成的随机 nonce：

```text
article_nonce = random 32 bytes
```

推导：

```text
article_pda = PDA(["article", author, article_nonce])
```

这样可以在创建 PER 内容账户之前，先确定 L1 Article 地址。

---

### 步骤 3：创建 MagicBlock ArticlePrivateContent

前端调用 MagicBlock SDK 创建：

```text
ArticlePrivateContent
```

写入：

```text
article = article_pda
author = author_wallet
content_hash
content_len
markdown = UTF-8 Markdown bytes
created_at
```

---

### 步骤 4：创建 Permission Account

初始成员：

```text
author_wallet:
- AUTHORITY
- TX_MESSAGE
```

可选：

```text
platform_admin:
- AUTHORITY
```

然后委托到 MagicBlock PER，使访问控制生效。

---

### 步骤 5：创建 Solana L1 Article

前端调用：

```text
create_article(
  article_nonce,
  price,
  max_purchases,
  title_hash,
  preview_hash,
  content_hash,
  private_content_account,
  permission_account
)
```

创建：

```text
Article
ReaderList
ArticleVault
ArticleIndexPage entry
```

---

## 22. 用户购买流程

### 步骤 1：前端展示文章

前端读取链上 `ArticleIndexPage`，拿到文章列表。

再读取每篇 `Article` 的公开信息：

```text
price
max_purchases
purchase_count
title_hash
preview_hash
```

注意：

```text
无后端版本没有数据库保存 title 和 preview 原文。
```

如果想完全无后端又要展示标题和简介，有两个选择：

```text
1. 标题和简介也放入 PER，只有买过才能看完整信息。
2. 标题和简介明文放到 L1 或单独公开账户。
```

推荐折中：

```text
标题和简介可以明文上 L1 或公开账户；正文放 PER。
```

如果标题和简介也不想公开，则列表页只能展示 hash、价格、作者和购买进度。

---

### 步骤 2：购买文章

用户调用：

```text
buy_article(article)
```

合约执行：

```text
1. SOL 进入 ArticleVault
2. 更新 author_pending
3. 更新 platform_pending
4. 更新 acc_reward_per_reader
5. buyer 加入 ReaderList
6. 设置 buyer reward_debt
```

---

### 步骤 3：解锁 MagicBlock 权限

如果 `buy_article` 不能直接同步更新 MagicBlock Permission，则用户继续调用：

```text
unlock_article_access(article)
```

该指令校验用户已经在 `ReaderList` 中，然后把用户加入 Permission Account。

解锁完成后，用户可以读取 PER 正文。

---

## 23. 用户阅读流程

### 步骤 1：前端获取 MagicBlock auth token

用户通过钱包签名，连接 MagicBlock PER。

MagicBlock PER 会校验用户身份和权限。

### 步骤 2：读取 ArticlePrivateContent

前端请求：

```text
ArticlePrivateContent.markdown
```

PER 检查：

```text
用户是否在 Permission Account members 中
用户是否拥有 TX_MESSAGE 权限
```

如果有权限，返回 Markdown。

### 步骤 3：前端渲染 Markdown

前端把 Markdown 渲染为文章页面。

---

## 24. 收益展示和 claim

### 24.1 读者查看可领取金额

前端读取：

```text
Article.acc_reward_per_reader
ReaderList.readers
ReaderList.reward_debts
```

找到自己的位置：

```text
reader_index = readers.indexOf(wallet)
```

计算：

```text
claimable = (article.acc_reward_per_reader - reward_debts[reader_index]) / PRECISION
```

### 24.2 读者领取

调用：

```text
claim_reader_reward(article, reader_index)
```

资金从 `ArticleVault` 转给读者。

---

### 24.3 作者领取

作者读取：

```text
Article.author_pending
```

调用：

```text
claim_author_revenue(article)
```

资金从 `ArticleVault` 转给作者。

---

### 24.4 平台领取

管理员读取：

```text
Article.platform_pending
```

调用：

```text
claim_platform_fee(article)
```

资金从 `ArticleVault` 转给平台收款地址。

---

## 25. 示例

文章价格：

```text
1 SOL
```

分配比例：

```text
平台 10%
作者 50%
早期读者 40%
```

购买顺序：

```text
A 第 1 个买
B 第 2 个买
C 第 3 个买
D 第 4 个买
```

### A 购买

之前没有读者。

```text
平台 pending += 0.1 SOL
作者 pending += 0.9 SOL
A 加入 ReaderList
A 当前 reader reward = 0
```

### B 购买

之前读者：A。

```text
平台 pending += 0.1 SOL
作者 pending += 0.5 SOL
A 可领取 += 0.4 SOL
B 加入 ReaderList
```

### C 购买

之前读者：A、B。

```text
平台 pending += 0.1 SOL
作者 pending += 0.5 SOL
A 可领取 += 0.2 SOL
B 可领取 += 0.2 SOL
C 加入 ReaderList
```

### D 购买

之前读者：A、B、C。

```text
平台 pending += 0.1 SOL
作者 pending += 0.5 SOL
A 可领取 += 0.133333 SOL
B 可领取 += 0.133333 SOL
C 可领取 += 0.133333 SOL
D 加入 ReaderList
```

累计：

```text
A 可领取 = 0.733333 SOL
B 可领取 = 0.333333 SOL
C 可领取 = 0.133333 SOL
D 可领取 = 0
```

### B 的奖励计算详情

以 B 为例，详细展示奖励累计过程：

**B 购买时（第 2 位）：**
```text
之前读者数 = 1（A）
B 不是早期读者，B 的这笔购买不产生自己的奖励
reward_pool = 0.4 SOL 全部分给 A
B.reward_debt = 当前的 acc_reward_per_reader（不含本次购买）
```

**C 购买时（第 3 位）：**
```text
之前读者数 = 2（A、B）
reward_pool = 0.4 SOL
B 可领取 += 0.4 / 2 = 0.2 SOL
```

**D 购买时（第 4 位）：**
```text
之前读者数 = 3（A、B、C）
reward_pool = 0.4 SOL
B 可领取 += 0.4 / 3 ≈ 0.133333 SOL
```

**B 的奖励总计：**
```text
B 总计收到 = 0.2 + 0.133333 = 0.333333 SOL
```

关键点：
```text
1. 读者只分到"之后购买者"产生的奖励池
2. 自己购买的那笔不产生自己的奖励
3. 越早购买，能分享的后续购买次数越多，总收益越高
```

---

## 26. 无后端版本的关键难点

### 26.1 L1 购买状态与 PER 权限同步

这是无后端方案最大的难点。

购买在 Solana L1，阅读权限在 MagicBlock PER。

需要保证：

```text
买过的人最终一定能加入 Permission Account。
没买过的人不能加入 Permission Account。
```

推荐解法：

```text
购买成功后，用户自己调用 unlock_article_access。
unlock_article_access 校验用户已经在 L1 ReaderList 中，再授予 PER 阅读权限。
```

---

### 26.2 文章列表展示

无后端没有数据库。

推荐使用链上 `ArticleIndexPage`。

前端通过 `ArticleIndexPage` 获取全部文章。

如果要更好的搜索、推荐、排序，就需要未来增加 indexer 或后端。

---

### 26.3 标题和简介怎么展示

如果标题和简介不上公开链，列表页无法正常展示。

推荐 MVP：

```text
标题和简介公开；正文私密。
```

可选设计：

```text
Article 存 title 和 preview 明文，或者存一个公开 Metadata 账户。
ArticlePrivateContent 只存 Markdown 正文。
```

如果连标题和简介都要隐藏，则用户只能在购买前看到作者、价格、hash 和购买进度，产品体验会很差。

---

## 27. 推荐 MVP 限制

```text
单篇 Markdown 最大 32KB
每篇文章最多 100 个购买者
标题和简介公开
正文放 MagicBlock PER
购买后不能修改正文
图片只能外链
不支持附件
MVP 先支持 SOL
后续再支持 USDC
```

---

## 28. 安全注意事项

### 28.1 防止作者自买

`buy_article` 校验：

```text
buyer != article.author
```

### 28.2 防止重复购买

`buy_article` 遍历 `ReaderList.readers`：

```text
buyer 不在 readers 中
```

因为最多 100 个读者，所以成本可控。

### 28.3 防止替换正文

无后端版本建议：

```text
购买后不允许修改 ArticlePrivateContent.markdown。
```

Solana L1 `Article.content_hash` 应该和 PER `ArticlePrivateContent.content_hash` 一致。

### 28.4 防止冒领 claim

读者 claim：

```text
readers[reader_index] == signer
```

作者 claim：

```text
signer == article.author
```

平台 claim：

```text
signer == config.admin
```

### 28.5 防止未购买读取正文

PER 权限控制：

```text
未购买用户不在 Permission Account members 中。
没有 TX_MESSAGE 权限，不能读取 ArticlePrivateContent.markdown。
```

---

## 29. 是否完全不需要后端

是，但要明确：

```text
不需要业务后端，不等于不需要基础设施。
```

仍然需要：

```text
Solana RPC
MagicBlock PER RPC
前端托管，例如 Vercel / Cloudflare Pages / IPFS
```

不需要：

```text
PostgreSQL
API Server
内容服务器
密钥服务器
自建 indexer
中心化结算服务
```

---

## 30. 后续可选升级

### 30.1 支持 USDC

将 `ArticleVault` 改为 SPL Token Account。

购买和 claim 使用 SPL Token transfer。

### 30.2 支持后端索引

后续为了搜索、推荐、热门榜，可以增加 indexer。

但 indexer 只负责展示，不参与资金和权限。

### 30.3 支持文章版本

未来如果允许修改正文，可以增加：

```text
ArticleVersion
```

每次修改创建新版本，而不是覆盖原文。

### 30.4 支持用户直接前端阅读水印

前端渲染 Markdown 时添加钱包地址水印。

注意：这只能增加泄露成本，不能防止截图和复制。

---

## 31. 最终结论

最终无后端方案如下：

```text
Solana L1：
- 文章注册
- 购买付款
- ReaderList
- ArticleVault
- 作者 claim
- 平台 claim
- 读者 claim

MagicBlock PER：
- 保存 Markdown 全文
- Permission Account 控制谁能读

前端：
- 创建文章
- 创建 PER 内容账户
- 创建 Permission Account
- 调用 Solana create_article
- 购买文章
- 解锁 PER 阅读权限
- 读取 PER Markdown
- 渲染文章
- claim 收益
```

一句话总结：

```text
文章全文放 MagicBlock PER；购买和分润放 Solana L1；用户购买后通过 Permission Account 获得阅读权限；整个系统可以不需要业务后端。
```

---

## 32. MVP 最终收敛方案：Markdown 正文直接存 MagicBlock PER

MVP 版本不使用后端服务，也不使用 Arweave、Irys、IPFS 等外部内容存储。

文章正文直接以 Markdown bytes 的形式存入 MagicBlock PER 的私密账户中。

图片、视频、附件不上传到本系统，统一作为链接写入 Markdown：

```md
# 示例文章

这是正文内容。

![图片](https://example.com/image.png)

<video src="https://example.com/video.mp4" controls></video>
```

注意：

```text
MagicBlock PER 可以保护 Markdown 正文账户的读取权限。
但 Markdown 里引用的图片、视频 URL 如果本身公开，则这些资源仍然是公开的。
```

---

## 33. 纯前端 MVP 架构

最终架构：

```text
静态前端
  ↓
Solana L1 / MagicBlock PER RPC
  ↓
Anchor Program
  ↓
MagicBlock PER Permission Account
```

不需要：

```text
业务后端
数据库
内容存储服务
Indexer
Arweave / Irys / IPFS
```

仍然需要：

```text
Solana RPC
MagicBlock PER RPC
静态前端托管
钱包签名
```

---

## 34. Markdown 正文账户设计

正文适合短文 MVP，建议限制大小。

推荐参数：

```rust
pub const MAX_CONTENT_BYTES: usize = 32 * 1024;
```

私密正文账户：

```rust
#[account]
#[derive(InitSpace)]
pub struct ArticlePrivateContent {
    pub version: u8,
    pub article: Pubkey,
    pub author: Pubkey,
    pub permission: Pubkey,

    pub content_len: u32,
    pub content_hash: [u8; 32],

    #[max_len(MAX_CONTENT_BYTES)]
    pub content: Vec<u8>,

    pub published: bool,
    pub bump: u8,
}
```

说明：

```text
content 存 UTF-8 Markdown bytes。
content_len 表示真实正文长度。
content_hash = sha256(content[0..content_len])。
published = true 后不允许继续修改正文。
```

---

## 35. 文章公开账户设计

公开文章账户只保存文章列表和购买需要的公开信息。

```rust
#[account]
#[derive(InitSpace)]
pub struct Article {
    pub version: u8,
    pub id: u64,
    pub author: Pubkey,

    #[max_len(96)]
    pub title: String,

    #[max_len(280)]
    pub summary: String,

    pub price: u64,
    pub max_purchases: u32,

    pub payment_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub vault_authority: Pubkey,

    pub runtime: Pubkey,
    pub reader_list: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,
    pub per_validator: Pubkey,

    pub content_hash: [u8; 32],
    pub status: u8,

    pub created_at: i64,
    pub updated_at: i64,

    pub bump: u8,
}
```

MVP 状态：

```rust
pub const ARTICLE_DRAFT: u8 = 0;
pub const ARTICLE_ACTIVE: u8 = 1;
pub const ARTICLE_DISABLED: u8 = 2;
```

---

## 36. 购买和分润运行态账户

购买、分润、claim 相关状态放在运行态账户中。

```rust
#[account]
pub struct ArticleRuntime {
    pub version: u8,
    pub article: Pubkey,

    pub purchase_count: u32,
    pub total_paid: u64,

    pub acc_reward_per_reader: u128,

    pub author_pending: u64,
    pub author_claimed: u64,

    pub platform_pending: u64,
    pub platform_claimed: u64,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,

    pub status: u8,
    pub bump: u8,
}
```

读者列表：

```rust
#[account]
pub struct ReaderList {
    pub version: u8,
    pub article: Pubkey,
    pub reader_count: u32,
    pub max_readers: u32,

    pub readers: Vec<Pubkey>,
    pub reward_debts: Vec<u128>,
    pub claimed_rewards: Vec<u64>,

    pub bump: u8,
}
```

`claimed_rewards` 用于纯前端展示已领取金额。

前端可直接计算：

```text
reader_index = readers.indexOf(wallet)

claimable =
  (runtime.acc_reward_per_reader - reward_debts[reader_index]) / PRECISION

claimed = claimed_rewards[reader_index]

total_received = claimed + claimable
```

---

## 37. PDA 设计

```text
GlobalConfig:
["global_config"]

Article:
["article", article_id_le_bytes]

ArticleRuntime:
["runtime", article.key()]

ReaderList:
["reader_list", article.key()]

ArticlePrivateContent:
["content", article.key()]

VaultAuthority:
["vault_authority", article.key()]
```

---

## 38. 发布文章流程

纯前端发布文章：

```text
1. 作者输入 title、summary、Markdown 正文、价格、最大购买数。
2. 前端用 TextEncoder 将 Markdown 转成 UTF-8 bytes。
3. 前端校验 bytes.length <= MAX_CONTENT_BYTES。
4. 前端计算 content_hash = sha256(bytes)。
5. 调用 create_article 创建公开 Article、Runtime、ReaderList、PrivateContent 空账户。
6. 创建或绑定 MagicBlock Permission Account。
7. delegate ArticlePrivateContent、ArticleRuntime、ReaderList 到 MagicBlock PER。
8. 前端分 chunk 调用 write_content_chunk 写入 Markdown bytes。
9. 调用 publish_article 设置 content_len、content_hash、published = true。
10. Article.status 从 draft 变为 active。
```

写入正文必须分片：

```text
write_content_chunk(offset = 0, chunk = bytes[0..800])
write_content_chunk(offset = 800, chunk = bytes[800..1600])
...
publish_article(content_len, content_hash)
```

合约校验：

```text
signer == article.author
content.published == false
offset + chunk.len <= MAX_CONTENT_BYTES
```

---

## 39. 购买后自动显示文章

购买指令建议在 MagicBlock PER 中执行，确保付款、分润更新、阅读授权是原子的。

```text
buy_article
  1. 校验文章 active。
  2. 校验 buyer != author。
  3. 校验未售罄。
  4. 校验 buyer 未购买过。
  5. SPL Token 从 buyer token account 转到文章 vault token account。
  6. 更新 ArticleRuntime 分润状态。
  7. buyer 加入 ReaderList。
  8. CPI 调 MagicBlock Permission Program。
  9. buyer 加入 ArticlePrivateContent 的 permission members。
  10. emit ArticlePurchased。
```

交易成功后，前端立即执行：

```text
1. 重新 fetch ReaderList，确认当前钱包已购买。
2. 钱包签名获取 MagicBlock auth token。
3. 用 auth token 连接 PER RPC。
4. fetch ArticlePrivateContent。
5. PER 校验 buyer 是 permission member。
6. 返回 content bytes。
7. 前端 TextDecoder 解成 Markdown。
8. 前端用 Markdown renderer 展示正文。
```

前端状态：

```text
未连接钱包：显示连接钱包
未购买：显示 summary 和购买按钮
购买中：显示交易状态
购买成功：自动读取 PER 正文
已购买：直接显示 Markdown 正文
读取失败：显示重试读取
```

---

## 40. 分润展示和 Claim

读者收益无需后端，直接从链上账户计算。

前端读取：

```text
ArticleRuntime.acc_reward_per_reader
ReaderList.readers
ReaderList.reward_debts
ReaderList.claimed_rewards
```

找到当前钱包：

```text
reader_index = readers.indexOf(wallet)
```

计算：

```text
claimable =
  (acc_reward_per_reader - reward_debts[reader_index]) / PRECISION

claimed = claimed_rewards[reader_index]

total_received = claimed + claimable
```

展示：

```text
我的购买排名
累计收到分润 total_received
已提取 claimed
当前可提取 claimable
Claim 按钮
```

`claim_reader_reward(reader_index)`：

```text
1. 校验 readers[reader_index] == signer。
2. 计算 claimable。
3. vault 转 token 给 signer。
4. reward_debts[reader_index] += claimable * PRECISION。
5. claimed_rewards[reader_index] += claimable。
6. emit ReaderRewardClaimed。
```

作者展示：

```text
author_pending
author_claimed
claim_author_revenue 按钮
```

平台展示：

```text
platform_pending
platform_claimed
claim_platform_fee 按钮
```

---

## 41. MVP 约束

为了保证无后端版本可控，MVP 约束如下：

```text
1. 正文最大 32KB Markdown。
2. 图片、视频只作为 URL 写入 Markdown。
3. 不做搜索、推荐、复杂历史收益明细。
4. 文章列表通过 GlobalConfig.article_count 逐个 derive PDA 读取。
5. 购买和授权必须在同一个 PER 交易中完成。
6. ArticlePrivateContent 不应 undelegate/commit 成公开可读状态。
7. 用户购买后仍然可以复制、截图、转发正文；PER 只能阻止未购买用户读取。
```

最终一句话：

```text
MVP 使用 MagicBlock PER 直接保存 Markdown 正文，并用 Permission Account 做阅读权限；购买交易成功后自动把买家加入权限成员，前端立即读取 PER 正文并渲染，同时所有分润和 claim 金额都由链上账户直接计算。
```

---

## 42. 前端 MVP 页面结构

前端是纯静态 dApp，不依赖业务后端。

推荐页面：

```text
/                    文章列表
/articles/:id         文章详情、购买、阅读
/write                作者写文章
/me/purchases         我的购买
/me/rewards           我的分润
/author               作者后台
/admin                平台后台，可选
```

MVP 也可以先合并为四个主页面：

```text
文章列表
写文章
文章详情
我的分润
```

全局前端依赖：

```text
钱包连接
Solana base layer connection
MagicBlock PER connection
Anchor program client
Markdown editor
Markdown renderer
```

---

## 43. 文章列表页

目标：

```text
展示所有已发布文章，让用户进入详情页购买或阅读。
```

数据来源：

```text
GlobalConfig.article_count
Article PDA
ArticleRuntime PDA
ReaderList PDA，可选
```

无后端情况下，前端用 `article_count` 枚举文章：

```text
1. fetch GlobalConfig。
2. 读取 article_count。
3. for id in 0..article_count:
   - derive Article PDA = ["article", id_le_bytes]
   - fetch Article
   - 过滤 status == ARTICLE_ACTIVE
4. 对每篇文章 derive Runtime PDA。
5. fetch ArticleRuntime 获取 purchase_count、total_paid。
6. 渲染列表。
```

列表展示字段：

```text
标题 title
简介 summary
作者 author
价格 price
购买人数 purchase_count / max_purchases
是否售罄
创建时间 created_at
```

如果钱包已连接，可以额外展示：

```text
我是否已购买
我的购买排名
我在这篇文章的可提分润
```

判断是否购买：

```text
1. fetch ReaderList。
2. readers.indexOf(wallet)。
3. index >= 0 表示已购买。
```

列表页性能策略：

```text
MVP 文章少，直接逐个 fetch。
文章多后再引入 indexer 或事件索引。
```

---

## 44. 作者写文章页

目标：

```text
作者直接在前端写 Markdown，并发布到 MagicBlock PER。
```

表单字段：

```text
标题 title，最多 96 字符
简介 summary，最多 280 字符
价格 price
最大购买数 max_purchases
Markdown 正文 content，最多 32KB bytes
```

Markdown 正文可以包含图片、视频 URL：

```md
![图片](https://example.com/image.png)

<video src="https://example.com/video.mp4" controls></video>
```

前端发布前校验：

```text
title 不为空
summary 不为空
price >= min_price
max_purchases > 0
max_purchases <= max_purchases_limit
content bytes.length <= MAX_CONTENT_BYTES
```

前端计算：

```text
content_bytes = TextEncoder.encode(markdown)
content_hash = sha256(content_bytes)
```

发布交易流程：

```text
1. 调用 create_article。
   - 创建 Article
   - 创建 ArticleRuntime
   - 创建 ReaderList
   - 创建 ArticlePrivateContent 空账户
   - 创建 VaultAuthority / vault token account

2. 创建或绑定 MagicBlock Permission Account。

3. delegate ArticlePrivateContent、ArticleRuntime、ReaderList 到 MagicBlock PER。

4. 前端按 chunk 调用 write_content_chunk。

5. 调用 publish_article。
   - 设置 content_len
   - 校验 content_hash
   - 设置 published = true
   - 设置 Article.status = active
```

Chunk 建议：

```text
每片 500-900 bytes。
每次写入后更新进度条。
失败后从最后成功 offset 重试。
```

作者写文章页展示状态：

```text
草稿编辑中
创建链上账户中
Delegating 到 PER
上传 Markdown chunk 进度
发布完成
发布失败和重试
```

---

## 45. 文章详情、购买和阅读页

目标：

```text
用户看到公开信息，购买后自动显示私密 Markdown 正文。
```

页面数据：

```text
Article
ArticleRuntime
ReaderList
ArticlePrivateContent，只有有权限时可读
```

详情页公开展示：

```text
标题
简介
作者
价格
购买人数 / 最大购买数
是否售罄
当前钱包是否已购买
```

购买按钮状态：

```text
未连接钱包：连接钱包
作者本人：不能购买自己的文章
已购买：显示阅读
售罄：已售罄
文章 disabled：不可购买
可购买：显示购买按钮
```

购买交易：

```text
buy_article
  1. SPL Token 从 buyer token account 转入文章 vault token account。
  2. 更新 ArticleRuntime 分润。
  3. buyer 加入 ReaderList。
  4. buyer 加入 ArticlePrivateContent permission members。
```

购买成功后的前端动作：

```text
1. refetch ArticleRuntime。
2. refetch ReaderList。
3. 获取 MagicBlock auth token。
4. fetch ArticlePrivateContent。
5. 读取 content[0..content_len]。
6. TextDecoder 解成 Markdown。
7. 校验 sha256(bytes) == content_hash。
8. 渲染 Markdown。
```

阅读时的状态：

```text
未购买：不请求 ArticlePrivateContent
已购买：请求 ArticlePrivateContent
读取中：显示 loading
读取失败：显示重试读取
权限未同步：延迟后重试
读取成功：显示 Markdown
```

Markdown 渲染要求：

```text
支持标题、列表、引用、代码块、链接、图片。
允许 video 标签时必须做 sanitizer 白名单。
所有外链使用 rel="noopener noreferrer"。
```

安全说明：

```text
买家读取到 Markdown 后，可以复制、截图或转发。
PER 只能阻止未购买用户读取正文账户。
```

---

## 46. 我的购买页

目标：

```text
展示当前钱包买过哪些文章，并提供继续阅读入口。
```

无后端实现：

```text
1. fetch GlobalConfig.article_count。
2. 枚举所有 Article。
3. 对每篇文章 fetch ReaderList。
4. 如果 readers 包含当前钱包，则加入我的购买列表。
```

展示字段：

```text
文章标题
作者
购买排名 reader_index + 1
价格
购买人数
当前可提分润
已提取分润
阅读按钮
Claim 按钮
```

当前可提分润计算：

```text
reader_index = readers.indexOf(wallet)

claimable =
  (runtime.acc_reward_per_reader - reward_debts[reader_index]) / PRECISION
```

---

## 47. 我的分润页

目标：

```text
读者能看到自己在每篇已购买文章里具体拿到了多少分润，以及每篇文章当前可提取多少。
```

数据来源：

```text
Article
ArticleRuntime
ReaderList
```

前端枚举逻辑：

```text
1. fetch GlobalConfig.article_count。
2. 枚举所有 Article。
3. 对每篇文章 fetch ReaderList。
4. 找当前钱包 reader_index。
5. 如果 reader_index >= 0：
   - fetch ArticleRuntime
   - 计算 claimable
   - 读取 claimed_rewards[reader_index]
   - 计算 total_received
6. 按 claimable 或 total_received 排序展示。
```

每篇文章展示：

```text
文章标题
文章作者
我的购买排名
当前购买人数
最大购买人数
已提取分润 claimed
当前可提取分润 claimable
累计分润 total_received
Claim 按钮
阅读按钮
```

计算公式：

```text
claimable =
  (runtime.acc_reward_per_reader - reader_list.reward_debts[reader_index]) / PRECISION

claimed =
  reader_list.claimed_rewards[reader_index]

total_received =
  claimed + claimable
```

Claim 流程：

```text
1. 用户点击某篇文章的 Claim。
2. 前端调用 claim_reader_reward(article, reader_index)。
3. 合约校验 reader_list.readers[reader_index] == signer。
4. 合约从 vault 转账给用户。
5. 更新 reward_debts 和 claimed_rewards。
6. 前端 refetch 该文章的 Runtime 和 ReaderList。
7. UI 中 claimable 归零，claimed 增加。
```

批量 Claim 可后续扩展。

MVP 先做单篇 Claim，降低交易复杂度。

---

## 48. 作者后台页

目标：

```text
作者查看自己发布的文章，以及每篇文章可提取收入。
```

无后端实现：

```text
1. 枚举所有 Article。
2. 过滤 article.author == wallet。
3. fetch ArticleRuntime。
4. 展示作者收入和文章状态。
```

展示字段：

```text
文章标题
价格
购买人数 / 最大购买数
总销售额 total_paid
作者已提取 author_claimed
作者当前可提取 author_pending
Claim 作者收入按钮
```

Claim 作者收入：

```text
claim_author_revenue(article)
  - 校验 signer == article.author
  - 转出 runtime.author_pending
  - author_claimed += amount
  - author_pending = 0
```

---

## 49. 前端数据 Hook 建议

为了避免页面重复实现，建议拆这些 hooks：

```text
useGlobalConfig()
useArticles()
useArticle(articleId)
useArticleRuntime(article)
useReaderList(article)
useMyReaderPosition(article, wallet)
useMyArticleReward(article, wallet)
usePrivateContent(article, wallet)
useBuyArticle(article)
useClaimReaderReward(article)
useCreateArticle()
useWriteContentChunks()
```

`useMyArticleReward` 输出：

```ts
type MyArticleReward = {
  readerIndex: number | null;
  rank: number | null;
  claimed: bigint;
  claimable: bigint;
  totalReceived: bigint;
  canClaim: boolean;
};
```

`usePrivateContent` 只在已购买时执行：

```text
1. 检查 readerIndex。
2. 获取 MagicBlock auth token。
3. fetch ArticlePrivateContent。
4. decode Markdown。
```

---

## 50. MVP 前端优先级

第一阶段只做：

```text
1. 钱包连接
2. 文章列表
3. 作者写文章
4. 文章详情
5. 购买文章
6. 购买后读取 Markdown
7. 我的分润页
8. 单篇 claim_reader_reward
```

第二阶段再做：

```text
作者后台
平台后台
批量 claim
文章搜索
文章筛选
收益历史明细
草稿本地保存
Markdown 预览增强
```

---

## 51. MVP 最新收敛：SOL-only + PurchaseReceipt

当前 MVP 最终约束：

```text
1. 只支持 SOL 支付。
2. 暂不支持 SPL Token / USDC。
3. 暂不做社交功能。
4. 文章正文仍然直接存 MagicBlock PER。
5. 正文格式是 Markdown bytes。
6. 图片、视频只作为 URL 写入 Markdown。
7. 不使用后端、数据库、Indexer、Arweave、Irys、IPFS。
8. 前端直接读取合约账户展示文章。
9. 作者发布完成后允许通过程序更新正文。
10. 不再使用 ReaderList 存所有读者公钥数组。
```

之前设计中的 `ReaderList` 可以移除。

原因：

```text
MagicBlock Permission Account 已经负责阅读权限控制。
分润只需要记录每个读者自己的购买凭证和 reward_debt。
```

因此改成：

```text
每个读者每篇文章一个 PurchaseReceipt PDA。
```

这样不需要一个文章账户里存 1000 个 Pubkey，也不需要遍历读者列表。

---

## 52. 最新链上账户设计

### GlobalConfig

```rust
#[account]
pub struct GlobalConfig {
    pub version: u8,
    pub admin: Pubkey,
    pub platform_fee_receiver: Pubkey,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,

    pub min_price_lamports: u64,
    pub max_purchases_limit: u32,

    pub article_count: u64,
    pub paused: bool,
    pub bump: u8,
}
```

默认参数：

```text
platform_fee_bps = 1000
reward_bps = 4000
author_bps = 5000
min_price_lamports = 10_000_000
max_purchases_limit = 1000
```

约束：

```text
platform_fee_bps + reward_bps + author_bps == 10000
max_purchases_limit > 0
```

---

### Article

公开文章账户。

```rust
#[account]
pub struct Article {
    pub version: u8,
    pub id: u64,
    pub author: Pubkey,

    pub title: String,
    pub summary: String,

    pub price_lamports: u64,
    pub max_purchases: u32,
    pub purchase_count: u32,

    pub vault: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,

    pub total_paid: u64,
    pub acc_reward_per_reader: u128,

    pub author_pending: u64,
    pub author_claimed: u64,

    pub platform_pending: u64,
    pub platform_claimed: u64,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,

    pub content_hash: [u8; 32],
    pub content_version: u32,

    pub status: u8,
    pub created_at: i64,
    pub updated_at: i64,

    pub bump: u8,
    pub vault_bump: u8,
}
```

状态：

```rust
pub const ARTICLE_DRAFT: u8 = 0;
pub const ARTICLE_ACTIVE: u8 = 1;
pub const ARTICLE_DISABLED: u8 = 2;
```

说明：

```text
Article 是前端展示文章列表和详情的核心账户。
purchase_count 直接保存在 Article 上。
acc_reward_per_reader 也是 Article 的全局累计奖励指数。
```

---

### PurchaseReceipt

每个读者每篇文章一个购买凭证。

```rust
#[account]
pub struct PurchaseReceipt {
    pub version: u8,
    pub article: Pubkey,
    pub reader: Pubkey,

    pub purchase_index: u32,
    pub paid_lamports: u64,

    pub reward_debt: u128,
    pub claimed_rewards: u64,

    pub access_granted: bool,

    pub purchased_at: i64,
    pub bump: u8,
}
```

用途：

```text
1. 证明 reader 买过 article。
2. 记录购买排名 purchase_index。
3. 记录 reward_debt。
4. 记录已领取分润 claimed_rewards。
5. 记录 MagicBlock 阅读权限是否已授予 access_granted。
```

前端判断是否购买：

```text
derive PurchaseReceipt PDA = ["receipt", article.key(), wallet.key()]
fetch receipt
存在则表示已购买
不存在则表示未购买
```

---

### ArticlePrivateContent

MagicBlock PER 私密正文账户。

```rust
pub const MAX_CONTENT_BYTES: usize = 32 * 1024;

#[account]
pub struct ArticlePrivateContent {
    pub version: u8,
    pub article: Pubkey,
    pub author: Pubkey,
    pub permission: Pubkey,

    pub content_len: u32,
    pub content_hash: [u8; 32],
    pub content_version: u32,

    pub content: Vec<u8>,

    pub published: bool,
    pub bump: u8,
}
```

说明：

```text
content 存 Markdown UTF-8 bytes。
content_len 是真实长度。
content_hash = sha256(content[0..content_len])。
content_version 每次正式更新正文后递增。
```

---

## 53. 最新 PDA 设计

```text
GlobalConfig:
["global_config"]

Article:
["article", article_id_le_bytes]

ArticleVault:
["vault", article.key()]

ArticlePrivateContent:
["content", article.key()]

PurchaseReceipt:
["receipt", article.key(), reader.key()]
```

`ArticleVault` 是程序控制的 SOL vault。

claim 时必须保留 rent-exempt 最小余额，不能把 vault lamports 全部转空。

---

## 54. SOL 支付和购买授权流程

MVP 只支持 SOL。

购买分成两个可恢复步骤：

```text
1. buy_article
2. grant_access
```

原因：

```text
SOL 支付在主程序里处理更直接。
MagicBlock PER Permission 授权可能涉及 PER 侧调用。
为了避免授权失败导致状态不可恢复，将授权设计成可重试。
```

### buy_article

```text
1. 校验 config.paused == false。
2. 校验 article.status == active。
3. 校验 buyer != article.author。
4. 校验 article.purchase_count < article.max_purchases。
5. 校验 PurchaseReceipt 不存在，防止重复购买。
6. buyer 支付 price_lamports 到 ArticleVault。
7. 计算平台费、作者收益、读者奖励池。
8. 更新 article.author_pending。
9. 更新 article.platform_pending。
10. 更新 article.acc_reward_per_reader。
11. 创建 PurchaseReceipt。
12. article.purchase_count += 1。
13. article.total_paid += price_lamports。
14. emit ArticlePurchased。
```

购买后的 receipt：

```text
purchase_index = article.purchase_count 购买前的值
paid_lamports = article.price_lamports
reward_debt = article.acc_reward_per_reader
claimed_rewards = 0
access_granted = false
```

### grant_access

```text
1. 校验 PurchaseReceipt 存在。
2. 校验 receipt.reader == signer。
3. 校验 receipt.article == article.key()。
4. 调用 MagicBlock Permission，把 signer 加入 ArticlePrivateContent 的 permission members。
5. receipt.access_granted = true。
6. emit ArticleAccessGranted。
```

如果用户已经付款但授权失败，前端显示：

```text
激活阅读权限
```

用户可以重复调用 `grant_access`，直到成功。

这样可以避免：

```text
用户已付费但永远无法阅读。
```

---

## 55. 最新分润计算

常量：

```rust
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const PRECISION: u128 = 1_000_000_000_000;
```

购买时：

```text
platform_fee = price * platform_fee_bps / 10000
reward_pool = price * reward_bps / 10000
author_amount = price - platform_fee - reward_pool
```

第一笔购买：

```text
author_pending += author_amount + reward_pool
platform_pending += platform_fee
acc_reward_per_reader 不变
```

第二笔及之后购买：

```text
previous_reader_count = article.purchase_count
acc_reward_per_reader += reward_pool * PRECISION / previous_reader_count
author_pending += author_amount
platform_pending += platform_fee
```

创建当前买家的 `PurchaseReceipt`：

```text
reward_debt = article.acc_reward_per_reader
```

这样当前买家不会获得自己这笔购买产生的奖励。

---

## 56. 读者查看每篇文章可提分润

前端不需要 ReaderList。

对某篇文章和当前钱包：

```text
receipt_pda = ["receipt", article.key(), wallet.key()]
```

如果 receipt 存在：

```text
说明当前钱包买过这篇文章。
```

可提取金额：

```text
claimable =
  (article.acc_reward_per_reader - receipt.reward_debt) / PRECISION
```

已领取金额：

```text
claimed = receipt.claimed_rewards
```

累计获得分润：

```text
total_received = claimed + claimable
```

展示：

```text
文章标题
购买排名 purchase_index + 1
已领取 claimed
当前可提 claimable
累计分润 total_received
Claim 按钮
```

---

## 57. claim_reader_reward

```text
1. 校验 receipt.article == article.key()。
2. 校验 receipt.reader == signer。
3. 计算 claimable。
4. claimable > 0。
5. ArticleVault 转 SOL 给 signer。
6. receipt.reward_debt += claimable * PRECISION。
7. receipt.claimed_rewards += claimable。
8. emit ReaderRewardClaimed。
```

注意：

```text
不要直接把 receipt.reward_debt 设置为 article.acc_reward_per_reader。
推荐增量更新 reward_debt += claimable * PRECISION。
这样可以保留整数除法产生的小数残差。
```

---

## 58. 作者更新正文

MVP 允许作者发布完成后更新正文，但必须通过程序更新。

规则：

```text
只有 article.author 可以更新。
article.status != disabled。
新正文 bytes.length <= MAX_CONTENT_BYTES。
更新后必须更新 content_hash。
content_version += 1。
updated_at = now。
```

推荐更新流程：

```text
1. begin_update_content
   - 校验 signer == author
   - 设置更新状态
   - 可选择清空 content_len

2. write_content_chunk
   - 按 offset 写入新 Markdown bytes
   - 允许覆盖目标区间

3. publish_content_update
   - 设置 content_len
   - 校验 content_hash
   - Article.content_hash = new_hash
   - Article.content_version += 1
   - ArticlePrivateContent.content_version += 1
   - updated_at = now
```

前端必须展示：

```text
当前正文版本 content_version
最后更新时间 updated_at
```

MVP 不保存历史版本。

风险：

```text
已购买用户看到的是文章最新版本。
作者可以修改已售文章内容。
MVP 接受这个取舍。
```

---

## 59. 前端读取所有文章

前端可以直接读取所有文章账户。

推荐 MVP 方式：

```text
1. fetch GlobalConfig。
2. 读取 article_count。
3. for id in 0..article_count:
   - derive Article PDA
   - fetch Article
4. 过滤 status == ARTICLE_ACTIVE。
```

也可以使用 Anchor：

```ts
program.account.article.all();
```

或底层 RPC：

```text
getProgramAccounts(program_id, filters)
```

注意：

```text
Solana RPC 不能直接按 PDA seed 前缀查询账户。
如果要查所有 Article，应该使用 article_count 枚举，或者 getProgramAccounts + discriminator filter。
```

MVP 文章数量少，使用 `article_count` 枚举最简单。

---

## 60. MVP 最小功能清单

只实现：

```text
1. initialize_config
2. 作者发布 Markdown 文章
3. 作者更新 Markdown 正文
4. 前端展示文章列表
5. 前端展示文章详情
6. 用户购买文章
7. 用户购买后 grant_access 激活阅读权限
8. 用户读取 MagicBlock PER Markdown 正文
9. 用户查看每篇文章自己的可提分润
10. 用户 claim_reader_reward
11. 作者 claim_author_revenue
12. 平台 claim_platform_fee
```

暂时不做：

```text
评论
点赞
收藏
关注
推荐
搜索
标签
收益历史明细
批量 claim
文章版本历史
图片上传
视频上传
外部内容存储
后端服务
Indexer
二级转让阅读权
```

---

## 61. 当前设计的关键取舍

当前 MVP 的最终模型：

```text
Article 管文章公开信息、SOL 分润累计、购买数量。
PurchaseReceipt 管单个读者是否购买、购买排名、分润 debt、已领取金额。
ArticlePrivateContent 管 MagicBlock PER 私密 Markdown 正文。
MagicBlock Permission Account 管谁能读取正文。
```

最重要的恢复逻辑：

```text
购买成功但 grant_access 失败时，用户可以再次调用 grant_access。
```

这样虽然购买和授权不是完全原子，但不会造成用户永久无法阅读。

---

## 62. MagicBlock PER devnet 双连接落地路径

真实 MagicBlock PER 上不能把未 delegated 的 base layer 公共账户当作 writable 发送到 PER。

因此 devnet/PER 集成采用双层拆分：

```text
Base layer:
  create_article
  create_content_permission
  reserve_content_capacity
  delegate Permission Account
  delegate_content

PER:
  write_content_chunk
  publish_private_content

Base layer:
  finalize_article_publish
  buy_article

PER:
  grant_per_access

Base layer:
  mark_access_granted
```

规则：

```text
PER 指令只修改 ArticlePrivateContent 和 Permission Account。
Base layer 指令只修改 Article、PurchaseReceipt、ArticleVault 等公开资金状态。
```

`reserve_content_capacity` 必须在 delegation 前调用，用 base layer SOL 支付 rent。
这样 PER 上的 `write_content_chunk` 不需要 realloc，也不会修改未 delegated 的 fee payer 账户。

公开 PER devnet 默认 endpoint：

```text
https://devnet-tee.magicblock.app
```

前端/脚本需要先通过钱包签名获取 auth token，然后使用：

```text
https://devnet-tee.magicblock.app?token=<authToken>
```

对于 MVP，`finalize_article_publish` 只同步公开 Article 状态；正文 hash 已由 `publish_private_content` 在 PER 内对私有 Markdown bytes 校验。

---

## 63. 前端 devnet 双 RPC 客户端边界

前端生产路径使用两个 RPC：

```text
Solana devnet RPC:
  list Article / PurchaseReceipt
  buy_article
  mark_access_granted
  claim_reader_reward
  claim_author_revenue
  claim_platform_fee

MagicBlock PER RPC:
  grant_per_access
  read ArticlePrivateContent
```

前端不需要后端或 indexer。文章列表先读取 `GlobalConfig.article_count`，再枚举最近的 Article PDA。

阅读私有正文时，钱包先签名获取 MagicBlock auth token，然后前端从 PER RPC 读取 `ArticlePrivateContent.content[0..content_len]`，用 `TextDecoder` 解码 Markdown。

购买恢复路径：

```text
buy_article 成功但 grant_per_access 或 mark_access_granted 失败:
  前端显示 Continue PER grant
  用户再次提交 grant_per_access
  成功后提交 mark_access_granted
```

`publish_content` 和 `grant_access` 只保留给 LiteSVM、本地 validator、mock Permission Program 的单层测试路径。
真实 devnet/PER 前端必须使用拆分后的：

```text
publish_private_content + finalize_article_publish
grant_per_access + mark_access_granted
```

---

## 64. 产品路线图

### 64.1 当前已实现（MVP v0.1）

**核心功能：**
```text
✅ 文章创建
   - Markdown 正文直接存入 MagicBlock PER 单个隐私账户
   - 标题、简介公开存储在 Article 账户
   - MagicBlock Permission Account 控制阅读权限

✅ 购买与支付
   - SOL 支付购买文章
   - 资金进入 ArticleVault 链上金库
   - PurchaseReceipt 记录购买凭证

✅ 分润机制
   - 平台 10% / 作者 50% / 早期读者 40%
   - 第一笔购买读者奖励归作者
   - 累计奖励指数（acc_reward_per_reader）实现精确分润

✅ 收益提取
   - claim_reader_reward：读者提取早期奖励
   - claim_author_revenue：作者提取收入
   - claim_platform_fee：平台提取手续费

✅ 前端页面
   - 文章列表页（枚举 Article）
   - 文章详情页
   - 购买与阅读页
   - 我的分润页
```

**技术约束：**
```text
⚠️ 单篇文章最大 32KB
⚠️ 正文存储在单个 ArticlePrivateContent 账户
⚠️ 文章列表通过 article_count 枚举（性能随文章数增长下降）
⚠️ 只支持 SOL 支付
⚠️ 不支持历史版本
```

---

### 64.2 短期优化（v0.2）

**文章大小优化 - 多账户存储方案：**

当前问题：单个隐私账户存储能力有限，文章过长会导致上传失败。

解决方案：将文章正文拆分并委托到多个隐私账户。

**新账户设计：**

```rust
#[account]
pub struct ArticleContentChunk {
    pub version: u8,
    pub article: Pubkey,
    pub permission: Pubkey,

    pub chunk_index: u32,
    pub chunk_size: u32,
    pub total_chunks: u32,

    #[max_len(CHUNK_SIZE)]
    pub content: Vec<u8>,

    pub content_hash: [u8; 32],
    pub bump: u8,
}

#[account]
pub struct ArticleContentIndex {
    pub version: u8,
    pub article: Pubkey,
    pub permission: Pubkey,

    pub total_chunks: u32,
    pub total_size: u32,
    pub content_hash: [u8; 32],

    pub chunk_accounts: Vec<Pubkey>,
    pub bump: u8,
}
```

**参数配置：**

```rust
pub const CHUNK_SIZE: usize = 10 * 1024; // 每个账户 10KB
pub const MAX_CHUNKS: u32 = 50;          // 最多 50 个账户
// 最大文章大小：10KB * 50 = 500KB
```

**发布流程更新：**

```text
1. create_article_with_chunks
   - 创建 Article
   - 创建 ArticleContentIndex（记录所有 chunk 信息）
   - 预创建指定数量的 ArticleContentChunk 空账户

2. delegate_all_chunks
   - 将 ArticleContentIndex 和所有 Chunk 账户委托到 PER

3. write_content_chunks（前端循环调用）
   - 按 CHUNK_SIZE 切分 Markdown
   - 逐个写入 chunk 账户
   - 更新 ArticleContentIndex 中的 chunk_accounts 列表

4. publish_chunked_content
   - 设置 total_chunks、total_size
   - 校验整体 content_hash
   - 设置 published = true
```

**阅读流程更新：**

```text
1. 读取 ArticleContentIndex
2. 按 chunk_index 顺序读取所有 ArticleContentChunk
3. 拼接完整 Markdown bytes
4. TextDecoder 解码并渲染
```

**优势：**
```text
✅ 支持最大 500KB 文章（可扩展）
✅ 单个账户失败不影响其他账户
✅ 前端可并行读取多个 chunk（提升加载速度）
✅ 后续可支持增量更新单个 chunk
```

---

**文章列表优化 - 分页索引方案：**

当前问题：通过 article_count 枚举所有文章，随着文章数量增长性能下降。

解决方案：使用链上分页索引账户。

**账户设计：**

```rust
#[account]
pub struct ArticleIndexPage {
    pub version: u8,
    pub page_index: u32,
    pub article_count: u32,
    pub max_articles: u32,

    pub articles: Vec<Pubkey>,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
pub struct ArticleIndexHeader {
    pub version: u8,
    pub total_pages: u32,
    pub total_articles: u64,
    pub page_capacity: u32,

    pub pages: Vec<Pubkey>,
    pub updated_at: i64,
    pub bump: u8,
}
```

**参数配置：**

```rust
pub const PAGE_CAPACITY: u32 = 100; // 每页 100 篇文章
```

**创建文章时：**

```text
1. 读取 ArticleIndexHeader
2. 找到最后一页
3. 如果最后一页已满（article_count == PAGE_CAPACITY）：
   - 创建新的 ArticleIndexPage
   - 更新 Header.pages 和 total_pages
4. 将新文章 PDA 加入当前页的 articles 数组
5. 更新该页的 article_count 和 updated_at
```

**前端读取文章列表：**

```text
1. 读取 ArticleIndexHeader
2. 知道总页数 total_pages
3. 按需加载指定页数（分页展示）
4. 不需要枚举所有文章
```

**优势：**
```text
✅ 前端分页加载，性能恒定
✅ 支持无限文章数量
✅ 可以实现"最新文章"、"热门文章"等排序索引
✅ 为后续搜索、推荐功能打基础
```

---

### 64.3 中期功能（v0.3 - v0.4）

**支付升级：**
```text
🔄 支持 USDC / USDT 支付
🔄 支持 SPL Token 自定义支付代币
🔄 多币种价格设置（SOL 价格 + USDC 价格）
```

**内容增强：**
```text
🔄 文章版本历史
   - 每次更新创建新版本
   - 已购买用户可选择查看历史版本
   
🔄 草稿箱
   - 本地 + 链上草稿保存
   - 自动保存功能
   
🔄 图片上传
   - 集成 Arweave / Irys / IPFS
   - 图片链接自动插入 Markdown
```

**社交功能：**
```text
🔄 评论系统
   - 链上评论账户
   - 评论点赞
   
🔄 关注作者
   - Follow 关系存储
   - 关注流展示
   
🔄 收藏文章
   - 个人收藏列表
```

**收益优化：**
```text
🔄 批量 Claim
   - 一次交易提取多篇文章收益
   
🔄 收益统计图表
   - 前端可视化展示历史收益
```

---

### 64.4 长期愿景（v1.0+）

**平台升级：**
```text
🌟 二级市场
   - 阅读权转让（NFT 化）
   - 稿件交易市场
   
🌟 订阅制
   - 作者订阅
   - 专栏订阅
   - 月度/年度付费
   
🌟 合作分润
   - 多人协作文章
   - 翻译收益共享
   - 转载授权机制
```

**生态扩展：**
```text
🌟 移动端 App
   - React Native / Flutter 实现
   
🌟 跨链扩展
   - 支持 Ethereum / other EVM 链
   - 跨链内容同步
   
🌟 DAO 治理
   - 平台参数由 DAO 投票决定
   - 收益分配比例社区治理
```

**开发者生态：**
```text
🌟 第三方集成 API
   - 允许外部应用集成阅读功能
   
🌟 插件系统
   - 自定义 Markdown 渲染器
   - 自定义分润逻辑
```

---

### 64.5 技术债务与风险

**当前已知限制：**
```text
⚠️ MagicBlock PER 网络稳定性依赖
⚠️ 用户购买后可复制/截图（PER 只阻止未购买读取）
⚠️ 文章更新机制可能被滥用（作者恶意修改已售内容）
⚠️ 链上存储成本（文章越多，租金越高）
```

**缓解措施：**
```text
✅ MVP 接受上述取舍，优先核心功能落地
✅ 后续通过内容版本历史缓解更新滥用问题
✅ 通过水印、DRM 技术增加泄露成本（但无法完全防止）
✅ 长期考虑混合存储（热门文章链上，冷文章 Arweave）
```

---

### 64.6 优先级排序

**P0 - MVP 必须完成：**
```text
✅ 单账户文章发布与阅读
✅ SOL 购买与分润
✅ 基础前端页面
```

**P1 - v0.2 必须完成：**
```text
🔄 多账户文章存储（解决 32KB 限制）
🔄 分页索引（解决列表性能问题）
```

**P2 - v0.3 按需实现：**
```text
🔄 USDC 支付
🔄 文章版本历史
🔄 批量 Claim
```

**P3 - v1.0+ 长期规划：**
```text
🌟 社交功能
🌟 二级市场
🌟 订阅制
🌟 跨链扩展
```

---

## 65. 商业模式的通用性

### 65.1 核心模式抽象

Fluxor 的商业模式本质上是一种**「有门槛可分发内容的链上市场化机制」**，可以抽象为以下核心要素：

```text
1. 数字内容（付费门槛）
   ├─ Markdown 文章
   ├─ 研究报告
   ├─ 教程/课程
   ├─ 代码库
   ├─ 数据集
   └─ 任何可数字化的有价值内容

2. 隐私保护（技术门槛）
   ├─ MagicBlock PER 存储
   ├─ Permission Account 控制
   └─ 只有付费者可访问

3. 早期读者激励（增长机制）
   ├─ 40% 分给早期读者
   ├─ 越早购买收益越高
   └─ 自传播增长动力

4. 无后端信任（基础设施）
   ├─ 所有状态在链上
   ├─ 智能合约自动分润
   └─ 无需中心化机构
```

这个模式的核心洞察是：**任何「有价值、可分发、需要付费门槛」的数字内容，都可以用这套机制改造。**

---

### 65.2 可应用领域

**知识付费类：**

```text
📚 研究报告
   - 券商研报、行业分析
   - 早期投资者获得后续购买分红
   - 解决「信息不对称」的变现问题

📚 在线课程
   - 视频课程存 PER（或链接 + 访问凭证）
   - 早期学员推广获得持续收益
   - 替代传统 affiliate 分佣

📚 投资策略
   - 量化策略代码
   - 交易信号服务
   - 早期订阅者从后续用户获得收益
```

**开发工具类：**

```text
💻 代码库/框架
   - 付费代码库
   - 企业版代码访问
   - 早期购买者获得长期收益

💻 API 访问
   - 高价值 API（如 AI 模型、数据服务）
   - 访问令牌链上验证
   - 早期用户获得推广收益

💻 设计资源
   - UI 组件库
   - 设计模板
   - 图标/字体资源包
```

**创意内容类：**

```text
🎨 音乐/音频
   - 付费专辑/单曲
   - 播客 Premium 内容
   - 早期听众获得收益

🎨 摄影/图片
   - 高质量图片库
   - Lightroom 预设
   - 视频素材

🎨 游戏内容
   - 游戏攻略
   - Mod/插件
   - 虚拟物品设计图
```

**数据服务类：**

```text
📊 数据集
   - AI 训练数据
   - 行业数据
   - 财务数据

📊 研究数据
   - 科学实验数据
   - 调研报告原始数据
   - 用户行为数据
```

**社区服务类：**

```text
👥 会员社区
   - 付费 Discord/Telegram 访问
   - 邀请制社交网络
   - 早期成员获得推广收益

👥 咨询服务
   - 专家咨询时间
   - 一对一指导
   - 行业内参
```

---

### 65.3 通用化的账户设计

将 Fluxor 的「文章」抽象为「内容资产」，可以设计通用化账户：

```rust
#[account]
pub struct ContentAsset {
    pub version: u8,
    pub asset_type: u8,        // 0=文章, 1=视频, 2=代码, 3=数据...
    pub id: u64,
    pub creator: Pubkey,

    pub title: String,
    pub description: String,
    pub content_format: String, // "markdown", "mp4", "zip", "json"...

    pub price_lamports: u64,
    pub max_sales: u32,
    pub sale_count: u32,

    pub vault: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,

    pub total_paid: u64,
    pub acc_reward_per_buyer: u128,

    pub creator_pending: u64,
    pub creator_claimed: u64,

    pub platform_pending: u64,
    pub platform_claimed: u64,

    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub creator_bps: u16,

    pub content_hash: [u8; 32],
    pub content_version: u32,

    pub status: u8,
    pub created_at: i64,
    pub updated_at: i64,

    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct SalesReceipt {
    pub version: u8,
    pub asset: Pubkey,
    pub buyer: Pubkey,

    pub sale_index: u32,
    pub paid_lamports: u64,

    pub reward_debt: u128,
    pub claimed_rewards: u64,

    pub access_granted: bool,

    pub purchased_at: i64,
    pub bump: u8,
}
```

只需要修改 `asset_type` 和 `content_format`，同一套合约可以支持多种内容类型。

---

### 65.4 不同领域的特殊扩展

**视频内容：**
```text
- 视频文件存 Arweave/Irys（大文件）
- PER 只存访问凭证 + 解密密钥
- 分片支持流式播放
```

**代码库：**
```text
- 代码版本 hash 作为 content_hash
- 支持私有代码仓库访问令牌
- 定期更新机制（订阅制）
```

**API 服务：**
```text
- PER 存访问令牌生成规则
- 每次请求验证令牌有效性
- 按调用次数计费扩展
```

**数据集：**
```text
- 数据集分片存储
- 支持增量更新
- 样本数据公开，完整数据付费
```

---

### 65.5 早期读者激励的通用价值

这个模式最大的创新在于**「早期读者激励」**，它解决了内容创作者的冷启动问题：

```text
传统模式：
创作者发布 → 等待用户购买 → 收入归创作者
问题：没有推广动力

Fluxor 模式：
创作者发布 → 早期用户购买 → 获得推广收益（后续用户分成）
效果：每个早期用户都成为推广者
```

这个机制对任何需要「冷启动」的内容都有效：

```text
📈 研究报告
   - 早期投资者有动力分享给同行
   - 越早买，后续购买越多，收益越高

📈 在线课程
   - 早期学员主动推荐课程
   - 替代传统的 affiliate 分佣

📈 专业工具
   - 早期使用者获得长期收益
   - 解决专业工具的推广问题
```

---

### 65.6 平台化机会

基于这套通用模式，可以构建一个**「内容资产发行平台」**：

```text
核心功能：
✅ 任何创作者都可以发行自己的内容资产
✅ 自定义价格、最大销量、分润比例
✅ 自动化的早期买家激励机制
✅ 链上的透明分润和 claim

平台价值：
🔄 为创作者提供发行工具
🔄 为早期发现者提供投资回报
🔄 为内容市场提供流动性
🔄 完全去中心化、无后端
```

**潜在平台名称：**

```text
- MintPress（内容铸造）
- EarlyAccess（早期访问）
- ContentDAO（内容资产 DAO）
- ValuGate（价值之门）
- FirstMover（先发优势）
```

**平台愿景：**

```text
让任何有价值的内容都可以被资产化、市场化、激励化。
让早期发现者获得持续回报。
让创作者无需担心冷启动。
```

---

### 65.7 与 Web2 模式的对比

| 维度 | Web2 模式 | Fluxor 模式 |
|------|-----------|-----------|
| 内容存储 | 中心化服务器 | 链上 + PER 隐私 |
| 支付 | Stripe / PayPal | 链上 SOL / Token |
| 分润 | 中心化结算 | 智能合约自动 |
| 推广激励 | Affiliate（需平台） | 内置早期读者激励 |
| 信任 | 信任平台 | 信任代码 |
| 全球访问 | 受限 | 无国界 |
| 审查 | 平台可删 | 去中心化 |
| 收益透明 | 不透明 | 完全透明 |

---

### 65.8 最终结论

Fluxor 不仅仅是一个付费文章平台，它是一个**「内容资产化的通用基础设施」**。

理论上，**任何满足以下条件的数字内容都可以用这套机制改造：**

```text
1. ✅ 有价值（用户愿意付费）
2. ✅ 可数字化（可存储、传输）
3. ✅ 需要门槛（不能免费获取）
4. ✅ 可分发（有潜在买家）
5. ✅ 需要冷启动（早期用户需要激励）
```

这个模式的核心创新是：**把「早期买家」变成「推广者」，把「消费行为」变成「投资行为」。**

当用户购买一篇文章时，他不仅是在消费内容，更是在投资这篇文章的传播。如果文章后续卖得好，他就能获得持续收益。

这种机制将**「内容创作」**变成了**「资产发行」**，将**「读者」**变成了**「投资者」**，为 Web3 内容经济提供了一个全新的范式。

---

## 66. 一句话总结

**Fluxor on Solana + MagicBlock PER：无后端付费文章平台，文章正文存 PER 隐私账户，购买和分润在 Solana L1，早期读者自动获得后续买家分红，完全去中心化、无信任后端。**
