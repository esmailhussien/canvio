# Master Execution Plan: Canvio Production & Launch Hardening

## Objective
Execute full production and launch hardening for Canvio, packaging the multi-package spatial whiteboard platform into an enterprise-ready single-node service, providing health monitoring, automated WebSocket concurrency stress testing, clean shutdown, and rock-solid stability.

## Phase 0: Survey & Codebase Exploration
- Dispatch 3 parallel Explorers:
  - **Explorer 1 (Packaging & Server Architecture)**: Investigate Dockerfile, root build scripts, server entrypoint (`apps/server` or `@canvio/server`), unified port binding, static frontend serving, Yjs WebSocket attachment, graceful shutdown hooks.
  - **Explorer 2 (Health & Observability)**: Investigate existing server endpoints, Fastify setup, WebSocket connection tracking, storage health / persistence adapters, memory and uptime metrics.
  - **Explorer 3 (Stress Testing & Performance/Security)**: Investigate existing test setups (vitest/jest/playwright), client/server collaboration protocols, rate limiting, error handling, scripts/smoke-check.mjs, and potential stress testing scripts.
- Synthesize explorer findings into `PROJECT.md` at workspace root.

## Phase 1: Decomposition & Dual Track Setup
- Track A: E2E Testing Orchestrator (Opaque-box test harness, stress testing suite, health verification, Tiers 1-4).
- Track B: Implementation Milestones:
  - Milestone 1: Containerized Single-Node Production Deployment (R1)
  - Milestone 2: System Health & Observability Endpoints (R2)
  - Milestone 3: Automated Concurrency & WebSocket Stress Testing (R3)
  - Milestone 4: Production Hardening, Graceful Shutdown, Security & 60fps pan/zoom validation (R4)
  - Final Milestone: 100% E2E test pass + adversarial coverage hardening (Tier 5)

## Phase 2: Execution & Gating
- Iterate through each milestone using standard cycle:
  Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor -> Gate Check.
- Strictly enforce passing build, unit tests, typechecks, and clean audit verdicts.

## Phase 3: Verification & Reporting
- Verify all acceptance criteria:
  - `npm run typecheck` across all 6 packages.
  - `npm run test:unit` passes 100%.
  - `npm run build` succeeds cleanly.
  - `npm run smoke` passes.
  - Stress test with 30+ simultaneous clients passes with 0 drops / 0 leaks.
  - Health check endpoint responds accurately.
  - Multi-stage Dockerfile verified.
- Deliver structured handoff and victory report to parent (Sentinel).
