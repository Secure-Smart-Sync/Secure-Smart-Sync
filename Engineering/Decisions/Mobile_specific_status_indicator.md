# Mobile Specific Status Indicator

## Core Realization

One of the earliest realizations during the development of Secure Smart Sync was that Obsidian on mobile and Obsidian on desktop are fundamentally different when it comes to user interface and user experience.

Mobile does not have a ribbon bar, as those actions are handled through a drawer-based interface. It also lacks a proper status bar.

This created a unique challenge for Secure Smart Sync.

## The Problem With Toast Notifications

Earlier versions of the plugin relied on popup toast notifications to communicate sync activity.

This quickly introduced a major UX issue.

Toast notifications were intrusive and frequently interrupted the writing experience.

The first instinct was to disable toast notifications for Auto Sync and Smart Sync while preserving them only for Manual Sync actions.

This solved the interruption problem on desktop because desktop users could still rely on the status bar to understand what was happening in the background.

## The Mobile Problem

On mobile, removing toast notifications created a much bigger issue.

Users became completely blind to background sync activity.

They had no reliable way to know:

- whether sync was currently running
- whether sync had completed
- whether something failed
- whether the plugin was doing anything at all

This turned out to be worse than intrusive notifications.

## The Decision

This led to one of the most important UX decisions made during the development of the plugin.

A small sync status indicator was placed directly on the mobile dashboard, positioned next to the sidebar icon.

The design was intentionally kept minimal so that it feels native to Obsidian rather than looking like an external UI element.

The indicator:

- appears only on the main dashboard
- disappears when the sidebar is opened
- disappears in settings views
- stays visible only when it is contextually useful

This approach preserved visibility without sacrificing usability.

## Indicator Behavior

When the plugin is idle, the icon remains **gray**.

Clicking the gray icon triggers a manual sync and displays a toast notification, since toast notifications are intentionally preserved for manual sync actions.

When Auto Sync or Smart Sync is enabled:

- the icon turns **blue** in older versions
- the icon turns **purple** in newer versions

This indicates that sync is currently in progress.

Clicking the icon during this state opens a small message bar that displays:

- current sync progress
- current sync status
- number of files synced

After a successful sync completion, the icon turns **green**.

Clicking it displays:

- successful sync confirmation
- number of files synced successfully

If something goes wrong, the icon turns **red**.

This can represent issues such as:

- R2 configuration problems
- network failures
- authentication issues
- other sync failures

Clicking the red state provides detailed information about what went wrong.

## Design Outcome

The goal was to deliver complete sync visibility while using minimal interface space.

Expanding detailed information only when the user intentionally clicks the icon turned out to be the right design decision.

It keeps the mobile writing experience non-intrusive while still ensuring that users are never blind to background sync behavior.

A similar approach was implemented on desktop.

Instead of introducing a separate status indicator, the existing ribbon icon uses the same color cues.

Desktop users also continue to benefit from the existing status bar for persistent sync visibility.