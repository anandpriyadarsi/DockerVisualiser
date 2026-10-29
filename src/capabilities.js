export const CORE_VERSION = "2.0.0";
export const CAPABILITIES = Object.freeze(
  [
    [
      "pull",
      "docker pull nginx",
      "Cache an image; create no container",
      "m01.pull-nginx",
    ],
    [
      "images",
      "docker images",
      "List local image references",
      "m01.list-images",
    ],
    [
      "run",
      "docker run nginx",
      "Create and start a new container",
      "m01.run-nginx",
    ],
    ["ps", "docker ps", "List running containers", "m01.list-running"],
    ["all", "docker ps -a", "Include stopped containers", "m01.list-all"],
    ["stop", "docker stop web", "Stop the main process", "m01.stop-web"],
    [
      "start",
      "docker start web",
      "Launch the configured process anew in the same filesystem",
      "m01.start-web",
    ],
    [
      "rm",
      "docker rm web",
      "Remove a stopped container and its writable files",
      "m01.remove-web",
    ],
    [
      "exec",
      "docker exec web ls /",
      "Run one supported virtual executable in a running container",
      "m01.exec-files",
    ],
    [
      "help",
      "docker run --help",
      "Read the supported syntax and limits",
      "m01.help",
    ],
    [
      "logs",
      "docker logs broken",
      "Read saved stdout/stderr, even after exit",
      "m01.debug-exit",
    ],
    [
      "inspect",
      "docker inspect broken",
      "Inspect configuration and exit state",
      "m01.debug-exit",
    ],
    [
      "flags",
      "docker run -d --name web -p 8080:80 nginx",
      "Set name, terminal attachment and TCP port mapping",
      "m01.named-port",
    ],
    [
      "prune",
      "docker container prune",
      "Remove stopped containers after confirmation",
      "m01.cleanup-images",
    ],
    [
      "image-prune",
      "docker image prune -a",
      "Remove unused images after confirmation",
      "m01.cleanup-images",
    ],
    [
      "rmi",
      "docker rmi nginx",
      "Remove an unreferenced local image",
      "m01.cleanup-images",
    ],
  ].map(([id, command, description, exercise]) =>
    Object.freeze({
      id,
      command,
      description,
      exercise,
      status: "simulated",
      limits: "Documented teaching subset; no real Docker daemon or network.",
    }),
  ),
);
export const HELP = {
  pull: "docker pull IMAGE",
  images: "docker images (alias: docker image ls)",
  run: "docker run [-d] [--name NAME] [-p HOST_PORT:CONTAINER_PORT] IMAGE [COMMAND]. Finite sleep, arbitrary app execution and interactive shells are not yet simulated; known missing-executable failures are modelled.",
  ps: "docker ps [-a | --all] (alias: docker container ls)",
  start: "docker start NAME_OR_ID",
  stop: "docker stop NAME_OR_ID",
  rm: "docker rm NAME_OR_ID (stop it first)",
  exec: "docker exec NAME_OR_ID pwd | ls [ABSOLUTE_PATH] | cat PATH | mkdir PATH | touch PATH | rm PATH. write PATH TEXT is a simulator-only helper. ps is simulator process instrumentation, not an assumed executable in every real image. Interactive shells / -it are not yet simulated.",
  logs: "docker logs NAME_OR_ID",
  inspect: "docker inspect NAME_OR_ID_OR_IMAGE",
  rmi: "docker rmi IMAGE (alias: docker image rm)",
  "container-prune":
    "docker container prune (confirmation required; stopped containers only)",
  "image-prune":
    "docker image prune [-a] (confirmation required; default dangling only; -a all unreferenced)",
  history:
    "docker history IMAGE (synthetic instruction history, metadata distinguished from filesystem layers)",
  build:
    "docker build -t NAME . (options.dockerfile and explicit synthetic build context; RUN is never executed)",
  "image-inspect": "docker image inspect IMAGE",
};
export function helpText(action) {
  return action
    ? HELP[action] || "Real Docker command; not yet simulated. Try docker help."
    : Object.values(HELP).join("\n") +
        "\nOffline catalogue: nginx, hello-world, ubuntu, alpine, redis, node, python, debian, busybox, httpd. No real registry is contacted.";
}
