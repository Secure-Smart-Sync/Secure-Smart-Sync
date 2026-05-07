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

The full behavior and functionality of the indicator is documented separately.