# Contributing to Secure-Smart-Sync

First off, thank you for considering contributing to Secure-Smart-Sync (SSS)! 

This plugin is built on the philosophy that users should have absolute control over their data, their infrastructure, and their privacy. Whether you are fixing a bug, proposing a new feature, or improving documentation, your help is deeply appreciated.

## How Can I Contribute?

### 1. Reporting Bugs
If you find a bug, please open an issue on GitHub. Before creating a new issue, please search the existing issues to see if it has already been reported. 

When opening an issue, include:
* Your operating system and Obsidian version.
* The plugin version you are using.
* Your Cloudflare R2 setup (e.g., are you using a custom domain or default endpoint?).
* Clear, reproducible steps to trigger the bug.
* Any relevant error logs from the Obsidian Developer Console (`Ctrl/Cmd + Shift + I`).

### 2. Suggesting Enhancements
We love new ideas, especially those that improve sync reliability or security. Please open an issue and use the "Feature Request" label. Explain *why* this enhancement would be useful and how it fits into the local-first, zero-knowledge philosophy of SSS.

### 3. Code Contributions (Pull Requests)
If you want to get your hands dirty, pull requests are always welcome. Please look for issues tagged with `good first issue` or `help wanted` if you aren't sure where to start.

## Development Setup

To work on the plugin locally, you will need Node.js installed.

1. **Fork the repository** on GitHub, then clone your fork locally:
   ```bash
   git clone [https://github.com/YOUR-USERNAME/Secure-Smart-Sync.git](https://github.com/YOUR-USERNAME/Secure-Smart-Sync.git)
   cd Secure-Smart-Sync
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up a test vault:**
   Create a dummy Obsidian vault specifically for testing. Do not test experimental code on your primary vault.
4. **Link the plugin to your test vault:**
   Create a symlink (or manually copy the compiled files) from your repository directory to your test vault's plugin folder:
   ```bash
   # Example path
   /path/to/test-vault/.obsidian/plugins/Secure-Smart-Sync
   ```
5. **Run the development compiler:**
   ```bash
   npm run dev
   ```
   This will watch your `.ts` files and recompile `main.js` automatically whenever you save a change. You can reload the plugin in Obsidian by toggling it off and on in the settings, or by using a hot-reload plugin.

## Architectural Guidelines

When writing code for SSS, please adhere to the following principles:

* **Separation of Concerns:** Keep the UI/Settings logic separate from the Sync Engine, Storage abstraction, and Cryptography layers. 
* **Non-Blocking Crypto:** All heavy cryptographic operations (especially file encryption/decryption) should remain off the main thread where possible to avoid freezing the Obsidian UI.
* **Predictable State:** The sync engine relies heavily on the `prevSync` state index. Ensure that any modifications to file handling correctly update this index.

> <picture><source media="(prefers-color-scheme: dark)" srcset="./assets/alert_white.svg"><source media="(prefers-color-scheme: light)" srcset="./assets/alert_white.svg"><img alt="Alert" src="./assets/alert_white.svg" width="16" height="16" align="center"></picture> **IMPORTANT SECURITY RULES:**
> 1. **No Telemetry:** We will never accept PRs that introduce analytics, tracking, or external logging of any kind.
> 2. **Zero-Knowledge Intact:** Features must never require sending plaintext data, vault names, or file structures to any third-party server, including the `sss-relay`.

## Pull Request Process

1. Create a new branch from `main` for your feature or bugfix (e.g., `git checkout -b feature/improved-conflict-resolution`).
2. Write clean, documented TypeScript code.
3. Test your changes thoroughly in your local dummy vault. Ensure both edge cases (like offline status, empty buckets, and massive files) are handled gracefully.
4. Commit your changes with clear, descriptive commit messages.
5. Open a Pull Request against the `main` branch. Provide a detailed description of what you changed and why.

## Supporting the Project

If you don't have the time to write code but still want to support the development and maintenance of Secure-Smart-Sync, you can buy me a coffee! It directly fuels late-night debugging sessions.

<p>
  <a href="https://ko-fi.com/xensenx">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" />
  </a>
</p>

Thank you for helping make Secure-Smart-Sync better!
