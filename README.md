# DockerVisualiser — GDG × IRIS NITK 2026 Recruitment

**Task ID:** `DockerVisualiser`  
**Category:** 1st-year Challenge  
**Status:** Versions 1–3 and guided practice implemented. Site deployed (public accessibility reported by applicant); genuine phone-screen demonstration recorded, edited and shared. Final automated deployment verification and first-year form submission remain pending.

## Recruitment submission links (17 October 2026)

- **Live playground:** https://prismatic-lamington-67be56.netlify.app/ (reported publicly accessible by applicant; external scripted acceptance still pending)
- **Demonstration:** https://drive.google.com/file/d/1GMBPOgHI5H0fiBdP-WJ6-wBLZNCBc-yW/view (2:02 genuine phone-screen recording, applicant's voice; Google Drive permission verified as **anyone with link: reader**)
- **Source repository:** https://github.com/anandpriyadarsi/DockerVisualiser (**private**; mentor `VarshiniAdurti28` has verified **write** access)
- **First-year recruitment form:** https://forms.gle/rzd6zap9YTTd7tx46 — **not yet submitted**; deadline **20 October 2026, 11:59 PM IST**
- **Verified CI evidence:** [GitHub Actions run 38414619218](https://github.com/anandpriyadarsi/DockerVisualiser/actions/runs/38414619218) — Ubuntu, Windows and Chromium desktop/mobile jobs all **passed** on final code-changing PR #3; the most recent documentation-only main commits do not yet have independently confirmed CI results.

The project remains an educational browser-only simulation: it does not use a Docker daemon, execute a shell, or perform actual image downloads/build steps. The video demonstrates the application's actual UI, not a simulated mock recording.

## What this does

A safe browser-only Docker simulator: enter supported Docker commands and see the image library and container lifecycle change. It does **not** execute Docker commands or use a real Docker daemon.

### Mentor feedback correction — visible image pulling

The container playground now displays **local lookup → simulated registry lookup → per-layer caching → image ready → container start**, in that order, before adding the image/container to the live state.

- First try `docker run nginx`: three illustrative layers appear progressively while the image and container counters remain unchanged until completion.
- Repeat `docker run nginx`: the already-cached image is reused, without another simulated download, and a second container is created.
- Try `docker run definitely-not-in-demo` or `docker pull definitely-not-in-demo`: the offline example registry reports **image not found**; no image, container, counter or history entry is added.
- `docker build -t test .` with `FROM definitely-not-in-demo` also fails without modifying the simulator state.

**Important:** This is a curated **offline educational catalogue** (ubuntu, alpine, nginx, redis, node, python, debian, busybox, hello-world, httpd). It deliberately does not contact Docker Hub or claim that a registry was queried; example image layers, cache IDs and timings are illustrative. Other registry names, including real images, may be unsupported by this teaching model.

The fix is tested by Node regression tests and Playwright browser screenshots at desktop/mobile sizes. After merging, **redeploy the new `dist/` build**; a manual Netlify Drop deployment does not update merely because GitHub `main` changed.

### V1 supported commands

```text
docker pull ubuntu
docker run ubuntu
docker ps
docker ps -a
docker images
docker stop c001
docker start c001
docker stop c001
docker rm c001
docker help
```

### V2: Images and layers

The Dockerfile lab supports `FROM`, `WORKDIR`, `COPY`, `RUN`, and `CMD` (one base image only). The following commands are now available:

```text
docker build -t iris-app .
docker history iris-app
docker run iris-app
```

The Dockerfile is edited in the browser before running the build command. Select an image chip to see its ordered base and custom layers. Rebuilding an unchanged image shows cached layers; changes to instructions invalidate subsequent layers. `RUN`, `COPY` and `CMD` are *only represented as strings* in a learning model: nothing actually executes or copies files.

### V3: Container filesystem and processes

Version 3 adds the **Container Runtime** panel. Select a container to see its virtual directory tree, files, PID 1, and the last six short-lived `docker exec` operations. Each container receives an independent writable filesystem. Its image layers never change when files are added or removed. A stopped container preserves its virtual files but rejects `exec` until restarted.

Try:

```text
docker run iris-app
docker exec c001 pwd
docker exec c001 ls /
docker exec c001 ps
docker exec c001 mkdir /tmp/work
docker exec c001 touch /tmp/work/notes.txt
docker exec c001 write /tmp/work/notes.txt hello from NITK
docker exec c001 cat /tmp/work/notes.txt
docker exec c001 rm /tmp/work/notes.txt
```

`write` is an **educational extension**, not a real Docker shell command. Simulated `docker exec` supports only `pwd`, `ls`, `ps`, `mkdir`, `touch`, `write`, `cat`, and `rm` for **absolute virtual paths**. It does not execute a real shell, run container images, access your disk or network, or execute Dockerfile `RUN` commands. `COPY` produces a labeled placeholder file and `CMD` labels simulated PID 1. This model illustrates concepts rather than replicating Docker internals.

Virtual filesystem content is limited to 120 entries per container and 160 characters per file; only the last 12 completed simulated exec processes are retained. All simulation data resets upon browser reload.

The image library and container lifecycle are held in browser memory and reset on page reload. This is a teaching simulator, not an actual Docker daemon. A registry image is represented by three illustrative base layers; the IDs are simulated and not real Docker hashes.

The simulator automatically pulls a missing image when `docker run` is issued, caches that image, creates unique container IDs, and rejects invalid state transitions without partially modifying the environment.

## Docker Academy integration (candidate V3.1; review branch only)

A proposed fourth guided mission, **Images vs containers**, demonstrates an essential Docker concept: **one reusable nginx image can create two separate containers**. Learners must explicitly run each command and observe the difference between the image library and container runtime.

After the feature is merged and **a new Netlify deployment** is published, a Docker Academy course lesson can link to:

`https://prismatic-lamington-67be56.netlify.app/?lesson=images-containers`

This deep link only selects a named, built-in lesson. It does not execute a Docker command, accept remote scripts, or start real containers. The mission asks the learner to pull an image, run it twice, stop one instance, inspect both with `docker ps -a`, and restart the stopped instance.

**Teaching-model limitations:** The simulation is not Docker Engine. For example, it keeps its example containers running for predictable exploration; in real Docker, a container's lifetime depends on its main process and a plain `docker run ubuntu` typically exits soon after starting. Educational sample layers, image-fetch events and process behavior are simplified. Avoid treating successful simulated missions as proof that a command has been tested against real Docker.

## Guided learning and final recruitment delivery

Three interactive missions now teach **Containers**, **Image layers**, and **Files & processes**. The “Use this command” button prefills the terminal; a checkpoint completes only after a successful expected command. The progress is in memory and resets with the environment. This is deliberately beginner-friendly but still teaches actual state transitions, rather than simply rewarding clicks.

To prepare the safe, minimal public website folder, run `npm run build`. The `dist/` folder contains only browser app assets and is ignored by Git. See [public deployment guide](docs/DEPLOYMENT_AND_DEMO.md) and the [exact final acceptance and demo plan](docs/FINAL_ACCEPTANCE_AND_DEMO.md). The applicant reports that the [deployed Netlify website](https://prismatic-lamington-67be56.netlify.app/) opens publicly in Chrome. Independent live asset checks and the official first-year recruitment form remain pending. **A real phone-screen demonstration with the applicant's own voice has been recorded and shared.**

For a read-only external check of the live CSS and JavaScript paths, use `npm run check:live -- https://prismatic-lamington-67be56.netlify.app/` (PowerShell: `npm.cmd run check:live -- https://prismatic-lamington-67be56.netlify.app/`).

## Setup

Requires **Node.js 20+** to run automated tests. No JavaScript dependencies are required.

```bash
npm test
```

On Windows PowerShell, use `npm.cmd test` if `npm.ps1` is blocked by the execution policy.

Open the UI using an ordinary local static server. With Python installed:

```bash
python -m http.server 5500
```

Then visit `http://localhost:5500` in Chrome/Edge. Direct `file:///` opening may prevent ES module imports.

## Architecture

- `src/simulator.js`: pure deterministic Docker state machine and command parser (no execution)
- `src/filesystem.js`: immutable virtual filesystem and simulated process operations
- `src/app.js`: DOM state and interaction layer
- `src/style.css`: responsive visual layout and container animations
- `tests/simulator.test.mjs`: automated tests using built-in Node test runner
- `docs/ROADMAP.md`: completion checklist and recruitment tasks

No external services, credentials, analytics or APIs are used by this prototype. The browser stores no personal data.

## Demo scenario

1. `docker run ubuntu` → first download creates an image then starts `c001`.
2. `docker stop c001` → container changes to stopped.
3. `docker start c001` → it resumes.
4. `docker rm c001` → fails while container is running, state stays intact.
5. `docker stop c001` then `docker rm c001` → container disappears.
6. `docker run ubuntu` → starts `c002` without downloading ubuntu again.

## Scope and limitations

V1-V3 functionality exists, with a deployed playground and real demonstration video. **The recruitment submission is not complete until the remaining release/access checks are performed and the first-year form is submitted.** The simulator intentionally supports a safe subset of Docker commands and stylized CSS isometric objects rather than real container infrastructure or a full 3D engine.

## Recruitment notes

- Keep the **source GitHub repository private** and invite the task mentor as a collaborator.
- The final deployed playground must have a **public URL**.
- Include an actual demo video, well-written instructions, code understanding, meaningful incremental commits, and resource attribution.
- Submit the official first-year recruitment form before **20 October 2026 at 11:59 PM IST**.

## References and attribution

- [Official first-year recruitment challenge](https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md)
- [Docker command reference](https://docs.docker.com/reference/cli/docker/)
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)

Initial design and code were prepared with AI assistance; the applicant should review and explain each feature before submission. No third-party visual assets or component libraries are included.
