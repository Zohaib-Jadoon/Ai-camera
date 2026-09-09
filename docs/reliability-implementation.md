# Multi-entity and reliability milestone — 2026-09-08

## Implemented behavior

- Multiple people and mixed object classes retain distinct per-camera tracking IDs. Pose/keypoint and segmentation data now survive tracking. Removed the second, redundant NMS pass after YOLO, which could suppress overlapping people. UUID-based track identities avoid the prior short random suffix collisions. This does not make identity stable through arbitrary crossings, long occlusion or across cameras.
- New recordings use a persistent spool plus S3-compatible object storage, not PostgreSQL video blobs. Lifecycle states are RECORDING, UPLOADING, READY and FAILED; existing rows remain LEGACY. A completion marker distinguishes a successfully closed clip from an interrupted process. Completed clips retry after storage/database outages; failed captures are not fabricated or replayed as if the incident were recorded.
- The recorder retrieves authoritative camera credentials from the database, ignores URLs supplied by the engine, checks free space, limits captures to four concurrent jobs, bounds duration to 120 seconds and clips to under 128 MiB, and terminates stalled FFmpeg processes. Audio is excluded. Uploads use stable object keys, SHA-256 and a full read-back integrity check. Downloads reverify object bytes and current privacy policy.
- Privacy masks are burned into new recording frames and configured HLS output. Policy changes prevent publication/download of mismatched clips and block old HLS segment access until restart. Legacy unverified recording downloads are deliberately blocked; no raw database/local-file fallback remains. Masks must have equivalent geometry on detect and record streams; deployments with different crops need calibration before use.
- Evidence PDFs no longer expose camera connection strings or query unrelated cameras. Context detections are bounded to 60 seconds around the alert and explicitly not proof of causation. PDF and recording responses include Content-Digest. A digest detects changed bytes; it is NOT a digital signature or complete forensic chain of custody.
- Human review is persisted with reviewer, time, verdict and note. Operators can confirm or dismiss from the Alerts page. Unreviewed alerts cannot be resolved. Automatic alert.created webhook dispatch is removed; confirmed reviews dispatch alert.reviewed. Configure integrations for that event. Unreviewed alerts remain visible in the dashboard. Webhook delivery still lacks a durable outbox/replay guarantee.
- Standalone `compose.production.yml` uses root workspace builds, HTTPS, file-mounted secrets, private database/application ports, persistent spool and readiness probes. `Dockerfile` has backend/web targets. Windows native CSS dependency is optional; npm lockfile regenerated to remove obsolete mobile/dependency entries without changing versions of retained package paths. Python Docker build uses 3.12 and excludes Windows-only runtime on Linux. Python dependencies still need a tested, pinned transitive lock and image digests for strict reproducibility.

## Local verification

104 backend tests, 25 Python tests, and 8 web session tests passed (137 total). Backend and web production builds passed. One backend test runs actual installed FFmpeg against a generated white frame and verifies masked pixels. Python camera/model tests otherwise mock native dependencies; the tracker exercised the IoU fallback in this environment. A 1,000-frame/eight-person test checks bounded track histories; it is not a hardware throughput or prolonged soak benchmark. Diff whitespace check and npm ci dry-run passed.

Docker is unavailable here. Container builds/startup, hosted CI runs, actual PostgreSQL restoration, real S3 service behavior and real-camera soak testing have NOT been executed. Prisma generated updated application types, but replacing its Windows native DLL failed because the library is locked, including outside the sandbox. Stop the owning development backend normally before regenerating. No database migrations were applied and no existing recordings were purged.

## Before starting the changed backend

1. Back up the database, object storage and encryption keys. Do not run these migrations on an unbacked production database.
2. Stop the running backend normally, then run `npm exec --workspace=backend -- prisma generate` and `npm exec --workspace=backend -- prisma migrate deploy` from the repository root. New migrations add recording lifecycle/review fields and reconcile the historical video_data column without deleting video data. Review migration history first if this installation previously used db push.
3. Provision a PRIVATE S3-compatible bucket and least-privilege application credentials. Required permissions cover GetObject, PutObject and DeleteObject for the recording prefix. New recording capture intentionally fails when object storage is unconfigured. Deploy exactly one recorder/backend instance until distributed ownership/leases exist.
4. Persist and restrict the spool directory. A partial failed clip can remain there until retention purge; it must not be exposed by nginx or shared as public storage. Existing legacy recordings require an explicit audited migration/redaction workflow before download; this milestone does not convert them automatically.
5. Update webhook subscriptions to alert.reviewed; downstream consumers must still treat AI-derived evidence appropriately. No automatic punitive or emergency action should be based solely on an AI classification.

## Production setup

Use `docker compose -f compose.production.yml`, not the older local-development topology. Provide:

- PUBLIC_ORIGIN: final HTTPS origin, used at build time.
- APP_SECRETS_PATH: a restricted JSON file containing DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, CAMERA_ENCRYPTION_KEY, AI_ENGINE_KEY and S3_ENDPOINT/S3_REGION/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY. Optional key-ring fields are supported by docker/load-secrets.cjs.
- DATABASE_PASSWORD_PATH and ENGINE_KEY_PATH: restricted files containing the database password and matching engine key. DATABASE_URL must use the configured madad user, madad_vision database and postgres hostname; URL-encode the password.
- TLS_CERT_PATH/TLS_KEY_PATH: valid certificate chain/private key for the public origin. Certificate issuance and renewal are external operational requirements.
- MODELS_PATH: provisioned model directory including yolov8n.pt. Face model provisioning/licensing must also be completed. No model accuracy is implied by successful startup.

Build images, start postgres, run migration deployment in a one-off backend container with the secret preload, then start the remaining services. Example migration invocation after postgres is healthy:

```sh
docker compose -f compose.production.yml run --rm --no-deps -e NODE_OPTIONS='--require=/app/docker/load-secrets.cjs' backend npm exec -- prisma migrate deploy
```

File-mounted Compose secrets reduce configuration exposure but do not provide managed KMS rotation or encrypted host storage. See [Docker's secret handling guidance](https://docs.docker.com/compose/how-tos/use-secrets/). Configure a host secret manager and rotation process for your environment.

## Backup and restore drill

`docker/restore-drill.sh` uses PostgreSQL client tools and PGHOST/PGUSER/PGPASSWORD/PGDATABASE. It creates a dump and checksum, restores into a NEW uniquely named database, checks core tables and retains both the database and artifacts. It never overwrites or deletes a database. It requires create-database permission on an isolated drill server. `.github/workflows/database.yml` exercises migrations and the drill on a disposable PostgreSQL service when run by CI; that run is still pending.

This drill does not restore S3 objects, key material or spool contents. A full recovery acceptance test must restore all of those, verify representative recording hashes through the application, and measure actual recovery time/data loss. Encrypt and restrict backups; do not publish them as CI artifacts.

## AI evaluation and real failure acceptance

Run `python -m src.evaluate annotations.json` from apps/ai-engine with an array of sessions:

```json
[{"camera_id":"test-camera","condition":"darkness","duration_s":3600,
  "truth":[{"label":"person","start_s":10,"end_s":30}],
  "predictions":[{"label":"person","observed_s":12,"alerted_s":14}]}]
```

Times are seconds from session start. Annotate independent incidents, not every frame. Declare daylight/darkness/crowded conditions and avoid overlapping same-label truth intervals unless they are truly distinct incidents; matching is one-to-one by label/time. Duplicate alerts count as false alarms. Empty truth does not produce a fabricated perfect recall. Results include precision, recall, missed incidents, false alarms/camera-hour, and p95 incident-start-to-alert latency. Run separate exports per model/use case and retain model/version/calibration metadata with the dataset. Labels should come from authorized footage and independent human annotation.

Outstanding acceptance work: real stream disconnect/reconnect, repeated engine restarts, database and S3 outages under active capture, filling an isolated spool volume, 24–72 hour camera soak, crowded-scene ID switches, night/occlusion accuracy, browser operator tests, backup recovery and Linux container execution. Inject faults only in an isolated environment. Do not disrupt production to run these tests.
