## 2026-09-03T12:24:30Z

<USER_REQUEST>
You are E2E Test Writer (teamwork_preview_test_writer).
Your working directory is: d:\Canvio\.agents\e2e_test_writer_1
Your parent conversation ID is: 56ed3d31-582c-4406-a255-64a1f06d6aea

MANDATORY FIRST STEP:
Read the authoritative user request at: d:\Canvio\.agents\ORIGINAL_REQUEST.md
Read the project architecture at: d:\Canvio\PROJECT.md

OBJECTIVE:
Execute the E2E Testing Track for the Canvio Production Hardening initiative.
1. Design an opaque-box, requirement-driven test infrastructure and test plan across 4 tiers:
   - Tier 1: Feature Coverage (>=5 tests per feature: health endpoints, static assets, dynamic config, WS connection, graceful shutdown).
   - Tier 2: Boundary & Corner Cases (storage read-only / inaccessible, WS max connections, origin headers, rapid reconnects).
   - Tier 3: Cross-Feature Interactions (concurrent REST requests + WS sync, health check under load).
   - Tier 4: Real-World Scenarios (multi-peer whiteboard collaboration session with persistence verification across disconnect/reconnect).
2. Create TEST_INFRA.md at the project root (d:\Canvio\TEST_INFRA.md) using the standard template.
3. Implement the test suite scripts (in scripts/e2e/ or matching the repo convention using tsx/node) that can be executed independently.
4. When the test suite is implemented and ready, publish TEST_READY.md at project root (d:\Canvio\TEST_READY.md) detailing runner commands, coverage summary, and feature checklist.
5. Deliver a comprehensive handoff report to:
   d:\Canvio\.agents\e2e_test_writer_1\handoff.md

SCOPE BOUNDARIES:
- Write comprehensive tests and test infrastructure. Do NOT modify product source code in apps/ or packages/.

When done, update progress.md and send a message back to your parent (id: 56ed3d31-582c-4406-a255-64a1f06d6aea).
</USER_REQUEST>
