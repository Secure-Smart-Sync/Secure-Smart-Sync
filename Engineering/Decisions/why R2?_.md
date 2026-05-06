# Architecture Rationale: Why Cloudflare R2?

When designing Secure-Smart-Sync (SSS), the choice of remote storage backend was critical. The plugin needed a backend that was highly available, cost-effective for end-users, and developer-friendly. 

We chose **Cloudflare R2** as the exclusive first-party remote storage provider. Here is a breakdown of why R2 provides the perfect conditions for a zero-knowledge Obsidian sync engine.

## 1. Zero Egress Fees (The Game Changer)
The fundamental flaw with traditional object storage (like AWS S3 or Google Cloud Storage) for a multi-device sync engine is **egress fees** (the cost of downloading data).
* In a typical Obsidian workflow with three devices (e.g., Desktop, Laptop, Phone), every file uploaded by one device must be downloaded by the other two.
* Over time, syncing a media-heavy vault could rack up unpredictable bandwidth costs on AWS.
* **Cloudflare R2 charges $0 for data egress.** Users only pay for storage and operations, making the pricing entirely predictable and perfectly suited for frequent, multi-device synchronization.

## 2. The "Free Forever" Tier
For the vast majority of personal knowledge management (PKM) users, SSS will be completely free to operate thanks to Cloudflare's exceptionally generous free tier:
* **10 GB of storage / month:** More than enough for almost any Obsidian vault (most text-based vaults are under 100 MB).
* **1 Million Class 1 Operations (Writes/Lists) / month:** Ample overhead for the plugin's aggressive state-awareness polling and background file pushes.
* **10 Million Class 2 Operations (Reads) / month:** Practically impossible to exhaust for a single user downloading vault updates.

## 3. S3 API Compatibility
R2 implements the widely adopted S3 API. This provided several massive developer advantages:
* **Battle-Tested SDKs:** We could leverage the official `@aws-sdk/client-s3` library instead of writing custom API wrappers, ensuring reliable multipart uploads, streaming, and error handling.
* **Familiarity:** Any user who has interacted with S3, DigitalOcean Spaces, or Backblaze B2 will instantly understand how to generate keys and configure their bucket.

## 4. Drastically Simplified User Experience
Setting up secure cloud storage can be daunting. AWS requires navigating a labyrinth of IAM users, policies, and roles. 
* Cloudflare's dashboard is modern and streamlined. Creating a bucket and generating an API token with exact read/write scoped permissions takes less than 60 seconds.
* This dramatically lowers the barrier to entry for non-technical users who want to own their data without learning cloud engineering.

## 5. Global Performance
Because R2 is backed by Cloudflare's massive global edge network, read and write latency is incredibly low regardless of where the user is geographically located. SSS feels "snappy" and real-time because the data is usually routed to a server physically close to the user.

---

## Technical Trade-offs & Workarounds
While R2 is nearly perfect, it does have a few quirks that we explicitly handle in the SSS storage layer:

* **Path-Style Addressing:** R2 does not support virtual-hosted style requests via the standard SDK out-of-the-box. We enforce `forcePathStyle: true` in the S3 client configuration to ensure requests route correctly.
* **No Native Folder Objects:** R2 is a strict flat key-value store. By default, it doesn't create zero-byte "folder" objects. SSS handles this gracefully by synthesising folder structures in-memory by analyzing object key prefixes during the `walk()` operation.

## Conclusion
By standardizing on Cloudflare R2, SSS delivers on its promise of a fast, private, and cost-effective sync engine. It removes the anxiety of bandwidth billing and allows users to fully own their sync infrastructure with minimal setup.
