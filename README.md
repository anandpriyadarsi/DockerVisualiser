# DockerVisualiser — GDG × IRIS NITK Recruitment 2026

**Task ID:** `DockerVisualiser` (first-year challenge).

An interactive, browser-only learning environment for simulated Docker commands. This project intentionally does **not** invoke Docker, a shell, or external services.

## Development stages

- **V1 — Containers:** `docker pull`, `run`, `start`, `stop`, `rm`, `ps`, `images`.
- **V2 — Images and layers:** a simplified editable Dockerfile, ordered layers, `docker build -t <name> .`, simulated caching, layer inspection.
- **V3 — Filesystems and processes:** not yet implemented.

## Running locally

Node 20+ for tests: `npm test`. To open the browser UI, serve the repository directory with `python -m http.server 5500`, then visit `http://localhost:5500`.

## Submission requirements

Repository must remain **private** with mentor [Varshini Adurti](https://github.com/VarshiniAdurti28) invited. The final playground needs a **public deployment URL**, a demo video, and submission before **20 October 2026, 11:59 PM IST** via the official first-year form.

## Attribution

Built with educational AI assistance. The applicant will review all code and document what they understand. References: [official challenge](https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/blob/main/Challenges/DockerVisualiser.md), [Docker CLI](https://docs.docker.com/reference/cli/docker/), [Dockerfile reference](https://docs.docker.com/reference/dockerfile/).
