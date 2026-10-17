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
- [x] V3 verified on Ubuntu, Windows and Chromium at commit 0ed4ae8
- [x] Guided beginner missions and static dist/ packaging implemented on main at 429afc3
- [x] Release gate [CI run 38406777744](https://github.com/anandpriyadarsi/DockerVisualiser/actions/runs/38406777744) passed on Ubuntu, Windows and Chromium. Final code-changing PR #3 [run 38414619218](https://github.com/anandpriyadarsi/DockerVisualiser/actions/runs/38414619218) also passed all three jobs
- [x] Automated GitHub release build and `npm run verify:release` passed in verified cross-platform CI. An independent direct run of `check:live` against Netlify remains outstanding
- [x] Public Netlify website reported accessible by applicant (GitHub repository remains private). Independent asset-manifest verification still pending
- [x] Applicant confirms website accessible on Chrome and provided a genuine mobile demonstration. Independent scripted live-site checks remain pending
- [x] Genuine demonstration of all three versions with applicant voice, edited and shared: https://drive.google.com/file/d/1GMBPOgHI5H0fiBdP-WJ6-wBLZNCBc-yW/view (anyone-reader Drive permission confirmed)
- [x] README and final-submission documentation updated with limits, AI assistance, demo and deployment links
- [ ] Rehearse explanation of layer caching, isolation and process model
- [ ] Submit the first-year form by 20 October 2026, 11:59 PM IST

Official challenge: https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md
