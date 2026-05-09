/**
 * ui-indicator.ts
 * All visual state indicators for SSS:
 *   - Desktop ribbon badge + status pill
 *   - Mobile floating circular indicator + expanding pill
 *   - Mobile visibility watcher (hides indicator when overlays are present)
 *
 * Extracted from main.ts to isolate DOM manipulation from sync logic.
 */

import { Platform } from "obsidian";
import type { App } from "obsidian";

// ─── Ribbon indicator ─────────────────────────────────────────────────────────

export type IndicatorStatus = "idle" | "syncing" | "success" | "conflict" | "error";

export interface RibbonState {
  ribbonEl?:            HTMLElement;
  statusBarEl?:         HTMLElement;
  statusPillEl?:        HTMLElement;
  ribbonSuccessTimer?:  ReturnType<typeof setTimeout>;
  statusPillTimer?:     ReturnType<typeof setTimeout>;
  lastStatusText:       string;
  syncProgress:         { done: number; total: number };
}

/**
 * Update the ribbon icon state via CSS class only.
 * 'success' automatically fades back to 'idle' after 3 seconds.
 */
export function setRibbonStatus(state: RibbonState, status: IndicatorStatus): void {
  if (!state.ribbonEl) return;

  if (state.ribbonSuccessTimer !== undefined) {
    window.clearTimeout(state.ribbonSuccessTimer);
    state.ribbonSuccessTimer = undefined;
  }

  state.ribbonEl.removeClass(
    "sss-ribbon-syncing", "sss-ribbon-success",
    "sss-ribbon-conflict", "sss-ribbon-error"
  );
  if (status !== "idle") {
    state.ribbonEl.addClass(`sss-ribbon-${status}`);
  }

  if (status === "success") {
    state.ribbonSuccessTimer = window.setTimeout(() => {
      setRibbonStatus(state, "idle");
    }, 3000);
  }
}

/** Show/update the status bar text. */
export function setStatusText(state: RibbonState, text: string): void {
  state.statusBarEl?.setText(text);
}

/**
 * Show a floating pill to the right of the ribbon icon.
 * Auto-dismisses after 4 seconds.
 */
export function showStatusPill(state: RibbonState, isSyncing: boolean): void {
  if (!state.ribbonEl) return;
  dismissStatusPill(state);

  const rect = state.ribbonEl.getBoundingClientRect();
  const pill = document.body.createDiv({ cls: "sss-status-pill" });

  if (isSyncing) {
    const { done, total } = state.syncProgress;
    pill.textContent = total > 0 ? `Syncing ${done} / ${total}` : "Syncing\u2026";
  } else {
    pill.textContent = state.lastStatusText || "Up to date";
  }

  pill.style.top  = `${rect.top + rect.height / 2}px`;
  pill.style.left = `${rect.right + 10}px`;

  state.statusPillEl = pill;
  state.statusPillTimer = window.setTimeout(() => dismissStatusPill(state), 4000);
}

/** Remove the floating status pill from the DOM. */
export function dismissStatusPill(state: RibbonState): void {
  if (state.statusPillTimer !== undefined) {
    window.clearTimeout(state.statusPillTimer);
    state.statusPillTimer = undefined;
  }
  if (state.statusPillEl) {
    state.statusPillEl.remove();
    state.statusPillEl = undefined;
  }
}

// ─── Mobile indicator ─────────────────────────────────────────────────────────

export interface MobileState {
  mobileIndicatorEl?:       HTMLElement;
  mobilePillEl?:            HTMLElement;
  mobilePillTimer?:         ReturnType<typeof setTimeout>;
  mobileSuccessTimer?:      ReturnType<typeof setTimeout>;
  mobilePillExpanded:       boolean;
  mobileVisibilityObserver?: MutationObserver;
}

const MOBILE_LOGO_SVG = `<svg class="sss-mob-logo" viewBox="0 0 100 100"
  xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="currentColor" d="
M46.63 93.84 c-7.49 -0.58 -14.72 -3.10 -21.04 -7.34 c-3.83 -2.57 -7.43 -5.94 -10.36 -9.69
c-4.58 -5.87 -7.70 -13.35 -8.63 -20.75 c-0.40 -3.15 -0.45 -7.81 -0.12 -10.79
c0.56 -4.91 2.00 -9.91 4.14 -14.26 c5.59 -11.34 15.58 -19.72 27.51 -23.10
c5.31 -1.49 10.77 -1.97 16.36 -1.42 c20.81 2.06 37.58 19.22 39.17 40.09
c0.17 2.29 0.07 7.24 -0.20 9.17 c-0.89 6.50 -2.66 11.64 -5.86 16.94
c-2.12 3.52 -4.85 6.88 -7.73 9.50 c-7.46 6.83 -16.67 10.88 -26.46 11.64
c-1.48 0.11 -5.31 0.11 -6.80 -0.01z
m6.76 -15.96 c8.81 -1.16 17.13 -6.82 20.49 -13.97 c1.13 -2.39 1.72 -5.12 1.57 -7.26
c-0.43 -6.08 -4.59 -11.60 -10.15 -13.45 c-2.50 -0.83 -4.51 -0.93 -6.85 -0.33
c-0.86 0.22 -2.01 0.65 -2.01 0.77 c0 0.04 0.10 0.15 0.21 0.25
c0.37 0.33 1.90 2.43 2.43 3.33 c1.15 1.95 1.46 2.61 1.46 3.13
c0 1.15 -0.24 1.13 -7.08 -0.63 c-2.95 -0.76 -6.97 -1.79 -8.94 -2.28
c-1.96 -0.50 -3.68 -0.96 -3.82 -1.04 c-0.32 -0.16 -0.38 -0.31 -0.38 -0.92
c0 -0.59 0.13 -0.75 1.50 -1.93 c5.07 -4.39 11.36 -7.02 18.13 -7.64
c1.66 -0.15 5.39 -0.12 6.94 0.05 c2.47 0.27 4.79 0.77 6.82 1.46
c0.55 0.19 1.00 0.32 1.00 0.29 c0 -0.02 -0.22 -0.49 -0.50 -1.02
c-1.78 -3.56 -4.91 -7.20 -8.20 -9.52 c-4.44 -3.15 -9.11 -4.82 -14.54 -5.21
c-2.89 -0.21 -6.55 0.28 -9.67 1.29 c-6.66 2.16 -12.16 6.70 -15.23 12.59
c-1.88 3.60 -2.64 7.63 -2.07 10.95 c0.72 4.19 2.88 7.66 6.28 10.09
c2.73 1.95 6.54 3.03 9.53 2.70 c0.96 -0.11 2.31 -0.36 2.49 -0.47
c0.04 -0.02 -0.08 -0.22 -0.26 -0.45 c-0.71 -0.88 -1.65 -2.38 -2.31 -3.68
c-0.62 -1.22 -0.68 -1.43 -0.68 -1.93 c0 -0.31 0.05 -0.62 0.12 -0.68
c0.30 -0.30 1.24 -0.14 6.72 1.25 c2.98 0.75 6.85 1.72 8.59 2.15
c1.75 0.43 3.27 0.83 3.40 0.88 c0.19 0.08 0.21 0.17 0.21 0.71
c0 0.59 -0.02 0.63 -0.36 0.97 c-1.12 1.06 -3.58 2.74 -5.44 3.74
c-3.75 1.98 -7.77 3.20 -11.86 3.57 c-1.70 0.16 -6.10 0.08 -7.64 -0.14
c-1.77 -0.25 -4.11 -0.81 -5.81 -1.38 c-0.86 -0.29 -1.57 -0.52 -1.58 -0.50
c-0.07 0.07 1.07 1.94 1.82 2.97 c4.61 6.46 12.22 10.72 20.42 11.44
c1.31 0.12 3.77 0.05 5.25 -0.14z
"/>
  </svg>`;

/**
 * Inject the persistent circular indicator into document.body.
 * Positioned just to the right of the sidebar toggle on mobile.
 *
 * Note: the layout-change workspace event (sidebar open/close) must be
 * registered by the caller via Plugin.registerEvent() to ensure proper cleanup.
 */
export function mountMobileIndicator(
  mState: MobileState,
  app: App,
  onTap: () => void,
  _onLayoutChange?: () => void  // kept for signature compatibility; caller registers directly
): void {
  if (!Platform.isMobile) return;
  if (mState.mobileIndicatorEl) return;

  const el = document.body.createDiv({ cls: "sss-mob-indicator sss-mob-idle" });
  el.innerHTML = MOBILE_LOGO_SVG;
  el.addEventListener("click", onTap);
  mState.mobileIndicatorEl = el;

  setupMobileVisibilityWatcher(mState, app);
}

/** Update the mobile indicator colour state. */
export function updateMobileIndicator(mState: MobileState, status: IndicatorStatus): void {
  const el = mState.mobileIndicatorEl;
  if (!el) return;

  if (mState.mobileSuccessTimer !== undefined) {
    window.clearTimeout(mState.mobileSuccessTimer);
    mState.mobileSuccessTimer = undefined;
  }

  const wasHidden = el.classList.contains("sss-mob-hidden");
  el.className = `sss-mob-indicator sss-mob-${status}`;
  if (wasHidden) el.classList.add("sss-mob-hidden");

  if (status === "success") {
    mState.mobileSuccessTimer = window.setTimeout(() => {
      updateMobileIndicator(mState, "idle");
    }, 3000);
  }
}

/** Expand the rightward pill showing sync status. */
export function expandMobilePill(
  mState: MobileState,
  isSyncing: boolean,
  lastStatusText: string,
  syncProgress: { done: number; total: number }
): void {
  if (!mState.mobileIndicatorEl) return;
  collapseMobilePill(mState);

  const pill = document.body.createDiv({ cls: "sss-mob-pill" });

  if (isSyncing) {
    const { done, total } = syncProgress;
    pill.textContent = total > 0 ? `Syncing ${done} / ${total}` : "Syncing\u2026";
  } else {
    pill.textContent = lastStatusText || "Up to date";
  }

  const rect = mState.mobileIndicatorEl.getBoundingClientRect();
  pill.style.top  = `${rect.top + rect.height / 2}px`;
  pill.style.left = `${rect.right + 6}px`;

  mState.mobilePillEl      = pill;
  mState.mobilePillExpanded = true;

  if (!isSyncing) {
    mState.mobilePillTimer = window.setTimeout(() => collapseMobilePill(mState), 4000);
  }
}

/** Collapse the mobile pill with exit animation. */
export function collapseMobilePill(mState: MobileState): void {
  if (mState.mobilePillTimer !== undefined) {
    window.clearTimeout(mState.mobilePillTimer);
    mState.mobilePillTimer = undefined;
  }
  if (mState.mobilePillEl) {
    mState.mobilePillEl.addClass("sss-mob-pill-out");
    window.setTimeout(() => {
      mState.mobilePillEl?.remove();
      mState.mobilePillEl = undefined;
    }, 200);
  }
  mState.mobilePillExpanded = false;
}

/** Remove the mobile indicator and all observers entirely. */
export function teardownMobileIndicator(mState: MobileState): void {
  mState.mobileVisibilityObserver?.disconnect();
  mState.mobileVisibilityObserver = undefined;
  collapseMobilePill(mState);
  if (mState.mobileSuccessTimer !== undefined) {
    window.clearTimeout(mState.mobileSuccessTimer);
    mState.mobileSuccessTimer = undefined;
  }
  if (mState.mobileIndicatorEl) {
    mState.mobileIndicatorEl.remove();
    mState.mobileIndicatorEl = undefined;
  }
}

// ─── Mobile visibility watcher ────────────────────────────────────────────────

function setupMobileVisibilityWatcher(mState: MobileState, app: App): void {
  const refresh = () => refreshMobileIndicatorVisibility(mState, app);

  let noticeContainerObserver: MutationObserver | undefined;
  const attachNoticeObserver = (container: Element) => {
    if (noticeContainerObserver) return;
    noticeContainerObserver = new MutationObserver(refresh);
    noticeContainerObserver.observe(container, { childList: true });
  };

  const existingNc = document.body.querySelector(".notice-container");
  if (existingNc) attachNoticeObserver(existingNc);

  let drawerObserver: MutationObserver | undefined;
  const attachDrawerObserver = (drawer: Element) => {
    if (drawerObserver) return;
    drawerObserver = new MutationObserver(refresh);
    drawerObserver.observe(drawer, { attributes: true, attributeFilter: ["class", "style"] });
  };

  const existingDrawer = document.body.querySelector(".workspace-drawer.mod-left");
  if (existingDrawer) attachDrawerObserver(existingDrawer);

  const bodyObserver = new MutationObserver(() => {
    const nc = document.body.querySelector(".notice-container");
    if (nc) attachNoticeObserver(nc);
    if (!drawerObserver) {
      const drawer = document.body.querySelector(".workspace-drawer.mod-left");
      if (drawer) attachDrawerObserver(drawer);
    }
    refresh();
  });
  bodyObserver.observe(document.body, {
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  const workspaceEl =
    document.body.querySelector(".workspace") ??
    document.body.querySelector(".app-container");
  let workspaceObserver: MutationObserver | undefined;
  if (workspaceEl) {
    workspaceObserver = new MutationObserver(refresh);
    workspaceObserver.observe(workspaceEl, { attributes: true, attributeFilter: ["class"] });
  }

  mState.mobileVisibilityObserver = {
    disconnect() {
      bodyObserver.disconnect();
      noticeContainerObserver?.disconnect();
      workspaceObserver?.disconnect();
      drawerObserver?.disconnect();
    },
    observe()    {},
    takeRecords: () => [],
  } as unknown as MutationObserver;

  refresh();
}

/**
 * Show/hide the indicator based on live DOM state.
 * Hidden when a modal, command palette, notices, or the sidebar are visible.
 */
export function refreshMobileIndicatorVisibility(mState: MobileState, app: App): void {
  const el = mState.mobileIndicatorEl;
  if (!el) return;

  const hasModal  = !!document.body.querySelector(".modal-container");
  const hasPrompt = !!document.body.querySelector(".prompt");

  const noticeContainer = document.body.querySelector(".notice-container");
  const hasNotices = !!noticeContainer && noticeContainer.childElementCount > 0;

  const ws = app.workspace as any;
  const wsModelOpen = !!(ws.leftSplit && ws.leftSplit.collapsed === false);

  const sidebarOpen =
    wsModelOpen ||
    document.body.classList.contains("is-left-sidebar-open") ||
    !!document.body.querySelector(".workspace.is-left-sidebar-open") ||
    !!document.body.querySelector(".app-container.is-left-sidebar-open") ||
    (() => {
      const d = document.body.querySelector<HTMLElement>(".workspace-drawer.mod-left");
      if (!d) return false;
      return d.classList.contains("is-open") || d.getBoundingClientRect().right > 10;
    })();

  const shouldHide = hasModal || hasPrompt || hasNotices || sidebarOpen;
  el.classList.toggle("sss-mob-hidden", shouldHide);

  if (shouldHide && mState.mobilePillExpanded) {
    collapseMobilePill(mState);
  }
}
