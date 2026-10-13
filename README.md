# DockerVisualiser — GDG × IRIS NITK 2026 Recruitment

**Task ID:** `DockerVisualiser`  
**Category:** 1st-year Challenge  
**Status:** Versions 1, 2 and 3 implemented; public deployment and final video pending.

## What this does

A safe browser-only Docker simulator: enter supported Docker commands and see the image library and container lifecycle change. It does **not** execute Docker commands or use a real Docker daemon.

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

V1-V3 functionality exists, but the **recruitment submission is not complete** until it is publicly deployed, reviewed visually, and demonstrated in a video. The simulator intentionally supports a safe subset of Docker commands and stylized CSS isometric objects rather than real container infrastructure or a full 3D engine.

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