/**
 * settings-tab.ts
 * Obsidian settings UI for Secure-Smart-Sync (SSS).
 */

import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type SSSPlugin from "./main";
import { StorageR2 } from "./storage-r2";
import { exportCredentialBundle, importCredentialBundle } from "./credentials-transfer";
import { createPairingSlot, consumePairingSlot, checkRelayHealth } from "./pairing-relay";
import { DEFAULT_RELAY_URL } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSyncDate(ms: number): string {
  const d    = new Date(ms);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Returns whichever relay URL is active given current settings. */
function activeRelayUrl(plugin: SSSPlugin): string {
  return plugin.settings.useCustomRelay && plugin.settings.customRelayUrl
    ? plugin.settings.customRelayUrl
    : DEFAULT_RELAY_URL;
}

// ─── SSS logo SVG (inline, themed via currentColor) ──────────────────────────
// Scaled from 2048×2048 source to a compact header badge.

const SSS_HEADER_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 2048 2048" width="36" height="36" aria-hidden="true">
  <g fill="currentColor">
    <path d="M955 1921.80 c-153.40 -11.80 -301.40 -63.40 -431 -150.40 -78.40 -52.60 -152.20 -121.60 -212.20 -198.40 -93.80 -120.20 -157.60 -273.40 -176.60 -425 -8.20 -64.40 -9.20 -160 -2.40 -221 11.40 -100.60 41 -203 84.80 -292 114.40 -232.20 319 -403.80 563.40 -472.80 108.80 -30.60 220.60 -40.40 335 -29 426.20 42.20 769.60 393.60 802.20 821 3.40 46.80 1.40 148.20 -4 187.80 -18.20 133.20 -54.40 238.40 -120 347 -43.40 72 -99.40 140.80 -158.20 194.60 -152.80 139.80 -341.40 222.80 -541.80 238.40 -30.20 2.20 -108.80 2.20 -139.20 -0.20z m138.40 -326.80 c180.40 -23.80 350.80 -139.60 419.60 -286 23.20 -49 35.20 -104.80 32.20 -148.60 -8.80 -124.60 -94 -237.60 -207.80 -275.40 -51.20 -17 -92.40 -19 -140.20 -6.80 -17.60 4.60 -41.20 13.40 -41.20 15.80 0 0.80 2 3 4.20 5.20 7.60 6.80 39 49.80 49.80 68.20 23.60 39.80 30 53.40 30 64 0 23.60 -5 23.20 -145 -12.80 -60.40 -15.60 -142.80 -36.60 -183 -46.60 -40.20 -10.20 -75.40 -19.60 -78.20 -21.20 -6.60 -3.20 -7.80 -6.40 -7.80 -18.80 0 -12 2.60 -15.40 30.80 -39.60 103.80 -89.80 232.60 -143.80 371.20 -156.40 34 -3 110.40 -2.40 142 1 50.60 5.60 98 15.80 139.60 29.80 11.20 3.80 20.40 6.60 20.40 6 0 -0.40 -4.60 -10 -10.20 -21 -36.40 -72.80 -100.60 -147.40 -168 -195 -91 -64.60 -186.60 -98.80 -297.80 -106.80 -59.20 -4.20 -134.20 5.80 -198 26.40 -136.40 44.20 -249 137.20 -311.80 257.80 -38.40 73.80 -54 156.20 -42.40 224.20 14.80 85.80 59 156.80 128.60 206.60 55.80 40 134 62 195.20 55.20 19.60 -2.20 47.20 -7.40 51 -9.60 0.80 -0.40 -1.60 -4.60 -5.40 -9.20 -14.60 -18 -33.80 -48.80 -47.20 -75.40 -12.60 -25 -14 -29.20 -14 -39.60 0 -6.40 1 -12.60 2.40 -14 6.20 -6.20 25.40 -2.80 137.60 25.60 61 15.40 140.20 35.20 176 44 35.80 8.80 67 17 69.60 18 3.80 1.60 4.40 3.40 4.40 14.60 0 12 -0.40 13 -7.40 19.80 -23 21.80 -73.20 56.20 -111.40 76.60 -76.80 40.60 -159.20 65.40 -242.80 73 -34.80 3.20 -125 1.60 -156.40 -2.80 -36.20 -5.20 -84.20 -16.60 -119 -28.20 -17.60 -6 -32.20 -10.60 -32.40 -10.20 -1.40 1.40 22 39.80 37.20 60.80 94.40 132.20 250.20 219.40 418.20 234.20 26.80 2.40 77.20 1 107.40 -2.80z"/>
  </g>
</svg>`;

// ─── Pairing Send Modal ───────────────────────────────────────────────────────

class PairingSendModal extends Modal {
  private pairingCode: string;
  private expiresInSeconds: number;
  private countdownEl?: HTMLElement;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(app: App, pairingCode: string, expiresInSeconds: number) {
    super(app);
    this.pairingCode      = pairingCode;
    this.expiresInSeconds = expiresInSeconds;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("sss-pairing-send-modal");

    contentEl.createEl("h2", { text: "Pair Another Device" });
    contentEl.createEl("p", {
      text: "Enter this code in SSS Settings → Pair Devices on the other device.",
      cls: "sss-section-desc",
    });

    const codeWrap = contentEl.createDiv({ cls: "sss-pairing-code-wrap" });
    codeWrap.createEl("span", { text: this.pairingCode, cls: "sss-pairing-code" });

    const copyBtn = codeWrap.createEl("button", { text: "Copy Code", cls: "sss-pairing-copy-btn" });
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(this.pairingCode);
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => { copyBtn.textContent = "Copy Code"; }, 2000);
    });

    this.countdownEl = contentEl.createEl("p", { cls: "sss-pairing-countdown" });
    this.updateCountdown();
    this.intervalId = setInterval(() => {
      this.expiresInSeconds--;
      if (this.expiresInSeconds <= 0) { this.close(); }
      else { this.updateCountdown(); }
    }, 1000);

    const note = contentEl.createDiv({ cls: "sss-inline-note" });
    note.createEl("strong", { text: "Keep this private. " });
    note.appendText("Only enter it on a device you own.");

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Done").setCta().onClick(() => this.close())
    );
  }

  private updateCountdown(): void {
    if (!this.countdownEl) return;
    const m = Math.floor(this.expiresInSeconds / 60);
    const s = String(this.expiresInSeconds % 60).padStart(2, "0");
    this.countdownEl.textContent = `Expires in ${m}:${s}`;
  }

  onClose(): void {
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
    this.contentEl.empty();
  }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

export class SSSSettingTab extends PluginSettingTab {
  private readonly plugin: SSSPlugin;
  private connectionResultEl?: HTMLElement;

  constructor(app: App, plugin: SSSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Header: logo + name + last synced ────────────────────────────────────

    const header = containerEl.createDiv({ cls: "sss-header" });

    const logoWrap = header.createDiv({ cls: "sss-header-logo" });
    logoWrap.innerHTML = SSS_HEADER_SVG;

    const headerText = header.createDiv({ cls: "sss-header-text" });
    headerText.createEl("span", { text: "Secure-Smart-Sync", cls: "sss-header-title" });

    const lastSynced = this.plugin.settings.lastSyncedAt;
    headerText.createEl("span", {
      text: lastSynced ? `Last synced ${formatSyncDate(lastSynced)}` : "Not yet synced",
      cls: "sss-header-subtitle",
    });

    // ── Pair Devices ──────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Pair Devices" });

    // Generate code (sender side)
    new Setting(containerEl)
      .setName("Share to another device")
      .setDesc("Generates a 10-minute code. Enter it in SSS settings on the other device.")
      .addButton((btn) =>
        btn.setButtonText("Generate Code").setCta().onClick(async () => {
          const { endpoint, bucketName, accessKeyId, secretAccessKey } = this.plugin.settings.r2;
          if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
            new Notice("Fill in your R2 credentials first.");
            return;
          }
          btn.setDisabled(true);
          btn.setButtonText("Generating…");
          try {
            const credJson = exportCredentialBundle(this.plugin.settings);
            const { pairingCode, expiresInSeconds } = await createPairingSlot(
              credJson, { relayUrl: activeRelayUrl(this.plugin) }
            );
            new PairingSendModal(this.app, pairingCode, expiresInSeconds).open();
          } catch (e) {
            new Notice(`Pairing failed: ${(e as Error).message}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Generate Code");
          }
        })
      );

    // Enter code (receiver side) — compact: input + button in one row, status below
    const receiveRow = containerEl.createDiv({ cls: "sss-receive-row" });

    const codeInput = receiveRow.createEl("input", {
      cls: "sss-code-input",
      placeholder: "xxxxxx-xxxxxxxx",
    } as DomElementInfo & { type?: string });
    (codeInput as HTMLInputElement).type         = "text";
    (codeInput as HTMLInputElement).maxLength    = 15;
    (codeInput as HTMLInputElement).spellcheck   = false;
    (codeInput as HTMLInputElement).autocomplete = "off";

    const importBtn = receiveRow.createEl("button", { text: "Import Code", cls: "mod-cta sss-receive-btn" });
    const receiveStatus = containerEl.createDiv({ cls: "sss-receive-status" });

    const doImport = async () => {
      const code = (codeInput as HTMLInputElement).value.trim();
      if (!code) {
        receiveStatus.textContent = "Enter the pairing code first.";
        receiveStatus.className   = "sss-receive-status sss-receive-err";
        return;
      }
      importBtn.disabled = true;
      (importBtn as HTMLButtonElement).textContent = "Importing…";
      receiveStatus.textContent = "";
      receiveStatus.className   = "sss-receive-status";
      try {
        const credJson = await consumePairingSlot(code, { relayUrl: activeRelayUrl(this.plugin) });
        const imported = importCredentialBundle(credJson);
        Object.assign(this.plugin.settings.r2, imported.r2);
        this.plugin.settings.encryptionPassword = imported.encryptionPassword;
        this.plugin.settings.encryptionMethod   = imported.encryptionMethod;
        await this.plugin.saveSettings();
        (codeInput as HTMLInputElement).value = "";
        receiveStatus.textContent = "✅ Credentials imported. Test your connection below.";
        receiveStatus.className   = "sss-receive-status sss-receive-ok";
        this.display();
      } catch (e) {
        receiveStatus.textContent = `❌ ${(e as Error).message}`;
        receiveStatus.className   = "sss-receive-status sss-receive-err";
      } finally {
        importBtn.disabled = false;
        (importBtn as HTMLButtonElement).textContent = "Import Code";
      }
    };

    importBtn.addEventListener("click", doImport);
    (codeInput as HTMLInputElement).addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") doImport();
    });

    // ── R2 Connection ─────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Cloudflare R2" });

    new Setting(containerEl)
      .setName("Endpoint")
      .setDesc("https://<account-id>.r2.cloudflarestorage.com")
      .addText((text) =>
        text
          .setPlaceholder("https://xxxx.r2.cloudflarestorage.com")
          .setValue(this.plugin.settings.r2.endpoint)
          .onChange(async (v) => { this.plugin.settings.r2.endpoint = v.trim(); await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Bucket")
      .addText((text) =>
        text
          .setPlaceholder("my-obsidian-vault")
          .setValue(this.plugin.settings.r2.bucketName)
          .onChange(async (v) => { this.plugin.settings.r2.bucketName = v.trim(); await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Access Key ID")
      .addText((text) =>
        text
          .setPlaceholder("R2 Access Key ID")
          .setValue(this.plugin.settings.r2.accessKeyId)
          .onChange(async (v) => { this.plugin.settings.r2.accessKeyId = v.trim(); await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Secret Access Key")
      .addText((text) => {
        text
          .setPlaceholder("R2 Secret Access Key")
          .setValue(this.plugin.settings.r2.secretAccessKey)
          .onChange(async (v) => { this.plugin.settings.r2.secretAccessKey = v.trim(); await this.plugin.saveSettings(); });
        text.inputEl.type = "password";
        text.inputEl.id   = "sss-secret-key";
      })
      .addButton((btn) =>
        btn.setButtonText("Show").onClick(() => {
          const input = containerEl.querySelector<HTMLInputElement>("#sss-secret-key");
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          btn.setButtonText(hidden ? "Hide" : "Show");
        })
      );

    new Setting(containerEl)
      .setName("Remote Prefix")
      .setDesc("Optional sub-folder inside the bucket, e.g. my-vault/")
      .addText((text) =>
        text
          .setPlaceholder("my-vault/")
          .setValue(this.plugin.settings.r2.remotePrefix ?? "")
          .onChange(async (v) => { this.plugin.settings.r2.remotePrefix = v.trim(); await this.plugin.saveSettings(); })
      );

    const connTestSetting = new Setting(containerEl)
      .setName("Test Connection")
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Testing…");
          this._setConnectionResult("", "");
          const r2 = new StorageR2(this.plugin.settings.r2);
          let errorMsg = "";
          const ok = await r2.checkConnection((err) => { errorMsg = (err as Error).message ?? String(err); });
          btn.setDisabled(false);
          btn.setButtonText("Test");
          if (ok) { this._setConnectionResult("✅ Connected successfully!", "sss-conn-ok"); }
          else     { this._setConnectionResult(`❌ Failed: ${errorMsg}`, "sss-conn-err"); }
        })
      );

    this.connectionResultEl = connTestSetting.settingEl.createEl("div", { cls: "sss-conn-result" });

    // ── Encryption ────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Encryption" });

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Files are encrypted before upload. Leave blank to disable. Changing this makes existing remote files unreadable.")
      .addText((text) => {
        text
          .setPlaceholder("leave blank to disable encryption")
          .setValue(this.plugin.settings.encryptionPassword)
          .onChange(async (v) => { this.plugin.settings.encryptionPassword = v; await this.plugin.saveSettings(); });
        text.inputEl.type = "password";
        text.inputEl.id   = "sss-enc-password";
      })
      .addButton((btn) =>
        btn.setButtonText("Show").onClick(() => {
          const input = containerEl.querySelector<HTMLInputElement>("#sss-enc-password");
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          btn.setButtonText(hidden ? "Hide" : "Show");
        })
      );

    new Setting(containerEl)
      .setName("Method")
      .setDesc("openssl-base64 encrypts content only. rclone-base64 also encrypts file names.")
      .addDropdown((dd) =>
        dd
          .addOption("openssl-base64", "OpenSSL AES-CBC")
          .addOption("rclone-base64",  "rclone Salsa20 (encrypts names too)")
          .setValue(this.plugin.settings.encryptionMethod)
          .onChange(async (v: any) => { this.plugin.settings.encryptionMethod = v; await this.plugin.saveSettings(); })
      );

    // ── Sync ──────────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Sync" });

    new Setting(containerEl)
      .setName("Direction")
      .addDropdown((dd) =>
        dd
          .addOption("bidirectional", "Bidirectional")
          .addOption("push_only",     "Push only (local → remote)")
          .addOption("pull_only",     "Pull only (remote → local)")
          .setValue(this.plugin.settings.syncDirection)
          .onChange(async (v: any) => { this.plugin.settings.syncDirection = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Conflict Resolution")
      .setDesc("Applied when the same file changed on both sides. The losing version is saved as a .conflict backup.")
      .addDropdown((dd) =>
        dd
          .addOption("keep_newer",  "Keep newer")
          .addOption("keep_larger", "Keep larger")
          .addOption("keep_local",  "Always keep local")
          .addOption("keep_remote", "Always keep remote")
          .setValue(this.plugin.settings.conflictResolution)
          .onChange(async (v: any) => { this.plugin.settings.conflictResolution = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Delete Behaviour")
      .addDropdown((dd) =>
        dd
          .addOption("trash_system", "System trash")
          .addOption("trash_local",  "Obsidian trash (.trash)")
          .addOption("permanent",    "Delete permanently")
          .setValue(this.plugin.settings.deleteBehaviour)
          .onChange(async (v: any) => { this.plugin.settings.deleteBehaviour = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Skip Files Larger Than (MB)")
      .setDesc("0 = no limit.")
      .addText((text) => {
        const mb = this.plugin.settings.maxFileSizeBytes > 0
          ? String(this.plugin.settings.maxFileSizeBytes / 1024 / 1024) : "0";
        text.setPlaceholder("0").setValue(mb).onChange(async (v) => {
          const n = parseFloat(v);
          this.plugin.settings.maxFileSizeBytes = n > 0 ? Math.floor(n * 1024 * 1024) : -1;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Ignore Paths")
      .setDesc("Glob patterns, one per line. e.g. *.tmp  archive/  **/node_modules/**")
      .addTextArea((area) => {
        area
          .setPlaceholder("*.tmp\narchive/")
          .setValue((this.plugin.settings.ignorePaths ?? []).join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.ignorePaths = v.split("\n").map((l) => l.trim()).filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 5;
        area.inputEl.style.width       = "100%";
        area.inputEl.style.fontFamily  = "monospace";
      });

    // ── Automation ────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Automation" });

    new Setting(containerEl)
      .setName("Auto-Sync Interval (minutes)")
      .setDesc("0 = disabled.")
      .addText((text) => {
        const minutes = this.plugin.settings.autoSyncIntervalMs > 0
          ? String(this.plugin.settings.autoSyncIntervalMs / 60000) : "0";
        text.setPlaceholder("0").setValue(minutes).onChange(async (v) => {
          const n = parseFloat(v);
          this.plugin.settings.autoSyncIntervalMs = n > 0 ? Math.floor(n * 60000) : -1;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Sync on Save Debounce (seconds)")
      .setDesc("Triggers sync N seconds after a file is saved. 0 = disabled.")
      .addText((text) => {
        const secs = this.plugin.settings.syncOnSaveDebounceMs > 0
          ? String(this.plugin.settings.syncOnSaveDebounceMs / 1000) : "0";
        text.setPlaceholder("0").setValue(secs).onChange(async (v) => {
          const n = parseFloat(v);
          this.plugin.settings.syncOnSaveDebounceMs = n > 0 ? Math.floor(n * 1000) : -1;
          await this.plugin.saveSettings();
        });
      });

    // ── Advanced ──────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Use custom pairing relay")
      .setDesc("By default, Pair Devices uses a free relay hosted by the plugin developer (open-source, end-to-end encrypted). Enable this only if you have deployed your own sss-relay instance.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useCustomRelay).onChange(async (v) => {
          this.plugin.settings.useCustomRelay = v;
          await this.plugin.saveSettings();
          this.display(); // re-render to show/hide URL field
        })
      );

    if (this.plugin.settings.useCustomRelay) {
      new Setting(containerEl)
        .setName("Custom Relay URL")
        .setDesc("Your self-hosted sss-relay Worker URL. See github.com/xensenx/sss-relay for setup instructions.")
        .addText((text) =>
          text
            .setPlaceholder("https://sss-relay.yourname.workers.dev")
            .setValue(this.plugin.settings.customRelayUrl)
            .onChange(async (v) => { this.plugin.settings.customRelayUrl = v.trim(); await this.plugin.saveSettings(); })
        )
        .addButton((btn) =>
          btn.setButtonText("Test").onClick(async () => {
            if (!this.plugin.settings.customRelayUrl) { new Notice("Enter a relay URL first."); return; }
            btn.setDisabled(true);
            btn.setButtonText("Testing…");
            const ok = await checkRelayHealth(this.plugin.settings.customRelayUrl);
            btn.setDisabled(false);
            btn.setButtonText("Test");
            new Notice(ok ? "✅ Relay is reachable." : "❌ Could not reach relay. Check the URL.");
          })
        );
    }

    new Setting(containerEl)
      .setName("Log Level")
      .addDropdown((dd) =>
        dd
          .addOption("error", "Error only")
          .addOption("warn",  "Warn")
          .addOption("info",  "Info (default)")
          .addOption("debug", "Debug (verbose)")
          .setValue(this.plugin.settings.logLevel)
          .onChange(async (v: any) => { this.plugin.settings.logLevel = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Sync .obsidian Config Directory")
      .setDesc("Include Obsidian configuration files in the sync.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncConfigDir).onChange(async (v) => {
          this.plugin.settings.syncConfigDir = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Show Status Bar")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (v) => {
          this.plugin.settings.showStatusBar = v;
          await this.plugin.saveSettings();
        })
      );

    // ── Danger Zone ───────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Danger Zone" });

    new Setting(containerEl)
      .setName("Reset Sync History")
      .setDesc("Clears the record of what was last synced. The next sync will do a full comparison.")
      .addButton((btn) =>
        btn.setButtonText("Reset").setWarning().onClick(async () => {
          await (this.plugin as any).resetSyncHistory?.();
        })
      );
  }

  private _setConnectionResult(msg: string, cls: string): void {
    if (!this.connectionResultEl) return;
    this.connectionResultEl.textContent = msg;
    this.connectionResultEl.className = `sss-conn-result ${cls}`.trim();
  }
}
