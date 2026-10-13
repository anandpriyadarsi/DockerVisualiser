# Recruitment implementation roadmap

## V1 — Containers (first deliverable)

- [x] Parse documented Docker command subset without invoking a real shell
- [x] Simulate `docker pull`, `run`, `start`, `stop`, `rm`
- [x] Simulate `docker ps`, `docker ps -a`, `docker images` (extra helpers)
- [x] Deterministic container IDs, image cache, and atomic failure behavior
- [x] Render a responsive terminal, host image library and animated containers
- [x] Node-based behavior tests
- [x] Automated headless browser smoke checks on V1; recheck V2 with responsive screenshots
- [ ] Optional V1 improvements: per-step animated staging, persistence on refresh

## V2 — Images and layers (required for complete recruitment submission)

- [x] Model images and ordered layers independently from containers
- [x] `docker pull <image>` with layer download/caching animation
- [x] Parse a simplified editable Dockerfile
- [x] `docker build -t <name> .` generating ordered image layers
- [x] Animated Dockerfile → layers → image → container trace
- [x] Tests for caching, invalid syntax, duplicate layer reuse, build failures

## V3 — Filesystem and processes (required for complete recruitment submission)

- [ ] Give every container an isolated in-memory folder/file tree
- [ ] Maintain simplified process table with PID 1
- [ ] Safe parser for `docker exec <container> <allowed-operation>`
- [ ] Visualise filesystem mutations and processes; never execute raw text
- [ ] Tests for container isolation, start/stop behavior, invalid paths and atomic errors

## Acceptance and submission

- [ ] Verify V1, V2, V3 against the exact challenge specification
- [ ] Add accessibility and mobile checks
- [ ] Add explanation mode and sensible visual animation delays
- [ ] Document unsupported real-Docker semantics accurately
- [ ] Create **private** GitHub repository for this task
- [ ] Add mentor [Varshini Adurti](https://github.com/VarshiniAdurti28) as collaborator
- [ ] Commit changes across multiple dates with informative messages
- [ ] Deploy the completed playground on a public URL (Netlify/Vercel)
- [ ] Record an actual demonstration video (screenshare and voice if possible)
- [ ] Credit external references, assets, libraries; maintain README
- [ ] Submit official first-year form before 20 Oct 2026 11:59 PM IST

This is a start, not yet a complete recruitment submission.