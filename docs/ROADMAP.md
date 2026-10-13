# DockerVisualiser — 2026 recruitment roadmap

## Completed implementation

### Version 1 — Containers
- [x] Simulated pull, run, start, stop, remove, ps and images with state validation
- [x] Deterministic simulated image cache and container IDs
- [x] Animated, responsive command terminal and container cards

### Version 2 — Images and layers
- [x] Read Dockerfile instructions FROM, WORKDIR, COPY, RUN, CMD
- [x] Simulated image build, ordered layer visualization and cache reuse
- [x] Image history, snapshots and invalid-build atomicity tests
- [x] Windows acceptance: 18 tests passed and UI screenshots supplied

### Version 3 — Virtual filesystem and processes
- [x] Independent per-container virtual file tree, seeded by WORKDIR/COPY
- [x] PID 1 and recent simulated docker exec processes
- [x] Safe simulated exec: pwd, ls, ps, mkdir, touch, write, cat, rm
- [x] Filesystem/process explorer UI and helpful errors on invalid input
- [x] Stop/restart preserves files; stopped containers reject exec
- [x] 25 total unit tests passed locally; GitHub CI checks required before main promotion

## Finish recruitment submission
- [ ] Confirm Ubuntu/Windows tests and Chromium smoke checks on V3 commit
- [ ] Publicly deploy static playground (GitHub repository remains private)
- [ ] Check public URL from a clean browser session and mobile layout
- [ ] Record an actual demonstration video of all three versions
- [ ] Review README and documentation of simulator limitations, AI assistance and credits
- [ ] Rehearse explanation of layer caching, isolation and process model
- [ ] Submit the first-year form by 20 October 2026, 11:59 PM IST

Official challenge: https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md
