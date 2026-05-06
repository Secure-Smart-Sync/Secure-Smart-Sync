# Usage Guidelines & Setup Instructions

Welcome to Secure-Smart-Sync (SSS)! Because this plugin handles your data using your own private infrastructure, the initial setup takes a few minutes. Please read these guidelines carefully to ensure a smooth, zero-cost experience.

## 1. Installation

Currently, Secure-Smart-Sync is **not yet available on the official Obsidian Community Plugins store**. Until the review process is complete and it is officially listed, you will need to install the plugin manually.

**Manual Installation Steps:**
1. Go to the **Releases** page on this GitHub repository and download the latest release files (`main.js`, `manifest.json`, and `styles.css`).
2. Open your Obsidian vault's hidden configuration folder. 
   * *Tip: On most systems, this is `.obsidian` located at the root of your vault.*
3. Navigate to the `plugins` folder (i.e., `YourVault/.obsidian/plugins/`). If the `plugins` folder does not exist, create it.
4. Create a new folder inside `plugins` named exactly `Secure-Smart-Sync`.
5. Extract/move the downloaded files into this new folder.
6. Open Obsidian, go to **Settings > Community Plugins**, refresh your installed plugins, and toggle Secure-Smart-Sync to **On**.

## 2. Cloudflare R2 Setup & Prerequisites

SSS uses Cloudflare R2 as its remote storage backend. To use this plugin, you will need to set up your own Cloudflare account. 

If you haven't already, you must enable the **R2 Subscription** in your Cloudflare dashboard to unlock their highly generous free tier. To do this, Cloudflare requires you to add a valid payment method, such as an international credit/debit card (Visa, Mastercard, etc.). For a full list of supported payment methods, please check out the [Cloudflare Billing Documentation](https://developers.cloudflare.com/billing/).

> **💡 IMPORTANT NOTE ON BILLING:** 
> Adding a billing method is strictly an industry-standard measure by Cloudflare to prevent bot abuse and spam. **It actually costs $0.00 to set up.** You will not be charged to activate R2, and as long as you stay within the free tier, you will never pay a cent.

## 3. Will I exceed the Free Tier?

The short answer is: **Almost certainly not.** 

Secure-Smart-Sync is heavily optimized to minimize API calls. The plugin is designed to work perfectly well within the R2 free tier plan for the vast majority of users. 

To put it in perspective: the plugin can comfortably handle a setup with **up to 5 devices** syncing a decently large vault, even with highly aggressive use (e.g., actively typing and triggering syncs for 8 solid hours a day, every single day). This level of activity is well above what an average user will ever hit.

**Uncertain if your workflow fits?**
If you have an exceptionally massive vault, or if you just like seeing the math for peace of mind, please check out the [Token Usage Scenarios](./docs/Token_usage_scenarios.md) page in our repository. It provides precise calculations, edge-cases, and breakdowns of API usage against Cloudflare's limits.
