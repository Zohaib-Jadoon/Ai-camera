# Production hardening progress

Latest follow-on: [multi-entity and reliability implementation](reliability-implementation.md). That milestone adds **required database migrations**, object-storage requirements and legacy-recording download restrictions. Follow its rollout instructions before starting the changed application; the earlier no-migration notes below are historical.

## Current batch — 2026-09-08

This section supersedes the earlier foundation snapshot below. This is a hardening milestone, not production certification. See [enterprise gaps](enterprise-gaps.md) for outstanding release gates.

### Implemented

- Automatic access-token renewal shared by HTTP and Socket.IO, single-flight renewal, cross-tab locking where supported, storage synchronization, and protection against logout/account-switch races. Transient network errors do not erase credentials. Tokens remain in localStorage; HttpOnly session migration remains open.
- Dedicated versioned AES-256-GCM camera credential encryption, key IDs and previous-key support, strict RTSP/RTSPS validation, redacted camera responses for every role, and sanitized error/probe logging. URL validation is not network destination authorization.
- Self-registration and first-time OAuth signup disabled by default. Admin seeding requires an explicit strong password. Existing OAuth accounts can still sign in; OAuth token transport remains a release blocker.
- Removed fabricated fallback object/face detections. Model health has a protected API and a live-view warning. Shared model calls are serialized; the detector no longer owns cross-camera persistent tracking state.
- Capture uses fresh real frames, sequence numbers, reconnect/backoff, bounded native timeouts, and awaited shutdown/reconfiguration. New ASGI lifecycle tests cover startup failure and cleanup.
- Privacy masks are validated, synchronized after changes, and applied to inference and outgoing annotated live frames. Invalid masks black out the entire frame. Fixed missing zone-to-gateway dependency injection. Direct FFmpeg recordings/HLS are NOT masked by this change.
- Recording purge changed from GET to ADMIN-only POST, retention bounded to 1–3650 days, list limits bounded to 1–500. Database creation failure releases the recording reservation. Raw FFmpeg errors are excluded from application logs.
- Added a Windows CI workflow for backend/web tests and builds plus lightweight Python safety tests. Its first hosted run is still pending; it does not validate Linux deployment or native model accuracy.

### Current verification

82 backend tests in 14 suites, 8 web session-coordinator tests, and 16 Python safety tests pass locally. Backend compilation, the full web production build (31 pages), web TypeScript checking, Python source compilation, and diff whitespace checks pass. Native camera/model libraries are mocked in the Python safety suite. PostgreSQL integration, real browser workflows, model accuracy, hardware load, and container startup are not established by these results.

### Required rollout procedure

1. Back up the database AND encryption keys outside the repository. Retain the original JWT secret until all legacy camera values have been migrated.
2. Configure `CAMERA_ENCRYPTION_KEY` as 64 hexadecimal characters, with `CAMERA_ENCRYPTION_KEY_ID=primary`. This batch created a random key in the existing ignored backend `.env`; it did not populate deployment secrets or the root Compose environment. Never regenerate the key on every startup.
3. Initially allow `ALLOW_LEGACY_CAMERA_CREDENTIALS=true`. From `apps/backend`, run `npm run credentials:rotate` for a read-only assessment. After a verified backup, run `npm run credentials:rotate -- --apply --backup-confirmed`. Neither command was run against your database in this batch.
4. Resolve every reported failure/conflict, verify camera reads, then disable legacy reads. Retain old GCM keys in `CAMERA_ENCRYPTION_PREVIOUS_KEYS` during later key rotation. Losing a key loses the ability to decrypt those camera credentials.
5. Deploy backend, web, and engine together. Set matching explicit `AI_ENGINE_KEY` values. Existing bcrypt refresh-token sessions must sign in again. Keep `ALLOW_SELF_REGISTRATION=false` for the shared workspace.
6. Any external purge caller must use `POST /api/recordings/purge?days=N`; no repository web caller used the old GET route.

No database migration, seed, recording purge, deployment, or real camera connection was executed. Rolling back after credential rotation requires a version that understands GCM or a deliberate backup restoration plan; the old application cannot read newly encrypted values. Do not remove the dedicated key while encrypted records exist.

## Foundation batch — 2026-09-08

Implemented directly in the original repository. The earlier isolated foundation patch was reviewed and incorporated, with additional WebSocket admission and biometric enrollment fixes.

### Behavior now covered

- Opaque refresh tokens use an indexed SHA-256 digest of their complete value. The previous code incorrectly tried to decode these random strings as JWTs. Consumption and replacement run in one Prisma transaction; conditional deletion prevents a second consumer from issuing another replacement.
- Login rejects inactive accounts. HTTP JWT authentication reads current account status and role. JWT signing and verification require configuration rather than falling back to a known secret.
- Socket.IO authentication runs in middleware before admission to broadcasts and rooms. It validates JWT expiry and current account status, or a configured engine key. Missing accounts and database failures reject admission. Browser sockets disconnect at token expiry and return to sign-in.
- Camera configuration, stream probe URLs, face extraction images, and embedding synchronization are delivered to authenticated engine socket IDs. Both face enrollment HTTP paths use this private delivery. Bulk biometric export requires ADMIN.
- Stream probing reports failure if ffprobe cannot start. Probe diagnostics are drained without being retained or returned, and HLS command lines containing camera credentials are no longer logged.
- Live view holds at most one pending frame update. Stalled or disconnected footage has an explicit warning. The display rate uses elapsed time and is labeled as display updates per second. HTTP permission denials no longer log out a valid user.

### Validation

Commands from the repository root:

```powershell
npm test --workspace=backend -- --runInBand --no-cache
npm run build --workspace=backend
npm run build --workspace=web
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
git diff --check
```

Results: 6 backend suites / 43 tests passed; backend build, full web production build, frontend TypeScript check, and diff whitespace check passed. The web build initially could not reach Google Fonts inside the sandbox; the approved network-enabled retry passed, including generation of all 31 pages.

The backend suite includes real Socket.IO connections on ephemeral loopback ports, HTTP controller/role tests, and unit regression tests for refresh rotation, expiry timers, private message routing, and stream probing. Database behavior is mocked in these tests: actual PostgreSQL concurrent rotation and rollback still require an isolated database integration test.

### Rollout and operational limits

No schema migration or new dependency is required. Existing bcrypt refresh-token records cannot be converted without the original token; users must sign in again to obtain the new token format. Deploy backend and web together so the dashboard handles the new socket expiry event. Confirm JWT_SECRET and AI_ENGINE_KEY are explicitly configured and match the deployed services.

Browser token renewal is not automatic yet. Access-token expiry requires signing in again; the dashboard must not silently continue consuming video with expired authorization. Account deactivation is checked on each HTTP authentication and new socket connection; an already-connected socket currently lasts until access-token expiry.

No deployment, database mutation, real camera access, browser visual verification, or hardware benchmark was performed in this batch. These changes do not establish production readiness or multi-tenant isolation.

Before release, create a reviewed commit and retain the previous deployment artifact. A rollback should revert this batch as a coherent application change and require fresh sign-in. It restores known security defects and is unsuitable as a long-term production fallback. No database rollback is needed for this batch.

### Remaining release work

1. Browser session renewal, immediate socket revocation, safe OAuth token delivery, and registration/invitation policy.
2. Tenant membership and resource authorization across REST, sockets, storage, and background jobs. Authenticated operational broadcasts are still shared in the current single-organization model.
3. Camera credential exposure across remaining REST and logging paths, authenticated encryption with separate keys, and stream destination validation.
4. Remove synthetic AI fallback detections, report model readiness, isolate tracking across cameras, and benchmark the active pipeline.
5. Durable evidence storage, recording lifecycle and retention verification, deployment health checks, backup/restore drills, and automated CI.
6. Browser validation of live monitoring and operator workflows, followed by representative latency, capacity, and accuracy measurements.
