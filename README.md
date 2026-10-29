# DockerVisualiser 2.0 — Module 01 integration candidate

Browser-only Docker learning for phones. This is a declared simulation subset: no Docker Engine, shell execution, real registry downloads, accounts or paid infrastructure.

Production destination: https://dockervisualiser.netlify.app/ . This branch is a release candidate; its existence does not mean Netlify was updated. Historical recruitment records are retained in [docs/RECRUITMENT_HISTORY.md](docs/RECRUITMENT_HISTORY.md).

## What changed

- Canonical default image references, immutable image IDs and multiple tags for identical built content.
- Separate named containers, hex IDs plus old `c001` aliases, independent writable files, natural greeting/shell exits and persistent service profiles. `start` launches a new process in the existing container filesystem; it does not restore process RAM.
- `run -d`, `--name`, TCP `-p HOST:CONTAINER`, logs, inspect, image/container list aliases, rmi and confirmed scoped prune. Help documents the exact subset. Unsupported real Docker options receive explicit guidance.
- Durable sandbox, mission progress, editor draft and bounded command history. Validated export/import and visible save errors. State commits before optional animation.
- Four original missions retain their IDs. Shell-only Ubuntu/Alpine exercises now use the persistent nginx profile.
- Fourteen isolated Academy exercise scenarios, progressive hints and fixed-origin return links. Each scenario is separate from the saved sandbox. Launch never runs the learner's command automatically. Receipts are client-reported practice progress, not authenticated grades.
- Optional offline shell after an initial online cache, with explicit update/reload. It caches first-party assets, never YouTube videos.

## Try it

```text
docker pull nginx
docker pull nginx:latest
docker run -d --name web -p 8080:80 nginx
docker run --name sibling nginx
docker exec web touch /tmp/draft
docker stop web
docker start web
docker exec web ls /tmp
docker logs web
docker inspect web
docker run --name greeting hello-world
docker ps -a
docker logs greeting
```

A greeting exits normally; detach does not extend its lifetime. Image tags are synthetic catalogue labels, not proof that a real registry has a particular tag. Simulated foreground services leave this teaching terminal usable rather than emulating a blocking terminal attachment. Interactive shells, environment variables, volumes and network management are outside Module 01.

`write PATH TEXT` is a **simulator-only helper**. Process explorer/`exec ps` is **instrumentation**, not a claim that every real nginx image contains `ps`. Virtual files are bounded to 120 entries and 160 characters each. Workspaces are bounded to 100 images/containers; history is bounded. If storage is denied/full/corrupt, the UI remains a session workspace and shows that it is not saved.

## Build and verify

Node **22** is the CI target. No production dependency installation is required.

```bash
npm test
npm run build
npm run verify:release
python -m http.server 5500 --directory dist
```

Open http://localhost:5500/ . Use `npm.cmd` on Windows PowerShell if its script policy blocks `npm.ps1`. Serve `dist/` to test offline support; source-mode service-worker installation is intentionally disabled. Direct `file:` opening does not support this ES-module application.

Optional browser regression:

```bash
npm install --no-save playwright@1.56.0
npx playwright install chromium
npm run smoke
```

CI retains Ubuntu/Windows tests and Chromium browser smoke. A configured workflow is not proof that its latest run passed. Actual Android soft keyboard/TalkBack and paired production smoke remain release gates.

## Deploy on the existing Netlify site

Upload **all contents of dist/**, including `src/`, manifest, icon, service worker, precache and build-info. An index-only upload is incomplete. Keep the existing site/domain. Deploy protocol-compatible simulator before Academy. Export each origin's progress separately before a release; localStorage is not shared between sites. Preserve the previous deploy for rollback; rollback must not clear user data.

Build metadata and SHA-256 checksums are in `dist/build-info.json`. The explicit asset allowlist and release verifier reject incomplete or unexpected public files. See [docs/ROADMAP.md](docs/ROADMAP.md) for current scope and remaining manual gates.

## Architecture and references

Pure transitions: `src/simulator.js`, parser, profiles and virtual filesystem. Integration: capability registry, exercises and fixed-origin protocol. UI/persistence: app and storage modules. Builds bundle only reviewed static assets.

Dockerfile FROM/WORKDIR/COPY/RUN/CMD remain a synthetic teaching model. COPY cache keys include synthetic context contents; CMD is metadata in history, not a filesystem data layer. RUN is never executed. The default lab demonstrates an nginx foreground service. Arbitrary application execution and production build fidelity are not claimed.

References: https://docs.docker.com/reference/cli/docker/ and https://docs.docker.com/reference/dockerfile/ . Code/design and editorial assistance were provided by AI; learners should explain predictions and observed outcomes themselves.
