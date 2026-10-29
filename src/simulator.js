import { createContainerRuntime, executeVirtualCommand } from "./filesystem.js";
import { parseCommand, parseRun } from "./parser.js";
import { helpText, CORE_VERSION } from "./capabilities.js";
import {
  profileFor,
  imageConfiguration,
  parseDefaultCommand,
} from "./image-profiles.js";
export { CORE_VERSION };
export function normalizeReference(name) {
  if (typeof name !== "string" || !IMAGE_RE.test(name))
    throw Error("Invalid image name.");
  let v = name.replace(/^docker\.io\//, "").replace(/^library\//, "");
  if (!v.includes(":")) v += ":latest";
  return v;
}
function imageFor(state, name) {
  return state.images.find(
    (i) =>
      i.id === name ||
      (i.tags === undefined &&
        normalizeReference(i.name) === normalizeReference(name)) ||
      (i.tags || []).includes(normalizeReference(name)),
  );
}
function containerFor(state, name) {
  const matches = state.containers.filter(
    (c) =>
      c.id === name ||
      c.name === name ||
      c.legacyId === name ||
      (/^[a-f0-9]{4,12}$/.test(name || "") && c.id.startsWith(name)),
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Deterministic Docker teaching simulator, V1 + V2 + V3.
 * Not a Docker CLI: no shell, network, filesystem, container runtime or dynamic eval.
 * Commands either return an entirely new state or the identical original on failure.
 */
export function createInitialState() {
  return { images: [], containers: [], nextId: 1, history: [] };
}

const IMAGE_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/;
const ID_RE = /^c\d{3,}$/;
const TAG_RE = IMAGE_RE;
const MAX_COMMAND = 250;
const MAX_FILE = 6000;
const LAYER_ACTIONS = new Set(["RUN", "COPY", "WORKDIR", "CMD"]);

// An intentionally small, documented OFFLINE demonstration catalogue. This never
// queries Docker Hub and must not pretend that an arbitrary name exists remotely.
const REGISTRY_EXAMPLES = new Set([
  "ubuntu",
  "alpine",
  "nginx",
  "redis",
  "node",
  "python",
  "debian",
  "busybox",
  "hello-world",
  "httpd",
]);
function inDemoRegistry(name) {
  const path = name.split(":")[0];
  const image = path.split("/").at(-1).toLowerCase();
  return (
    REGISTRY_EXAMPLES.has(image) &&
    [image, `library/${image}`, `docker.io/library/${image}`].includes(path)
  );
}
function registryNotFound(state, name) {
  const message = `Image "${name}" not found in the OFFLINE simulated registry catalogue. Try ubuntu, alpine, nginx, node or python. No real registry was contacted.`;
  return fail(state, message, [
    {
      kind: "lookup",
      message: `Checking offline simulated registry for ${name}`,
    },
    { kind: "missing", message },
  ]);
}

function fail(state, message, steps = []) {
  return { ok: false, state, message, steps };
}
function done(prior, next, message, steps, command) {
  return {
    ok: true,
    message,
    steps,
    state: {
      ...next,
      history: [
        ...prior.history,
        { command, message, at: (prior.history.at(-1)?.at || 0) + 1 },
      ].slice(-100),
    },
  };
}

// A deterministic educational layer identifier. This is NOT Docker's content digest.
function layerId(input) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sim-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function registryImage(name) {
  name = normalizeReference(name).replace(/:latest$/, "");
  const base = name.split(":")[0].split("/").at(-1).toLowerCase();
  const instructions = [
    "REGISTRY filesystem base",
    `REGISTRY ${base === "alpine" ? "musl and busybox" : "system libraries"}`,
    "REGISTRY default configuration",
  ];
  let parent = `registry:${name}`;
  const layers = instructions.map((instruction, index) => {
    const id = layerId(`${parent}|${instruction}`);
    parent = id;
    return { id, instruction, kind: "base", index: index + 1 };
  });
  return {
    id: layerId(`image:${normalizeReference(name)}`),
    name,
    tags: [normalizeReference(name)],
    runtimeConfig: imageConfiguration({ name }),
    layers,
    source: "registry",
    base: null,
  };
}

function allLayerIds(images) {
  return new Set(
    images.flatMap((image) => image.layers.map((layer) => layer.id)),
  );
}

export function parseDockerfile(source) {
  if (typeof source !== "string" || !source.trim())
    throw new Error("Dockerfile is empty. Start with FROM ubuntu.");
  if (source.length > MAX_FILE)
    throw new Error("Dockerfile must be at most 6000 characters.");
  const lines = source.split(/\r?\n/);
  if (lines.length > 60) throw new Error("Dockerfile exceeds 60 lines.");
  const instructions = [];
  for (const [index, original] of lines.entries()) {
    const text = original.trim();
    if (!text || text.startsWith("#")) continue;
    const match = /^([a-z]+)\s+(.+)$/i.exec(text);
    if (!match)
      throw new Error(
        `Dockerfile line ${index + 1}: expected INSTRUCTION argument.`,
      );
    const op = match[1].toUpperCase();
    const arg = match[2].trim();
    if (!instructions.length && op !== "FROM")
      throw new Error(
        `Dockerfile line ${index + 1}: first instruction must be FROM.`,
      );
    if (op === "FROM") {
      if (instructions.length)
        throw new Error(
          "Multi-stage builds are not supported in this simulator. Only one FROM is allowed.",
        );
      if (!IMAGE_RE.test(arg))
        throw new Error(`Dockerfile line ${index + 1}: invalid FROM image.`);
    } else if (!LAYER_ACTIONS.has(op)) {
      throw new Error(
        `Dockerfile line ${index + 1}: unsupported instruction ${op}. Supported: FROM, RUN, COPY, WORKDIR, CMD.`,
      );
    } else if (op === "COPY") {
      const parts = arg.split(/\s+/);
      if (
        parts.length !== 2 ||
        parts.some((p) => !/^[\w.\/-]+$/.test(p) || p.includes(".."))
      ) {
        throw new Error(
          `Dockerfile line ${index + 1}: COPY requires two simple paths, e.g. COPY app.js /app/.`,
        );
      }
    } else if (
      op === "WORKDIR" &&
      (!/^\/[a-zA-Z0-9._/-]+$/.test(arg) || arg.includes(".."))
    ) {
      throw new Error(
        `Dockerfile line ${index + 1}: WORKDIR requires an absolute path without '..'.`,
      );
    }
    if (arg.length > 300)
      throw new Error(`Dockerfile line ${index + 1}: argument too long.`);
    instructions.push({
      op,
      arg,
      line: index + 1,
      instruction: `${op} ${arg}`,
    });
    if (instructions.length > 18)
      throw new Error("Only up to 18 Dockerfile instructions are supported.");
  }
  if (!instructions.length) throw new Error("Dockerfile has no instructions.");
  return instructions;
}

function help() {
  return [
    "docker pull <image>",
    "docker run <image>",
    "docker start <container-id>",
    "docker stop <container-id>",
    "docker rm <container-id>",
    "docker images",
    "docker ps  (or docker ps -a)",
    "docker history <image>",
    "docker build -t <name> .",
    "docker help",
    "docker exec <running-id> pwd | ls /tmp | ps",
    "docker exec <running-id> mkdir /tmp/work | touch /tmp/note.txt",
    "docker exec <running-id> write /tmp/note.txt hello | cat /tmp/note.txt | rm /tmp/note.txt",
    "Offline registry examples: ubuntu, alpine, nginx, redis, node, python, debian, busybox, hello-world, httpd",
  ].join("\n");
}

function buildImage(state, imageName, dockerfile, command, context = {}) {
  if (!TAG_RE.test(imageName))
    return fail(
      state,
      "Invalid image tag. Example: docker build -t myapp:latest .",
    );
  let parsed;
  try {
    parsed = parseDockerfile(dockerfile);
  } catch (error) {
    return fail(state, error.message);
  }
  const baseName = parsed[0].arg;
  if (
    !context ||
    typeof context !== "object" ||
    JSON.stringify(context).length > 20000
  )
    return fail(state, "Synthetic build context exceeds limit.");
  const found = imageFor(state, baseName);
  if (!found && !inDemoRegistry(baseName))
    return registryNotFound(state, baseName);
  const baseImage = found || registryImage(baseName);
  const steps = [
    {
      kind: "dockerfile",
      message: `Reading ${parsed.length} Dockerfile instructions`,
    },
  ];
  if (!found)
    steps.push({
      kind: "pull",
      message: `Fetching base image ${baseName} (simulated)`,
    });
  const known = allLayerIds([...state.images, baseImage]);
  let parent = baseImage.layers.at(-1).id;
  const customLayers = [];
  const instructionHistory = [];
  let hits = 0;
  for (const item of parsed.slice(1)) {
    const content =
      item.op === "COPY"
        ? String(
            context[item.arg.split(/\s+/)[0]] ?? "[synthetic example file]",
          )
        : "";
    const id = layerId(`${parent}|${item.instruction}|${content}`);
    const cached =
      known.has(id) ||
      state.images.some((i) => (i.history || []).some((l) => l.id === id));
    if (cached) hits++;
    known.add(id);
    const layer = {
      id,
      instruction: item.instruction,
      kind: "custom",
      cached,
      metadata: item.op === "CMD",
      ...(item.op === "COPY" ? { content } : {}),
    };
    instructionHistory.push(layer);
    if (!layer.metadata) customLayers.push(layer);
    steps.push({
      kind: "layer",
      message: `${cached ? "Using cached" : "Creating"} layer ${id}: ${item.instruction}`,
      layerId: id,
    });
    parent = id;
  }
  const runtimeConfig = imageConfiguration(baseImage);
  const configuredCMD = parsed.findLast((item) => item.op === "CMD");
  if (configuredCMD)
    runtimeConfig.defaultCommand = parseDefaultCommand(configuredCMD.arg);
  const built = {
    runtimeConfig,
    id: layerId(
      `built:${baseImage.id}:${parent}:${parsed.map((item) => item.instruction).join("|")}`,
    ),
    name: imageName,
    base: baseName,
    source: "build",
    layers: [...baseImage.layers, ...customLayers],
    history: [
      ...(baseImage.history || baseImage.layers),
      ...instructionHistory,
    ],
    tags: [normalizeReference(imageName)],
    dockerfile: parsed.map((item) => item.instruction).join("\n"),
  };
  const newTag = normalizeReference(imageName);
  const images = state.images.flatMap((image) => {
    const tags = (image.tags || [normalizeReference(image.name)]).filter(
      (t) => t !== newTag,
    );
    if (image.id === built.id) return [];
    if (!tags.length && !state.containers.some((c) => c.imageId === image.id))
      return [];
    return [
      {
        ...image,
        tags,
        name: tags.length
          ? tags.includes(normalizeReference(image.name))
            ? image.name
            : tags[0]
          : image.id,
      },
    ];
  });
  if (
    baseImage.id !== built.id &&
    !images.some((image) => image.id === baseImage.id)
  ) {
    const tags = (
      baseImage.tags || [normalizeReference(baseImage.name)]
    ).filter((tag) => tag !== newTag);
    images.push({
      ...baseImage,
      tags,
      name: tags.length ? baseImage.name : baseImage.id,
    });
  }
  const same = state.images.find((i) => i.id === built.id);
  images.push({
    ...built,
    name: same?.name || imageName,
    tags: [...new Set([...(same?.tags || []), newTag])],
  });
  if (images.length > 100 || built.layers.length > 100)
    return fail(
      state,
      "Teaching image/layer limit reached. Export and clean up before another build.",
    );
  steps.push({
    kind: "build",
    message: `Tagged ${imageName} with ${built.layers.length} layers`,
  });
  return done(
    state,
    { ...state, images },
    `Built ${imageName} from ${baseName}. ${customLayers.length} filesystem layers; ${instructionHistory.filter((l) => l.metadata).length} metadata instructions (${hits} reused from cache).`,
    steps,
    command,
  );
}

export function runCommand(state, rawInput, options = {}) {
  let ast;
  try {
    ast = parseCommand(rawInput);
  } catch (e) {
    return fail(state, e.message);
  }
  const { action, args, raw: input } = ast;
  if (action === "help")
    return args.length
      ? fail(state, "Usage: docker help")
      : done(state, state, helpText(), [], input);
  if (args.includes("--help"))
    return args.length === 1
      ? done(state, state, helpText(action), [], input)
      : fail(state, "Use --help without other arguments.");
  if (action === "build") {
    if (args.length !== 3 || args[0] !== "-t" || args[2] !== ".")
      return fail(state, "Usage: docker build -t <image-name> .");
    return buildImage(
      state,
      args[1],
      options.dockerfile,
      input,
      options.context,
    );
  }
  if (action === "images") {
    if (args.length) return fail(state, "Usage: docker images");
    return done(
      state,
      state,
      state.images.length
        ? state.images
            .map(
              (i) =>
                `• ${i.name} [${(i.tags || []).join(", ") || "untagged"}] (${i.layers.length} layers)  ${i.id}`,
            )
            .join("\n")
        : "No images pulled yet.",
      [],
      input,
    );
  }
  if (action === "ps") {
    if (args.length > 1 || (args.length && !["-a", "--all"].includes(args[0])))
      return fail(state, "Usage: docker ps [-a]");
    const visible = args.length
      ? state.containers
      : state.containers.filter((c) => c.status === "running");
    return done(
      state,
      state,
      visible.length
        ? visible
            .map(
              (c) =>
                `${c.id}  ${c.name} (${c.legacyId})  ${c.image}  ${c.status.toUpperCase()}${c.status === "stopped" ? ` (exited ${c.exitCode})` : ""}  ${c.ports.map((p) => `${p.host}->${p.container}/tcp`).join(",")}`,
            )
            .join("\n")
        : "No matching containers.",
      [],
      input,
    );
  }
  if (["container-prune", "image-prune"].includes(action)) {
    if (
      (action === "container-prune" && args.length) ||
      (action === "image-prune" &&
        (args.length > 1 || (args.length && args[0] !== "-a")))
    )
      return fail(state, helpText(action));
    if (!options.confirmed)
      return {
        ...fail(
          state,
          action === "container-prune"
            ? "Remove all stopped containers and their writable files?"
            : "Remove " +
                (args[0] === "-a" ? "all unused" : "dangling (untagged)") +
                " local images?",
        ),
        confirmation: true,
      };
    const containers =
      action === "container-prune"
        ? state.containers.filter((c) => c.status === "running")
        : state.containers;
    const images =
      action === "image-prune"
        ? state.images.filter(
            (i) =>
              containers.some((c) => c.imageId === i.id) ||
              (!args.length && (i.tags || [i.name]).length > 0),
          )
        : state.images;
    return done(
      state,
      { ...state, containers, images },
      `Removed ${state.containers.length - containers.length} stopped containers and ${state.images.length - images.length} unused images.`,
      [],
      input,
    );
  }
  if (action === "run" || action === "pull") {
    let config;
    try {
      config = action === "run" ? parseRun(args) : { image: args[0] };
      if (action === "pull" && args.length !== 1)
        throw Error("Usage: docker pull IMAGE");
      normalizeReference(config.image);
    } catch (e) {
      return fail(state, e.message);
    }
    const target = config.image;
    const image = imageFor(state, target);
    if (!image && !inDemoRegistry(target))
      return registryNotFound(state, target);
    if (config.name && containerFor(state, config.name))
      return fail(state, `Container name ${config.name} is already in use.`);
    if (
      config.ports?.some((p) =>
        state.containers.some(
          (c) =>
            c.status === "running" && c.ports.some((cp) => cp.host === p.host),
        ),
      )
    )
      return fail(
        state,
        "Host port is already allocated by a running container.",
      );
    if (
      (state.images.length >= 100 && !image) ||
      (state.containers.length >= 100 && action === "run")
    )
      return fail(
        state,
        "Teaching workspace limit reached (100 images/containers). Export then clean up.",
      );
    const resolved = image || registryImage(target),
      images = image ? state.images : [...state.images, resolved];
    const steps = image
      ? []
      : [
          {
            kind: "pull",
            message: `Looking for ${target} in host image library, then fetching image layers (simulated)`,
          },
          ...resolved.layers.map((layer) => ({
            kind: "layer",
            message: `Caching synthetic base layer ${layer.id}`,
            layerId: layer.id,
          })),
        ];
    if (action === "pull")
      return done(
        state,
        { ...state, images },
        image
          ? `Image ${target} already exists locally.`
          : `Pulled ${target} with ${resolved.layers.length} simulated base layers.`,
        steps,
        input,
      );
    const legacyId = `c${String(state.nextId).padStart(3, "0")}`,
      id = state.nextId.toString(16).padStart(12, "0");
    const profile = profileFor(resolved, config.command);
    if (profile.unsupported) return fail(state, profile.message);
    let generatedName = `practice-${state.nextId}`,
      suffix = 2;
    while (state.containers.some((c) => c.name === generatedName))
      generatedName = `practice-${state.nextId}-${suffix++}`;
    const runtime = createContainerRuntime(resolved);
    const c = {
      id,
      legacyId,
      name: config.name || generatedName,
      image: resolved.name,
      imageId: resolved.id,
      status: profile.running ? "running" : "stopped",
      exitCode: profile.exitCode,
      layers: resolved.layers.map((l) => ({ ...l })),
      ...runtime,
      processes: [
        {
          pid: 1,
          name: profile.name,
          status: profile.running ? "running" : "stopped",
        },
      ],
      logs: profile.logs,
      ports: config.ports,
      detached: config.detached,
      command: config.command.length
        ? config.command
        : [...imageConfiguration(resolved).defaultCommand],
      profile,
      starts: 1,
    };
    steps.push(
      {
        kind: "create",
        message: `Creating ${c.name} (${id}; legacy ${legacyId}) from ${target}`,
      },
      {
        kind: "start",
        message: `Starting ${c.name}${profile.running ? "" : "; main process exits"}`,
      },
    );
    return done(
      state,
      {
        ...state,
        images,
        containers: [...state.containers, c],
        nextId: state.nextId + 1,
      },
      `Created ${c.name} (${id}, ${legacyId}) from ${target}. Container is ${c.status}.${config.detached ? " Detached: terminal attachment changed only." : profile.running ? " Foreground service continues until stopped; this teaching terminal remains usable." : ""}`,
      steps,
      input,
    );
  }
  if (
    [
      "inspect",
      "image-inspect",
      "history",
      "rmi",
      "logs",
      "start",
      "stop",
      "rm",
      "exec",
    ].includes(action)
  ) {
    if (action === "exec" ? args.length < 2 : args.length !== 1)
      return fail(state, helpText(action));
    const target = args[0];
    if (target.startsWith("-"))
      return fail(state, "Option is not yet simulated. " + helpText(action));
    const c = containerFor(state, target);
    let image;
    try {
      image = imageFor(state, target);
    } catch {}
    if (action === "history")
      return image
        ? done(
            state,
            state,
            (image.history || image.layers)
              .map(
                (l, i) =>
                  `${i + 1}. ${l.id}  ${l.instruction}${l.metadata ? " [metadata; no filesystem data layer]" : ""}`,
              )
              .join("\n"),
            [],
            input,
          )
        : fail(state, `Image ${target} not found.`);
    if (action === "inspect" || action === "image-inspect") {
      if ((action === "image-inspect" && !image) || (!c && !image))
        return fail(state, `Object ${target} does not exist.`);
      const data =
        c && action !== "image-inspect"
          ? {
              Id: c.id,
              Name: c.name,
              Image: c.imageId,
              State: {
                Status: c.status === "stopped" ? "exited" : c.status,
                ExitCode: c.exitCode,
                Running: c.status === "running",
              },
              Config: { Image: c.image, Cmd: c.command },
              HostConfig: { PortBindings: c.ports },
              Synthetic: true,
            }
          : {
              Id: image.id,
              RepoTags: image.tags || [normalizeReference(image.name)],
              RootFS: { Layers: image.layers.map((l) => l.id) },
              Synthetic: true,
            };
      return done(state, state, JSON.stringify([data], null, 2), [], input);
    }
    if (action === "rmi") {
      if (!image) return fail(state, `Image ${target} not found.`);
      const tags = image.tags || [normalizeReference(image.name)];
      if (tags.length > 1) {
        if (target === image.id)
          return fail(
            state,
            "Image has multiple tags. Remove a specific tag instead.",
          );
        const remaining = tags.filter((t) => t !== normalizeReference(target));
        return done(
          state,
          {
            ...state,
            images: state.images.map((i) =>
              i.id === image.id
                ? { ...i, tags: remaining, name: remaining[0] }
                : i,
            ),
          },
          `Untagged ${target}; image content remains.`,
          [],
          input,
        );
      }
      if (state.containers.some((c) => c.imageId === image.id))
        return fail(
          state,
          "Image is referenced by a container (including stopped containers). Remove that container first.",
        );
      return done(
        state,
        { ...state, images: state.images.filter((i) => i.id !== image.id) },
        `Removed local image ${image.name}; no registry changed.`,
        [],
        input,
      );
    }
    if (!c)
      return fail(
        state,
        `Container ${target} does not exist or its ID prefix is ambiguous. Check docker ps -a.`,
      );
    if (action === "logs")
      return done(
        state,
        state,
        c.logs.join("\n") || "(no captured stdout/stderr)",
        [],
        input,
      );
    if (action === "exec") {
      if (c.status !== "running")
        return fail(
          state,
          `Container ${target} is stopped. Start it before using exec.`,
        );
      const virtual = executeVirtualCommand(c, args.slice(1).join(" "));
      if (virtual.error) return fail(state, virtual.error);
      return done(
        state,
        {
          ...state,
          containers: state.containers.map((x) =>
            x.id === c.id ? { ...x, ...virtual.runtime } : x,
          ),
        },
        `[${c.name}] ${virtual.message}`,
        virtual.steps,
        input,
      );
    }
    if (action === "rm") {
      if (c.status === "running")
        return fail(
          state,
          `Stop ${target} before removing it (docker stop ${target}).`,
        );
      return done(
        state,
        { ...state, containers: state.containers.filter((x) => x.id !== c.id) },
        `Removed container ${target}.`,
        [{ kind: "remove", message: `Removing ${target}` }],
        input,
      );
    }
    if (
      (action === "stop" && c.status !== "running") ||
      (action === "start" && c.status === "running")
    )
      return fail(state, `Container ${target} is already ${c.status}.`);
    if (
      action === "start" &&
      c.ports.some((p) =>
        state.containers.some(
          (o) =>
            o.id !== c.id &&
            o.status === "running" &&
            o.ports.some((cp) => cp.host === p.host),
        ),
      )
    )
      return fail(state, "Host port is already allocated.");
    const running = action === "start" && c.profile.running,
      status = running ? "running" : "stopped";
    const changed = {
      ...c,
      status,
      exitCode: action === "start" ? c.profile.exitCode : 0,
      starts: c.starts + (action === "start" ? 1 : 0),
      processes: [{ pid: 1, name: c.profile.name, status }],
      recentExec: action === "start" ? [] : c.recentExec,
      nextPid: action === "start" ? 2 : c.nextPid,
      logs: [
        ...c.logs,
        ...(action === "start"
          ? c.profile.logs
          : [`${c.name}: main process stopped.`]),
      ].slice(-100),
    };
    return done(
      state,
      {
        ...state,
        containers: state.containers.map((x) => (x.id === c.id ? changed : x)),
      },
      `${target} is now ${status}.`,
      [
        {
          kind: action,
          message: `${action === "start" ? "Starting" : "Stopping"} ${target}`,
        },
      ],
      input,
    );
  }
  return fail(
    state,
    `Unknown Docker command "${action}". Real Docker command may be not yet simulated. A container ID is not a command. Use docker help for the supported subset.`,
  );
}
