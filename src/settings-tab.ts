/**
 * settings-tab.ts
 * Obsidian settings UI for Secure-Smart-Sync (SSS).
 *
 * QR code generation requires the `qrcode` npm package:
 *   npm install qrcode @types/qrcode
 */

import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type SSSPlugin from "./main";
import { StorageR2 } from "./storage-r2";
import { exportCredentialBundle, importCredentialBundle } from "./credentials-transfer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a timestamp as DD/MM/YYYY HH:MM */
function formatSyncDate(ms: number): string {
  const d   = new Date(ms);
  const dd  = String(d.getDate()).padStart(2, "0");
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────

class QRModal extends Modal {
  private readonly svgString: string;

  constructor(app: App, svgString: string) {
    super(app);
    this.svgString = svgString;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("sss-qr-modal");

    contentEl.createEl("h2", { text: "Scan to Set Up Another Device" });

    contentEl.createEl("p", {
      text: "⚠️ This QR code contains your full credentials including secret key and encryption password. Do not photograph or share it.",
      cls: "sss-qr-warning",
    });

    // Render the QR SVG
    const qrWrap = contentEl.createDiv({ cls: "sss-qr-wrap" });
    qrWrap.innerHTML = this.svgString;

    // Step-by-step instructions
    const steps = contentEl.createEl("ol", { cls: "sss-qr-steps" });
    steps.createEl("li", { text: "Scan the QR code with your phone's camera app (outside Obsidian)." });
    steps.createEl("li", { text: "The camera app will show the credential text — copy all of it." });
    steps.createEl("li", { text: "On your phone: open SSS Settings → Device Setup → Import Credentials → paste → Import." });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Close").setCta().onClick(() => this.close())
      );
  }

  onClose(): void {
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

    containerEl.createEl("h2", { text: "Secure-Smart-Sync Settings" });

    // ── Last-synced timestamp ─────────────────────────────────────────────────

    const lastSynced = this.plugin.settings.lastSyncedAt;
    containerEl.createEl("p", {
      text: lastSynced
        ? `Last synced: ${formatSyncDate(lastSynced)}`
        : "Not yet synced this session.",
      cls: "sss-last-synced",
    });

    // ── Device Setup (QR export / import) ─────────────────────────────────────

    containerEl.createEl("h3", { text: "Device Setup" });
    containerEl.createEl("p", {
      text: "Transfer your connection credentials to another device without retyping. Generate a QR on this device and scan it on the other.",
      cls: "sss-section-desc",
    });

    // Export
    new Setting(containerEl)
      .setName("Export to Another Device")
      .setDesc("Generates a QR code containing all connection settings. The QR is shown only in the modal and never saved to disk.")
      .addButton((btn) =>
        btn.setButtonText("Generate QR Code").onClick(async () => {
          const { endpoint, bucketName, accessKeyId, secretAccessKey } = this.plugin.settings.r2;
          if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
            new Notice("⚠️ Fill in all R2 credentials before generating a QR code.");
            return;
          }

          btn.setDisabled(true);
          btn.setButtonText("Generating…");

          try {
            // qrcode is a bundled npm package — run: npm install qrcode @types/qrcode
            const QRCode = (await import("qrcode" as any)).default ?? (await import("qrcode" as any));
            const json = exportCredentialBundle(this.plugin.settings);
            const svg: string = await QRCode.toString(json, {
              type: "svg",
              errorCorrectionLevel: "M",
              margin: 2,
              width: 300,
            });
            new QRModal(this.app, svg).open();
          } catch (e) {
            const err = e as Error;
            if (err.message?.includes("Cannot find module") || err.message?.includes("qrcode")) {
              new Notice("QR generation failed: run  npm install qrcode @types/qrcode  in sss env, then rebuild.");
            } else {
              new Notice(`QR generation failed: ${err.message}`);
            }
            console.error("[SSS] QR generation error:", e);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Generate QR Code");
          }
        })
      );

    // Import
    new Setting(containerEl)
      .setName("Import Credentials")
      .setDesc("Paste the text from a scanned QR code below, then tap Import. All connection fields will be populated automatically.");

    const importTextarea = containerEl.createEl("textarea", {
      cls: "sss-import-textarea",
      placeholder: 'Paste credential text here (from QR scan)…',
    });

    new Setting(containerEl)
      .addButton((btn) =>
        btn.setButtonText("Import").onClick(async () => {
          const raw = importTextarea.value.trim();
          if (!raw) {
            new Notice("Paste the credential text first.");
            return;
          }
          try {
            const imported = importCredentialBundle(raw);
            Object.assign(this.plugin.settings.r2, imported.r2);
            this.plugin.settings.encryptionPassword = imported.encryptionPassword;
            this.plugin.settings.encryptionMethod    = imported.encryptionMethod;
            await this.plugin.saveSettings();
            importTextarea.value = "";
            new Notice("✅ Credentials imported. Verify settings and tap Test Connection.");
            this.display(); // refresh to show populated fields
          } catch (e) {
            new Notice(`❌ Import failed: ${(e as Error).message}`);
          }
        })
      );

    // ── R2 Connection ─────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Cloudflare R2 Connection" });

    new Setting(containerEl)
      .setName("Endpoint")
      .setDesc("Your R2 endpoint URL, e.g. https://<account-id>.r2.cloudflarestorage.com")
      .addText((text) =>
        text
          .setPlaceholder("https://xxxx.r2.cloudflarestorage.com")
          .setValue(this.plugin.settings.r2.endpoint)
          .onChange(async (v) => { this.plugin.settings.r2.endpoint = v.trim(); await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Bucket Name")
      .setDesc("The name of your R2 bucket.")
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
        text.inputEl.id = "sss-secret-key";
      })
      .addButton((btn) => {
        btn.setButtonText("Show").onClick(() => {
          const input = containerEl.querySelector<HTMLInputElement>("#sss-secret-key");
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          btn.setButtonText(hidden ? "Hide" : "Show");
        });
      });

    new Setting(containerEl)
      .setName("Remote Prefix (optional)")
      .setDesc("Store vault files under a sub-path in the bucket, e.g. 'my-vault/'. Useful if you share the bucket across multiple vaults.")
      .addText((text) =>
        text
          .setPlaceholder("my-vault/")
          .setValue(this.plugin.settings.r2.remotePrefix ?? "")
          .onChange(async (v) => { this.plugin.settings.r2.remotePrefix = v.trim(); await this.plugin.saveSettings(); })
      );

    const connTestSetting = new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Verify that the credentials and bucket name are correct.")
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Testing…");
          this._setConnectionResult("", "");

          const r2 = new StorageR2(this.plugin.settings.r2);
          let errorMsg = "";
          const ok = await r2.checkConnection((err) => {
            errorMsg = (err as Error).message ?? String(err);
          });

          btn.setDisabled(false);
          btn.setButtonText("Test");
          if (ok) {
            this._setConnectionResult("✅ Connected successfully!", "sss-conn-ok");
          } else {
            this._setConnectionResult(`❌ Failed: ${errorMsg}`, "sss-conn-err");
          }
        })
      );

    this.connectionResultEl = connTestSetting.settingEl.createEl("div", { cls: "sss-conn-result" });

    // ── Encryption ────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Client-Side Encryption" });

    new Setting(containerEl)
      .setName("Encryption Password")
      .setDesc(
        "Files are encrypted before leaving your device. Leave blank to disable encryption. " +
        "⚠️ If you change or lose this password, your remote files will be unreadable."
      )
      .addText((text) => {
        text
          .setPlaceholder("leave blank for no encryption")
          .setValue(this.plugin.settings.encryptionPassword)
          .onChange(async (v) => { this.plugin.settings.encryptionPassword = v; await this.plugin.saveSettings(); });
        text.inputEl.type = "password";
        text.inputEl.id = "sss-enc-password";
      })
      .addButton((btn) => {
        btn.setButtonText("Show").onClick(() => {
          const input = containerEl.querySelector<HTMLInputElement>("#sss-enc-password");
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          btn.setButtonText(hidden ? "Hide" : "Show");
        });
      });

    new Setting(containerEl)
      .setName("Encryption Method")
      .setDesc("openssl-base64 is simpler; rclone-base64 also encrypts file names.")
      .addDropdown((dd) =>
        dd
          .addOption("openssl-base64", "OpenSSL AES-CBC (encrypts content only)")
          .addOption("rclone-base64", "rclone Salsa20 (encrypts names + content)")
          .setValue(this.plugin.settings.encryptionMethod)
          .onChange(async (v: any) => { this.plugin.settings.encryptionMethod = v; await this.plugin.saveSettings(); })
      );

    // ── Sync Behaviour ────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Sync Behaviour" });

    new Setting(containerEl)
      .setName("Sync Direction")
      .addDropdown((dd) =>
        dd
          .addOption("bidirectional", "Bidirectional")
          .addOption("push_only", "Push only (local → remote)")
          .addOption("pull_only", "Pull only (remote → local)")
          .setValue(this.plugin.settings.syncDirection)
          .onChange(async (v: any) => { this.plugin.settings.syncDirection = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Conflict Resolution")
      .setDesc("What to do when the same file was changed on both sides. The losing version is saved as a .conflict-YYYY-MM-DD backup before overwriting.")
      .addDropdown((dd) =>
        dd
          .addOption("keep_newer", "Keep newer version")
          .addOption("keep_larger", "Keep larger version")
          .addOption("keep_local", "Always keep local")
          .addOption("keep_remote", "Always keep remote")
          .setValue(this.plugin.settings.conflictResolution)
          .onChange(async (v: any) => { this.plugin.settings.conflictResolution = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Delete Behaviour")
      .setDesc("Where to send files when they are deleted during sync.")
      .addDropdown((dd) =>
        dd
          .addOption("trash_system", "Move to system trash")
          .addOption("trash_local", "Move to Obsidian trash (.trash folder)")
          .addOption("permanent", "Delete permanently")
          .setValue(this.plugin.settings.deleteBehaviour)
          .onChange(async (v: any) => { this.plugin.settings.deleteBehaviour = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Skip Files Larger Than (MB)")
      .setDesc("Files above this size are skipped. Set to 0 to sync all files.")
      .addText((text) => {
        const mb = this.plugin.settings.maxFileSizeBytes > 0
          ? String(this.plugin.settings.maxFileSizeBytes / 1024 / 1024)
          : "0";
        text.setPlaceholder("0").setValue(mb).onChange(async (v) => {
          const n = parseFloat(v);
          this.plugin.settings.maxFileSizeBytes = n > 0 ? Math.floor(n * 1024 * 1024) : -1;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Ignore Paths")
      .setDesc("One pattern per line. Supports * and **. Examples: '*.tmp', 'archive/', '**/node_modules/**'. Lines starting with # are comments.")
      .addTextArea((area) => {
        area
          .setPlaceholder("*.tmp\narchive/\n# comment")
          .setValue((this.plugin.settings.ignorePaths ?? []).join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.ignorePaths = v.split("\n").map((l) => l.trim()).filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 6;
        area.inputEl.style.width = "100%";
        area.inputEl.style.fontFamily = "monospace";
      });

    // ── Automation ────────────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Automation" });

    new Setting(containerEl)
      .setName("Auto-Sync Every (minutes)")
      .setDesc("Set to 0 to disable auto-sync.")
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
      .setDesc("Trigger sync N seconds after saving a file. 0 = disabled.")
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
      .setDesc("Include your Obsidian configuration files in the sync.")
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
      .setDesc("Clears the local record of what was synced last time. The next sync will do a full comparison of local vs remote.")
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
