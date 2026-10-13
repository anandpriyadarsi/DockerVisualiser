# DockerVisualiser — GDG × IRIS NITK 2026 Recruitment

**Task ID:** `DockerVisualiser` · **Category:** First-year Challenge
**Status:** V1 containers and V2 images/layers implemented; V3 and public deployment pending.

## What is it?

An interactive, browser-only educational Docker simulator. Enter supported commands to see an animated image library, container lifecycle and layered images. **No Docker daemon, shell or real registry is used.** This is an intentionally simplified teaching model, not a full Docker replacement.

### V1 — Containers

```text
docker pull ubuntu
docker run ubuntu
docker ps
docker ps -a
docker images
docker stop c001
docker start c001
docker rm c001
docker help
```

Container IDs are assigned deterministically. A missing image is simulated as pulled on first use. Invalid operations (such as deleting a running container) fail without changing the state.

### V2 — Images and layers

The interactive Dockerfile editor supports one `FROM` instruction followed by `WORKDIR`, `COPY`, `RUN` and `CMD` instructions.

```dockerfile
FROM ubuntu
WORKDIR /app
COPY app.js /app/
RUN echo ready
CMD ["node", "app.js"]
```

Try `docker build -t iris-app .` in the terminal or click **Build image**. Then select the image chip to inspect its layers and run `docker history iris-app` or `docker run iris-app`.

- A successful build produces an ordered layer stack and a tagged image.
- Repeated builds reuse simulated cached layers; changing an earlier step invalidates its dependent layers.
- Running a built image creates a container with a snapshot of its image layers.
- Malformed Dockerfiles fail atomically.
- `RUN`, `COPY` and `CMD` are modeled, **never executed**. Illustrative registry images have three generated base layers. Simulated layer identifiers are not real Docker digests.

## Run locally

Prerequisites: Node.js 20+ for testing and Python or any static file server for viewing.

```bash
npm test
python -m http.server 5500
```

Open [http://localhost:5500](http://localhost:5500). Direct `file://` use may fail because browsers restrict ES module imports.

Use the editor to build `iris-app`, then run it. Stop and start `c001`; inspect the image-layer graph. Reset clears the in-memory environment. **State does not persist across page reloads.**

## Architecture

| File | Responsibility |
| --- | --- |
| `src/simulator.js` | Pure command parser, Dockerfile parser, image/layer state model |
| `src/app.js` | Terminal events, animation progress, image/layer inspector |
| `src/style.css` | Responsive Docker playground and layer stack visuals |
| `tests/simulator.test.mjs` | V1 lifecycle and failure safety |
| `tests/images.test.mjs` | V2 Dockerfile, image caching, invalid-state tests |
| `docs/ROADMAP.md` | V3 scope and acceptance checklist |

There are no runtime dependencies, browser secrets, third-party fonts, or external API calls.

## Validation

18 local unit tests passed on 13 October 2026. GitHub source file hashes were checked against the tested local files. Browser validation on desktop/mobile and deployed URL verification remain **pending**, not claimed as passed.

## Still to complete before recruitment submission

1. V3: simulated container filesystem, processes and safe `docker exec` operations.
2. Desktop/mobile/browser accessibility checks and final explanatory UX.
3. Deploy a public playground URL, record a demonstration video and submit the first-year form by **20 October 2026 at 11:59 PM IST**.

**Recruitment:** Keep this source repository private and invite mentor [Varshini Adurti](https://github.com/VarshiniAdurti28). A public deployed playground is required separately.

## Credits and learning note

- [Official DockerVisualiser challenge](https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md)
- [Docker CLI reference](https://docs.docker.com/reference/cli/docker/)
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)

This project received AI assistance. The applicant is responsible for reviewing the code, understanding each operation, documenting external sources, and honestly demonstrating working behaviour. No third-party visual assets are bundled.
