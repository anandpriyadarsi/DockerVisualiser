# Module 01 release candidate — 29 October 2026

Implemented: corrected lifecycle/reference semantics, names/ports/diagnostics/cleanup subset, durable isolated workspaces, all four legacy missions, fourteen Academy exercise journeys, bounded backups and optional first-party offline caching.

Local verification: Node unit suites and Chromium acceptance are recorded in the paired delivery report. CI and physical-phone outcomes must be reported separately; do not infer them from workflow configuration.

Required before unrestricted paired release:

- Actual Android Chrome soft keyboard, orientation/back, TalkBack/focus and text-size checks.
- Real YouTube playback/replay/resume for all twelve Academy ranges and one full watched segment, including background interruptions. Fake player tests validate controller behavior only.
- Transcript/listening alignment review for shared/provisional chapter windows.
- Fresh Ubuntu/Windows GitHub checks and production smoke after both existing Netlify sites are updated.

Later curriculum: interactive shells, environment variables, volumes and networks. Optional future work: autocomplete, undo and deterministic revision scheduling. No accounts, cloud daemon or AI grading are required.

Historical recruitment details remain in the repository's historical documents. Their old domains, deadlines, access and CI observations are not statements about the current release candidate.
