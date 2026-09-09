# Settings and dashboard verification — 2026-09-08

## Changes

- Settings now maps UI percentages to the strict API contract (`80` becomes `confidence_threshold: 0.8`) and sends only permitted fields. Responses map back to UI percentages.
- Failed settings saves show an inline error. Several other dashboard async save boundaries now catch failures and display a dismissable notice while preserving the form.
- Unsupported settings controls are identified as nonfunctional instead of implying they persist. The confidence setting is explicitly an account preference, not shared engine configuration.
- User Management uses the shared authenticated API client, including `/api` routing and session refresh. Query and mutation failures now have visible feedback.
- Analytics charts start with positive initial dimensions to avoid Recharts mount warnings.

## Live browser checks

Used the browser-automation skill against localhost:3000 with the user signing in directly.

- Changed confidence from 55% to 80%, saved successfully, reloaded, and verified 80% persisted. Restored and saved the original 55%; final Settings view confirms 55%.
- Inspected saved notification preferences without changing them.
- Visited all 20 authenticated sidebar routes: Dashboard, Live Monitor, Cameras, Camera Groups, Calibration, AI Events, Alerts, Alert Rules, Recordings, Traffic Analytics, Safety Compliance, Person ReID, Forecasting, Faces, Zone Editor, Analytics, Webhooks, Escalation, User Management, and Settings.
- Checked live feed/detection rendering and Analytics daily selection. Initial chart warnings were fixed; no new warnings or errors appeared on the post-fix checks.
- Submitted an invalid camera URL: error notice appeared, form stayed open, and camera count was unchanged. Canceled the form and dismissed the notice.
- Verified User Management loads the existing account; a nonmatching search shows the empty state. Cleared the search afterward.

## Automated checks

- Web Node test suite: 13 passed (session handling, settings contract, async action failures).
- Targeted backend settings DTO tests: 2 passed.
- Web production build and TypeScript validation passed.
- Git diff whitespace check passed.

## Scope limits

This is a route smoke test plus targeted interaction/regression testing, not exhaustive certification. No accounts, cameras, recordings, or alerts were deleted or modified beyond the restored personal threshold. External email/webhook delivery, destructive workflows, camera disconnection, database outages, full disks, exports, and prolonged load were not exercised in this verification. Passing these checks does not establish enterprise readiness or AI accuracy.
