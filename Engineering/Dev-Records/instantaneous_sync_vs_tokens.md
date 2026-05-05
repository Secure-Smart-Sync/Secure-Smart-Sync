### Engineering Note: Adaptive Polling Architecture for Instant Sync

**Author:** sen
**GitHub Username:** xensenx

## Context and Problem Statement
The current coordination layer relies on a fixed 30-second interval to poll the Cloudflare R2 sentinel file. While this strictly guards against exceeding the Cloudflare R2 free tier limit (10M Class B read operations/month), it introduces unacceptable latency. The objective is to achieve near-instantaneous synchronization across devices immediately after an idle sync completes, without compromising our free-tier operational constraints or making unnecessary network calls.

## Architectural Solution: Adaptive Polling
To balance instantaneous detection with network and cost efficiency, we are replacing the fixed polling interval with an Adaptive Polling architecture. This model adjusts the polling frequency dynamically based on local user activity state.

### Polling States
1. Active Window (High Frequency): If the user has made edits within the last 2 minutes, the system polls the sentinel every 4 seconds. This guarantees near-instant sync propagation during active cross-device usage.
2. Idle Window (Low Frequency): If no edits are detected for over 2 minutes, but the application remains in focus, the system decays the polling interval back down to the conservative 30 seconds.
3. Background State (Paused): If the document is hidden or the application is backgrounded, polling remains paused entirely, utilizing our existing document visibility guards.

### Resource Impact Analysis
To ensure we remain safely within the 10M free operations limit, we model a heavy usage scenario of 8 hours of continuous active typing and 16 hours of idle application time per day, across two devices:
- Active polling (4s interval for 8h): ~7,200 operations/day.
- Idle polling (30s interval for 16h): ~1,920 operations/day.
- Total monthly cost per device pair: ~273,600 operations.
This heavy estimation consumes less than 3% of the 10M monthly free tier quota, providing massive overhead safety while drastically improving synchronization UX.

## Implementation Directives
1. State Tracking: Introduce a `_lastEditAt` timestamp variable. This must be updated globally via the existing `editor-change` event listeners.
2. Interval Resolution: Implement a `getAdaptivePollInterval()` helper method that evaluates the delta between `Date.now()` and `_lastEditAt`, returning either 4000ms (active) or 30000ms (idle).
3. Timer Refactor: Modify `scheduleSentinelPoll()`. The current static `setInterval` approach cannot adapt its rate dynamically. It must be refactored into a self-rescheduling, recursive `setTimeout` loop that re-evaluates the interval via `getAdaptivePollInterval()` on every tick.
