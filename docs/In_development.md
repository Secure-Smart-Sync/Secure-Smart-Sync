# In Development

Secure Smart Sync already ships with a functional merge conflict resolution system, but like most synchronization architectures, conflict handling remains one of the most complex areas to fully solve.

The current system resolves conflicts through deterministic rules such as:

- Keep newer version
- Keep larger version
- Keep remote version
- Keep local version

These options are user-selectable and intentionally static. They helped reduce complexity during early development and made it possible to stabilize the broader sync architecture faster. However, synchronization systems involve many moving parts, and overly rigid conflict behavior can eventually create user experience issues in edge cases where static decisions may not reflect user intent.

Following the release of **SSS v1.0.0**, one of the first major milestones for this project is improving conflict handling, edge-case resilience, and overall error recovery.

## Planned Merge Conflict Improvements

### Keep Both as a Smart Sync Default
Since merge conflicts are more likely to occur during automated Smart Sync workflows, one planned improvement is allowing users to default to **Keep Both** during automated conflicts.

Instead of silently overwriting one version, SSS will preserve both files using smarter naming conventions that make duplicate versions easier to identify and manage.

## Always Ask Option
Another planned option is an **Always Ask** mode.

This would trigger a minimal and non-intrusive UI prompt asking users which version they want to keep whenever a conflict occurs.

While this may interrupt workflow for casual users, it could save significant time for power users who prefer manual control over conflict decisions.

For the next iteration, the goal is to keep this system simple and reliable before exploring more advanced user-driven conflict workflows.

## Encryption Locking Improvements
Currently, users can switch encryption methods after initial configuration.

This creates a dangerous edge case where users may accidentally lock themselves out of their own vault by changing encryption systems after files have already been uploaded.

A planned improvement is to permanently lock users into their selected encryption method after initial setup unless they intentionally perform a migration workflow.

This area still needs stronger safeguards and better UX protection.

## Relay Configuration Improvements
The current relay system transfers Cloudflare R2 credentials during device pairing.

Future improvements will expand this process to also transfer:

- encryption passwords
- plugin preferences
- sync settings
- configuration metadata

This is important because mismatched encryption settings can cause remote folder fragmentation.

For example, a device configured with incorrect encryption credentials may unintentionally create a separate encrypted vault structure, causing the second device to break synchronization entirely.

This is a known issue and considered a high-priority improvement.

## Unknown Edge Cases
Like any synchronization architecture, some edge cases only appear under highly specific user behavior and are difficult to consistently reproduce.

Some known issues are still being investigated, while others may not have been discovered yet.

The long-term goal is to ensure that all edge cases are handled through graceful prevention, safer defaults, or clean recovery mechanisms rather than allowing silent failures.

SSS v1.0.0 established the foundation.

The next phase of development is focused on hardening that foundation.
