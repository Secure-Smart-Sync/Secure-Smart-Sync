R2 Operation Cost Breakdown
R2 operation types used by SSS:

Class A (write/list): PutObject (upload), DeleteObject, ListObjectsV2
Class B (read): GetObject (download), HeadObject (stat)
Free: Everything else (metadata stored in object, no separate ops)


Per-Operation Token Accounting
Every sync cycle (regardless of files changed):
OperationR2 ClassCountNotescheckConnection → ListObjectsV2 (MaxKeys=1)A1Always, before every syncwalk() → ListObjectsV2 (paginated)A1 per 1000 objectsFull vault listingHeadObject per file (if useAccurateMTime on)B1 per fileOff by default
Per file pushed (upload):
OperationR2 ClassCountPutObject (upload)A1HeadObject post-push (get ETag for prevSync)B1
Per file pulled (download):
OperationR2 ClassCountGetObjectB1HeadObject post-pull (optional, ETag already in walk)B0 (skipped, etag comes from walk)
Per file deleted:
OperationR2 ClassCountDeleteObjectA1
Conflict backup (if conflict occurs):
OperationR2 ClassCountGetObject (read loser)B1PutObject (write backup)A1
Sentinel (coordination layer):
OperationR2 ClassWhenHeadObject on __sss_state__/sync.jsonBEvery poll tickGetObject on sentinelBOnly when mtimeSvr changed (foreign write detected)PutObject on sentinelAOnce per real sync (not state_aware)
Password validation (on every sync with encryption):
OperationR2 ClassCountwalkPartial() → ListObjectsV2 (MaxKeys=20)A1
pairing (one-time, hits the Cloudflare Worker relay, not R2): 0 R2 ops.

Scenario Modelling
Assumptions for all scenarios:

useAccurateMTime = off (default)
No conflicts
Sentinel: 1 HEAD per poll tick, 1 GET only on foreign-write detection
Vault listing: 1 ListObjectsV2 per sync (vaults under 1000 files)


Scenario A — Solo device, light daily writer

1 device, Smart Sync on, 20 files changed/day, 8h active, 16h idle/backgrounded
Poll: ~4s active (8h), 30s idle — but device B doesn't exist, polling still runs

SourceClass AClass B3 syncs/day × (1 List + 1 PUT sentinel)6—3 syncs × 20 pushes × 1 PUT + 1 HEAD6060Sentinel polls: 8h×900 + 16h×120—9,120Daily total~66~9,180Monthly~2K~275K
→ Well within free tier. Solo use is trivially safe regardless of devices.

Scenario B — 2 devices, active writers, both open simultaneously

2 devices, Smart Sync on, 50 files changed/day split across both
Both active 8h/day, idle/background 16h

SourceClass A/deviceClass B/deviceSyncs: ~6/day × (1 List + 1 List encrypt-check + 1 PUT sentinel)18—6 syncs × 25 files × (1 PUT + 1 HEAD)300150Sentinel polls active (8h @ 4s = 7200 ticks)—7,200Sentinel polls idle (16h @ 30s = 1920 ticks)—1,920GET sentinel on foreign write (~6 times/day)—6Daily per device~318~9,276Daily × 2 devices~636~18,552Monthly~19K~557K
→ 5.6% of Class B free tier. Very comfortable.

Scenario C — 5 devices, heavy writers

5 devices, Smart Sync on, 200 files changed/day total
All active 10h/day, idle 14h

SourceClass A total/dayClass B total/daySyncs: ~10/device × 5 devices = 50 × (1 List + 1 sentinel PUT)100—50 syncs × 40 files avg × 1 PUT + 1 HEAD2,0002,000Sentinel polls: 5 devices × (10h×900 + 14h×120)—53,400GET sentinel on foreign write: ~40/day total—40Daily total~2,100~55,440Monthly~63K~1.66M
→ 16.6% of Class B, 6.3% of Class A. Still safe.

Scenario D — 10 devices (stress test)

10 devices, Smart Sync on, all active 12h/day

SourceClass A/monthClass B/monthSyncs + uploads~180K~90KSentinel polls: 10 × (12h×900 + 12h×120) × 30—3.78MMonthly total~180K~3.87M
→ 38.7% of Class B. Still within free tier, but this is the ceiling zone. If all 10 devices are active simultaneously 24/7 (unrealistic), you'd approach limits.

Scenario E — Large vault (5000 files), 2 devices

5000 files = 5 ListObjectsV2 pages per sync (1000 files/page = 5 Class A ops per sync)
10 syncs/day

SourceClass A/monthClass B/monthListing: 10 syncs × 2 devices × 5 pages × 303,000—Uploads/downloads~18K~9KSentinel polls—~557KMonthly~21K~566K
→ Fine. Listing pages only become a concern at vault sizes in the tens of thousands of files.

DevicesAssessment1–3Zero concern. Months of headroom.4–7Safe for typical use. Stay alert if all devices are active 24/7.8–10Approaching ~40% of Class B free tier with heavy use. Still free, but monitor.10+Not recommended without verifying your vault size and sync frequency. Risk of exceeding 10M Class B if all devices poll simultaneously around the clock.
