# Mobile Specific Status Indicator

Created via ChatGPT GitHub integration test.

## Problem
Mobile devices have limited screen space, so desktop-style sync indicators become noisy and easy to ignore.

## Recommended States
- Idle
- Syncing
- Completed
- Failed
- Conflict

## Design Notes
- Keep the indicator glanceable
- Allow tap-to-expand for detailed logs
- Conflicts should be visually distinct
- Avoid persistent UI clutter

## Why this matters
Users often open Obsidian on mobile for quick note edits. They need confidence that sync worked without digging through logs.

And yes — this file also proves ChatGPT can finally write to your repo 😌