# Enterprise release gap register

Follow-on implementation: [multi-entity and reliability milestone](reliability-implementation.md). Recording lifecycle/privacy, human review, production configuration and evaluation tooling below now have implementations; their real-environment acceptance gates remain open. The table preserves the original assessment, not the current implementation status.

Assessment date: 2026-09-08. Evidence is the inspected repository and local tests, not a deployed-system audit. This is a prioritized working register, not a claim that every defect has been found.

## Release gates

| Priority | Gap and repository evidence | Acceptance gate |
| --- | --- | --- |
| P0 | Shared workspace: no tenant membership/resource boundary; operational socket broadcasts reach authenticated users. | Either explicitly deploy one isolated organization per installation, or implement and test tenant/site scope across REST, sockets, storage, engine assignments, and jobs. Cross-tenant negative tests must pass. |
| P0 | Privacy masks protect AI/live images but direct FFmpeg recordings/HLS use original streams. | Define masked/unmasked access policy and enforce it in every video, snapshot, export, training-data, and evidence path; verify with a known masked scene. Do not claim recordings are privacy-masked today. |
| P0 | OAuth callback places tokens in URLs; email-based account linking needs verification. Browser tokens remain in localStorage. Logout does not yet guarantee immediate server-side socket/session revocation. | Use one-time callback exchange or secure cookie sessions, verified linking, CSRF protection as applicable, session revocation, and browser security regressions. Add enterprise identity/MFA after the basic flow is secure. |
| P0 | Camera URLs are protocol-validated but destinations are not restricted; outbound webhook/probe paths require destination review. | Per-installation authorized camera network policy, DNS/rebinding controls, blocked metadata destinations, egress controls, timeouts and response-size limits. Private camera networks must be supported deliberately, not blanket-blocked. |
| P0 | Compose app-local build contexts conflict with root workspace dependencies; backend Docker command targets old output path. Root npm dependency requires Windows; Python requirements include platform/version issues. | Reproducible clean Linux image builds, no secrets in build context, non-root runtime, matched Python/native dependencies, real Compose startup and readiness checks. Current CI is Windows only. |
| P0 | Deployment requires TLS, secret provisioning, network boundaries and tested backups. Database/MinIO defaults and exposed ports need review. | HTTPS/WSS, secret rotation/key recovery drill, restricted internal services, encrypted backups, demonstrated restore with measured recovery time and data loss. |
| P1 | Recording stores full videos as PostgreSQL bytes; lifecycle failures can leave empty records; local cleanup, limits, FFmpeg shutdown and retry behavior need redesign. | Durable object storage, explicit recording states, bounded concurrency/storage, retry-safe metadata, retention/legal-hold rules, authenticated range playback, restore and failure tests. |
| P1 | AI model availability is reported, but accuracy is unmeasured. Specialist safety/traffic/ReID/forecast modules and shared state still need individual review. | Licensed/versioned models; representative authorized test footage; per-feature precision/recall and false alarms/hour; night/occlusion tests; per-camera state isolation and reproducible benchmark report. No invented accuracy percentage. |
| P1 | Engine heartbeat and stream freshness exist, but multi-engine ownership, durable delivery, deduplication and overload behavior are not proven. | Camera assignment/leases, idempotent event IDs, bounded queues, reconnect reconciliation, event ordering and sustained-load/chaos tests. Measure camera-to-alert latency and dropped frames. |
| P1 | Audit writes are best-effort; alert/webhook/escalation delivery and retention need end-to-end validation. | Durable audit/event handling, delivery retries and dead-letter inspection, acknowledgment/escalation tests, access/export audit records and tamper-evident retention. |
| P1 | Database transactions are mocked in current regressions; web tests exercise a session coordinator, not the actual browser UI. | Isolated PostgreSQL integration including refresh races/rollback; browser login/live/alerts/recordings/role tests; native RTSP fixture tests; security and dependency scanning in CI. |
| P1 | Biometric embeddings need lifecycle/privacy policy; enrollment currently needs further multi-embedding and atomic sync review. | Purpose-limited enrollment, deletion/retention propagation, encrypted restricted storage, human review of matches, access audit and jurisdiction-specific review before biometric deployment. |
| P2 | Operator experience and incident handling lack a measured acceptance baseline. | Camera disconnect/tamper/storage failure visibility, searchable incident timeline, evidence integrity verification, accessible keyboard workflows, timezone correctness, and operator acceptance tests. |

## Suggested next implementation order

1. Close OAuth/session and outbound destination controls; add negative authorization tests.
2. Repair clean Linux deployment and test an isolated database/camera fixture stack.
3. Make recording storage and privacy policy consistent end to end.
4. Establish representative accuracy, latency, capacity and recovery baselines before expanding AI features.
5. Add multi-site/tenant capabilities only with explicit boundaries and corresponding isolation tests.

## Evidence limits

Local hardening results are recorded in [production-hardening.md](production-hardening.md). No compliance certification, pentest, accuracy benchmark, real-camera soak test, production migration or deployment has been performed. SMTP/object storage configuration availability is not established by reading source code. “Best” must be judged against measured reliability, useful alerts, safe access, recoverability and operator outcomes—not number of dashboard pages.
