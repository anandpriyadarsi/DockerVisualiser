# Recruitment implementation roadmap

## V1 — Containers

- [x] Simulate `docker pull`, `run`, `start`, `stop`, `rm`, `ps`, `images`.
- [x] Deterministic container IDs, image cache and atomic failure handling.
- [x] Responsive terminal, animated containers and regression tests.

## V2 — Images and layers

- [x] Ordered image layers and simulated registry pull.
- [x] Editable Dockerfile lab: FROM, RUN, COPY, WORKDIR, CMD.
- [x] `docker build -t <name> .` and `docker history <image>`.
- [x] Visual layer inspector and cache reuse.
- [x] Unit tests covering invalid syntax and unmodified state on failure.
- [ ] Real-browser V2 visual acceptance (desktop and mobile): pending.

## V3 — Required before final challenge submission

- [ ] Isolated in-memory container filesystem and simplified processes.
- [ ] Simulated `docker exec`, never passing user text to a shell.
- [ ] Filesystem/process animations and error/atomicity tests.

## Recruitment

- [x] Private GitHub repository.
- [x] Mentor invitation sent (acceptance pending).
- [ ] Public deployment of playground.
- [ ] Demonstration video.
- [ ] Final README review and explainability practice.
- [ ] Form submission by 20 October 2026, 11:59 PM IST.

References: [Official task](https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md).
