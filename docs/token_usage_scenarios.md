# Token Usage Scenarios

One of the most common concerns users have before setting up Secure Smart Sync is:

**"Will I exceed Cloudflare R2's free tier?"**

For the overwhelming majority of users, the answer is **no**.

## Cloudflare R2 Free Tier

Every Cloudflare R2 account includes:

- **10 GB free object storage**
- **1 million Class A operations/month**
- **10 million Class B operations/month**
- **Unlimited free egress bandwidth**

### What are Class A operations?

These are write-heavy operations:

- `PUT` → uploading files
- `DELETE` → deleting files
- `LIST` → scanning remote vault files

These are more limited because they are more resource-intensive.

### What are Class B operations?

These are read-heavy operations:

- `GET` → downloading files
- `HEAD` → checking file existence / metadata
- Sentinel polling checks

These have significantly higher limits.

---

# What Happens During One Full Sync Cycle?

Example:

You edit a file on Device A → Device B detects changes → Device B edits something → Device A detects changes.

This represents a complete two-device sync cycle.

## Device A writes → sync push

For one file change:

### Class A
- `1× LIST` → remote vault scan
- `1× PUT` → upload changed file
- `1× PUT` → update sentinel

**Total: 3 Class A**

### Class B
- `1× HEAD` → connection check
- `1× HEAD` → ETag verification

**Total: 2 Class B**

## Device B detects → state-aware pull

For one file change:

### Class A
- `1× LIST` → remote vault scan

**Total: 1 Class A**

### Class B
- `1× HEAD` → sentinel detects change
- `1× GET` → read sentinel
- `1× GET` → download changed file
- `1× HEAD` → connection check

**Total: 4 Class B**

## Device B writes → sync push

Same as Device A push:

- **3 Class A**
- **2 Class B**

## Device A detects → state-aware pull

Same as Device B pull:

- **1 Class A**
- **4 Class B**

# Full Two Device Sync Cycle Total

For both devices editing one file each:

| Action | Class A | Class B |
|---------|----------|----------|
| Device A Push | 3 | 2 |
| Device B Pull | 1 | 4 |
| Device B Push | 3 | 2 |
| Device A Pull | 1 | 4 |
| **Total** | **8** | **12** |

## Background Polling

This does **not** include background sentinel polling.

Polling runs independently using default settings:

- Active: every 2 seconds
- Idle: every 30 seconds

These polling requests are all **Class B HEAD operations**.

For most users, polling still remains comfortably within free-tier limits.

---

# Real Usage Scenarios

## Scenario 1 — Student / Casual User

**Devices:** 2  
**Vault Size:** Under 1,000 files  
**Daily Usage:** 1–3 hours/day  

### Estimated Monthly Usage

- Class A: ~15,000–40,000  
- Class B: ~300,000–900,000  

### Free Tier Usage

- Class A → **1.5%–4%**
- Class B → **3%–9%**

### Recommended Device Count

Up to **5 devices** is generally safe.

---

## Scenario 2 — Writer / Researcher

**Devices:** 2–3  
**Vault Size:** 2,000–5,000 files  
**Daily Usage:** 3–6 hours/day  

### Estimated Monthly Usage

- Class A: ~50,000–180,000  
- Class B: ~1M–3M  

### Free Tier Usage

- Class A → **5%–18%**
- Class B → **10%–30%**

### Recommended Device Count

Up to **4 devices** recommended.

---

## Scenario 3 — Power User

**Devices:** 4–5  
**Vault Size:** 5,000+ files  
**Daily Usage:** 6–8 hours/day  

### Estimated Monthly Usage

- Class A: ~250,000–600,000  
- Class B: ~3M–6M  

### Free Tier Usage

- Class A → **25%–60%**
- Class B → **30%–60%**

### Recommended Device Count

Up to **3 devices** recommended for large vaults.

---

## Scenario 4 — Extreme Edge Case

**Devices:** 5+  
**Vault Size:** 10,000+ files  
**Daily Usage:** 8+ hours/day  
**Frequent cross-device switching**

### Estimated Monthly Usage

- Class A: ~700,000–1M+  
- Class B: ~6M–10M+  

### Free Tier Usage

- Class A → **70%–100%+**
- Class B → **60%–100%+**

This is where users may begin approaching paid limits.

---

# What Happens If You Exceed Free Tier?

This section only applies to a small minority of edge-case users.

Most users will never reach this point.

Cloudflare R2 uses monthly billing for usage beyond the free tier.

## Standard Storage Pricing

- **Storage:** $0.015 per GB/month
- **Class A Operations:** $4.50 per million operations
- **Class B Operations:** $0.36 per million operations
- **Data Retrieval:** Free
- **Egress Bandwidth:** Free

## Infrequent Access Pricing

- **Storage:** $0.01 per GB/month
- **Class A Operations:** $9.00 per million operations
- **Class B Operations:** $0.90 per million operations
- **Data Retrieval:** $0.01 per GB
- **Egress Bandwidth:** Free

Even for users who exceed the free tier, costs typically remain very low compared to traditional subscription-based sync services.

---

# When Should You Use the Token Calculator?

Use the calculator on the official website if:

- your workflow does not match these scenarios
- you frequently change sync settings
- you manage extremely large vaults
- you use multiple active devices simultaneously

The calculator provides more precise estimates based on your exact workflow.

---

# Note for Developers

If you are a developer using the same Cloudflare R2 free tier account for services beyond Secure Smart Sync:

- application hosting
- APIs
- media storage
- backups
- personal infrastructure

It is recommended that you monitor your Cloudflare dashboard during your first month.

This helps you understand your total combined usage across all projects.
