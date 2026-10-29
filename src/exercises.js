import {
  createInitialState,
  runCommand,
  normalizeReference,
} from "./simulator.js";
import { parseCommand } from "./parser.js";
const rows = [
  [
    "pull-nginx",
    "Pull an image",
    "Cache nginx without creating a container.",
    ["docker pull nginx"],
    [],
  ],
  [
    "list-images",
    "List local images",
    "Inspect the prepared image library without changing it.",
    ["docker image ls"],
    ["docker pull nginx", "docker pull alpine"],
  ],
  [
    "run-nginx",
    "Run a service",
    "Create a running nginx container from the cached image.",
    ["docker run nginx"],
    ["docker pull nginx"],
  ],
  [
    "list-running",
    "Running containers",
    "Show only the running service, excluding the completed greeting.",
    ["docker container ls"],
    ["docker run --name web nginx", "docker run --name finished hello-world"],
  ],
  [
    "list-all",
    "All containers",
    "Include both running and stopped containers.",
    ["docker ps -a"],
    ["docker run --name web nginx", "docker run --name finished hello-world"],
  ],
  [
    "stop-web",
    "Stop one service",
    "Stop web while sibling remains running.",
    ["docker stop web"],
    ["docker run --name web nginx", "docker run --name sibling nginx"],
  ],
  [
    "start-web",
    "Start the same container",
    "Launch web again; its ID and /tmp/keep file must survive.",
    ["docker start web"],
    [
      "docker run --name web nginx",
      "docker exec web touch /tmp/keep",
      "docker stop web",
    ],
  ],
  [
    "remove-web",
    "Remove a stopped container",
    "Remove web while keeping its nginx image.",
    ["docker rm web"],
    ["docker run --name web nginx", "docker stop web"],
  ],
  [
    "exec-files",
    "Look inside a running service",
    "List web’s root directory without creating a new container.",
    ["docker exec web ls /"],
    ["docker run --name web nginx"],
  ],
  [
    "help",
    "Read command help",
    "Ask Docker for general or command-specific syntax.",
    ["docker run --help"],
    [],
  ],
  [
    "debug-exit",
    "Diagnose an exited process",
    "Read both logs and inspect, then identify why broken exited.",
    ["docker logs broken", "docker inspect broken"],
    ["docker run --name broken ubuntu node app.js"],
  ],
  [
    "named-port",
    "Name and publish",
    "Create detached web with host TCP 8080 mapped to container TCP 80.",
    ["docker run -d --name web -p 8080:80 nginx"],
    [],
  ],
  [
    "cleanup-images",
    "Clean up safely",
    "Try deleting the referenced image, remove its stopped container, then remove the image.",
    ["docker rmi hello-world", "docker rm finished", "docker rmi hello-world"],
    ["docker run --name finished hello-world"],
  ],
  [
    "two-instances",
    "Two independent services",
    "Create web-a and web-b from one nginx image, then stop only web-a.",
    [
      "docker run --name web-a nginx",
      "docker run --name web-b nginx",
      "docker stop web-a",
    ],
    ["docker pull nginx"],
  ],
];
export const EXERCISES = Object.freeze(
  Object.fromEntries(
    rows.map(([id, title, description, solution, fixture]) => [
      "m01." + id,
      {
        id: "m01." + id,
        title,
        description,
        solution,
        fixture,
        hints: [
          description,
          "Compare the live images and containers before and after your command.",
          "Example path: " + solution.join(" → "),
        ],
      },
    ]),
  ),
);
export function createExercise(id) {
  const e = EXERCISES[id];
  if (!e) throw Error("Unknown exercise");
  let state = createInitialState();
  for (const cmd of e.fixture) {
    const r = runCommand(state, cmd);
    if (!r.ok) throw Error(r.message);
    state = r.state;
  }
  return {
    id,
    state,
    progress: { complete: false, evidence: [] },
    fixtureSummary: {
      images: state.images.map((i) => i.name),
      containers: state.containers.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
    },
  };
}
export function observeExercise(session, command, result, before) {
  let ast;
  try {
    ast = parseCommand(command);
  } catch {
    return session;
  }
  const { action, args } = ast,
    id = session.id;
  const evidence = [...session.progress.evidence];
  if (!result.ok) {
    if (
      id === "m01.cleanup-images" &&
      action === "rmi" &&
      before.containers.some((c) => c.image === "hello-world") &&
      /referenced/.test(result.message) &&
      !evidence.includes("unsafe-rejected")
    )
      evidence.push("unsafe-rejected");
    return { ...session, progress: { ...session.progress, evidence } };
  }
  const after = result.state,
    web = after.containers.find((c) => c.name === "web");
  let complete = false;
  if (id === "m01.pull-nginx")
    complete =
      action === "pull" &&
      after.images.some((i) => normalizeReference(i.name) === "nginx:latest") &&
      !after.containers.length;
  if (id === "m01.list-images")
    complete =
      action === "images" && after.images.length === before.images.length;
  if (id === "m01.run-nginx")
    complete =
      action === "run" &&
      after.containers.length === before.containers.length + 1 &&
      after.containers.at(-1).image === "nginx" &&
      after.containers.at(-1).status === "running";
  if (id === "m01.list-running")
    complete =
      action === "ps" &&
      !args.length &&
      /web/.test(result.message) &&
      !/finished/.test(result.message);
  if (id === "m01.list-all")
    complete =
      action === "ps" &&
      args.some((a) => ["-a", "--all"].includes(a)) &&
      /web/.test(result.message) &&
      /finished/.test(result.message);
  if (id === "m01.stop-web")
    complete =
      action === "stop" &&
      web?.status === "stopped" &&
      after.containers.find((c) => c.name === "sibling")?.status === "running";
  if (id === "m01.start-web")
    complete =
      action === "start" &&
      web?.status === "running" &&
      web.id === before.containers.find((c) => c.name === "web")?.id &&
      !!web.fs["/tmp/keep"];
  if (id === "m01.remove-web")
    complete =
      action === "rm" && !web && after.images.some((i) => i.name === "nginx");
  if (id === "m01.exec-files")
    complete =
      action === "exec" &&
      args[1] === "ls" &&
      (args[2] || web?.cwd) === "/" &&
      web?.status === "running" &&
      after.containers.length === before.containers.length;
  if (id === "m01.help")
    complete = action === "help" || (args.length === 1 && args[0] === "--help");
  if (
    id === "m01.debug-exit" &&
    ["inspect", "logs"].includes(action) &&
    ["broken", before.containers[0].id, before.containers[0].legacyId].includes(
      args[0],
    ) &&
    !evidence.includes(action)
  )
    evidence.push(action);
  if (id === "m01.named-port")
    complete =
      action === "run" &&
      web?.status === "running" &&
      web.detached &&
      web.ports.some((p) => p.host === 8080 && p.container === 80);
  if (id === "m01.cleanup-images")
    complete =
      action === "rmi" &&
      evidence.includes("unsafe-rejected") &&
      !after.containers.some((c) => c.image === "hello-world") &&
      !after.images.some((i) => i.name === "hello-world");
  if (id === "m01.two-instances") {
    const a = after.containers.find((c) => c.name === "web-a"),
      b = after.containers.find((c) => c.name === "web-b");
    complete =
      action === "stop" &&
      a?.status === "stopped" &&
      b?.status === "running" &&
      a.id !== b.id &&
      a.imageId === b.imageId &&
      after.images.length === 1;
  }
  return {
    ...session,
    state: after,
    progress: {
      ...session.progress,
      evidence,
      complete: session.progress.complete || complete,
    },
  };
}
export function answerDiagnosis(session, answer) {
  const evidence = session.progress.evidence;
  return {
    ...session,
    progress: {
      ...session.progress,
      diagnosis: answer,
      complete:
        session.id === "m01.debug-exit" &&
        answer === "missing-executable" &&
        evidence.includes("logs") &&
        evidence.includes("inspect"),
    },
  };
}
