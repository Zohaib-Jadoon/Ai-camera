# Recording and evidence hardening — 2026-09-08

## Implemented

- Flush captured clip bytes and completion-marker file before publication. This improves process-crash recovery; it is not a guarantee against every filesystem/power-loss failure.
- Recheck privacy policy after object upload/readback and immediately before returning downloaded bytes. Changed-policy clips are withheld; already uploaded object keys are retained for normal retention cleanup.
- Isolate recovery failures per row so a malformed spool reference does not abort the rest of a recovery batch.
- Bound object downloads to 30 seconds, reject advertised oversized bodies, and destroy response streams after success or failure.
- Evidence PDFs attach an allowlisted JSON manifest preserving full Unicode field values and detection identifiers. The visible report includes human-review status and the manifest SHA-256. It explicitly distinguishes nearby detections from causation and says that media bytes are not included. A checksum is not a digital signature or chain-of-custody certification.
- Adjusted the PDF detection table so timestamp text no longer overlaps a snapshot column.

## Verification

All 113 backend tests (21 suites) passed, including seven new regressions covering privacy changes during upload/download, bad recovery rows, database failure at READY commit, lossless evidence attachments, oversized bodies, and stalled-body cleanup. The suite includes native FFmpeg masking tests. Backend production compilation and diff whitespace checks passed.

Tests use isolated temporary directories and mocks for database/object-store outages. No live camera interruption, database outage, retention purge, or real evidence transfer was performed. No deployment, schema migration, or backend restart was performed in this pass.

## Still required

- Provision and test actual object storage; record, upload, read back, play, export, and restore representative clips. Check sustained upload throughput and spool capacity under outages.
- Validate playback duration and decodability, not merely file completion and checksums.
- Test multi-instance recorder coordination before running multiple backend replicas.
- Verify backups of PostgreSQL, object storage, and encryption keys together.
- Execute Linux container builds and isolated restore/outage/load drills. Docker is not available on this host (not in PATH or the standard Docker Desktop binary location).
- Run labeled AI accuracy evaluation. No weapon-recall or false-alarm claims follow from these infrastructure tests.
