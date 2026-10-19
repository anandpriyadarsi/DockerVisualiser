import { createContainerRuntime, executeVirtualCommand } from './filesystem.js';

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
const LAYER_ACTIONS = new Set(['RUN', 'COPY', 'WORKDIR', 'CMD']);

// An intentionally small, documented OFFLINE demonstration catalogue. This never
// queries Docker Hub and must not pretend that an arbitrary name exists remotely.
const REGISTRY_EXAMPLES = new Set([
  'ubuntu', 'alpine', 'nginx', 'redis', 'node', 'python', 'debian',
  'busybox', 'hello-world', 'httpd',
]);
function inDemoRegistry(name) {
  const path = name.split(':')[0];
  const image = path.split('/').at(-1).toLowerCase();
  return REGISTRY_EXAMPLES.has(image) && [
    image, `library/${image}`, `docker.io/library/${image}`,
  ].includes(path);
}
function registryNotFound(state, name) {
  const message = `Image "${name}" not found in the OFFLINE simulated registry catalogue. Try ubuntu, alpine, nginx, node or python. No real registry was contacted.`;
  return fail(state, message, [
    { kind: 'lookup', message: `Checking offline simulated registry for ${name}` },
    { kind: 'missing', message },
  ]);
}

function fail(state, message, steps = []) { return { ok: false, state, message, steps }; }
function done(prior, next, message, steps, command) {
  return {
    ok: true, message, steps,
    state: { ...next, history: [...prior.history, { command, message, at: prior.history.length + 1 }] },
  };
}

// A deterministic educational layer identifier. This is NOT Docker's content digest.
function layerId(input) {
  let hash = 2166136261;
  for (const char of input) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `sim-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function registryImage(name) {
  const base = name.split(':')[0].split('/').at(-1).toLowerCase();
  const instructions = [
    'REGISTRY filesystem base',
    `REGISTRY ${base === 'alpine' ? 'musl and busybox' : 'system libraries'}`,
    'REGISTRY default configuration',
  ];
  let parent = `registry:${name}`;
  const layers = instructions.map((instruction, index) => {
    const id = layerId(`${parent}|${instruction}`);
    parent = id;
    return { id, instruction, kind: 'base', index: index + 1 };
  });
  return { id: layerId(`image:${name}`), name, layers, source: 'registry', base: null };
}

function allLayerIds(images) {
  return new Set(images.flatMap(image => image.layers.map(layer => layer.id)));
}

export function parseDockerfile(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Dockerfile is empty. Start with FROM ubuntu.');
  if (source.length > MAX_FILE) throw new Error('Dockerfile must be at most 6000 characters.');
  const lines = source.split(/\r?\n/);
  if (lines.length > 60) throw new Error('Dockerfile exceeds 60 lines.');
  const instructions = [];
  for (const [index, original] of lines.entries()) {
    const text = original.trim();
    if (!text || text.startsWith('#')) continue;
    const match = /^([a-z]+)\s+(.+)$/i.exec(text);
    if (!match) throw new Error(`Dockerfile line ${index + 1}: expected INSTRUCTION argument.`);
    const op = match[1].toUpperCase();
    const arg = match[2].trim();
    if (!instructions.length && op !== 'FROM') throw new Error(`Dockerfile line ${index + 1}: first instruction must be FROM.`);
    if (op === 'FROM') {
      if (instructions.length) throw new Error('Multi-stage builds are not supported in this simulator. Only one FROM is allowed.');
      if (!IMAGE_RE.test(arg)) throw new Error(`Dockerfile line ${index + 1}: invalid FROM image.`);
    } else if (!LAYER_ACTIONS.has(op)) {
      throw new Error(`Dockerfile line ${index + 1}: unsupported instruction ${op}. Supported: FROM, RUN, COPY, WORKDIR, CMD.`);
    } else if (op === 'COPY') {
      const parts = arg.split(/\s+/);
      if (parts.length !== 2 || parts.some(p => !/^[\w.\/-]+$/.test(p) || p.includes('..'))) {
        throw new Error(`Dockerfile line ${index + 1}: COPY requires two simple paths, e.g. COPY app.js /app/.`);
      }
    } else if (op === 'WORKDIR' && (!/^\/[a-zA-Z0-9._/-]+$/.test(arg) || arg.includes('..'))) {
      throw new Error(`Dockerfile line ${index + 1}: WORKDIR requires an absolute path without '..'.`);
    }
    if (arg.length > 300) throw new Error(`Dockerfile line ${index + 1}: argument too long.`);
    instructions.push({ op, arg, line: index + 1, instruction: `${op} ${arg}` });
    if (instructions.length > 18) throw new Error('Only up to 18 Dockerfile instructions are supported.');
  }
  if (!instructions.length) throw new Error('Dockerfile has no instructions.');
  return instructions;
}

function help() {
  return [
    'docker pull <image>', 'docker run <image>',
    'docker start <container-id>', 'docker stop <container-id>', 'docker rm <container-id>',
    'docker images', 'docker ps  (or docker ps -a)',
    'docker history <image>', 'docker build -t <name> .', 'docker help',
    'docker exec <running-id> pwd | ls /tmp | ps',
    'docker exec <running-id> mkdir /tmp/work | touch /tmp/note.txt',
    'docker exec <running-id> write /tmp/note.txt hello | cat /tmp/note.txt | rm /tmp/note.txt',
    'Offline registry examples: ubuntu, alpine, nginx, redis, node, python, debian, busybox, hello-world, httpd',
  ].join('\n');
}

function buildImage(state, imageName, dockerfile, command) {
  if (!TAG_RE.test(imageName)) return fail(state, 'Invalid image tag. Example: docker build -t myapp:latest .');
  let parsed;
  try { parsed = parseDockerfile(dockerfile); }
  catch (error) { return fail(state, error.message); }
  const baseName = parsed[0].arg;
  const found = state.images.find(image => image.name === baseName);
  if (!found && !inDemoRegistry(baseName)) return registryNotFound(state, baseName);
  const baseImage = found || registryImage(baseName);
  const steps = [{ kind: 'dockerfile', message: `Reading ${parsed.length} Dockerfile instructions` }];
  if (!found) steps.push({ kind: 'pull', message: `Fetching base image ${baseName} (simulated)` });
  const known = allLayerIds([...state.images, baseImage]);
  let parent = baseImage.layers.at(-1).id;
  const customLayers = [];
  let hits = 0;
  for (const item of parsed.slice(1)) {
    const id = layerId(`${parent}|${item.instruction}`);
    const cached = known.has(id);
    if (cached) hits++;
    known.add(id);
    customLayers.push({ id, instruction: item.instruction, kind: 'custom', cached });
    steps.push({ kind: 'layer', message: `${cached ? 'Using cached' : 'Creating'} layer ${id}: ${item.instruction}`, layerId: id });
    parent = id;
  }
  const built = {
    id: layerId(`built:${baseImage.id}:${parent}:${parsed.map(item => item.instruction).join('|')}`),
    name: imageName, base: baseName, source: 'build',
    layers: [...baseImage.layers, ...customLayers],
    dockerfile: parsed.map(item => item.instruction).join('\n'),
  };
  const images = [...state.images.filter(image => image.name !== imageName)];
  if (baseName !== imageName && !images.some(image => image.name === baseName)) images.push(baseImage);
  const existingIndex = images.findIndex(image => image.name === imageName);
  if (existingIndex >= 0) images.splice(existingIndex, 1);
  images.push(built);
  steps.push({ kind: 'build', message: `Tagged ${imageName} with ${built.layers.length} layers` });
  return done(state, { ...state, images }, `Built ${imageName} from ${baseName}. ${customLayers.length} Dockerfile layers (${hits} reused from cache).`, steps, command);
}

export function runCommand(state, rawInput, options = {}) {
  if (typeof rawInput !== 'string' || rawInput.length > MAX_COMMAND) return fail(state, 'Please enter a command of at most 250 characters.');
  const input = rawInput.trim();
  if (!input) return fail(state, 'Enter a Docker command to begin.');
  const args = input.split(/\s+/);
  if (args[0] !== 'docker') return fail(state, 'Only simulated docker commands are supported. Try: docker help');
  const [_, action, target, extra] = args;
  if (action === 'help' && args.length === 2) return done(state, state, help(), [], input);
  if (action === 'images' && args.length === 2) {
    const output = state.images.length ? state.images.map(i => `• ${i.name} (${i.layers.length} layers)`).join('\n') : 'No images pulled yet.';
    return done(state, state, output, [], input);
  }
  if (action === 'ps' && (args.length === 2 || (args.length === 3 && target === '-a'))) {
    const visible = target === '-a' ? state.containers : state.containers.filter(c => c.status === 'running');
    return done(state, state, visible.length ? visible.map(c => `${c.id}  ${c.image}  ${c.status.toUpperCase()}`).join('\n') : 'No matching containers.', [], input);
  }
  if (action === 'history' && args.length === 3) {
    const image = state.images.find(i => i.name === target);
    if (!image) return fail(state, `Image ${target} not found. Try docker images.`);
    return done(state, state, image.layers.map((layer, index) => `${index + 1}. ${layer.id}  ${layer.instruction}`).join('\n'), [], input);
  }
  if (action === 'build') {
    if (args.length !== 5 || target !== '-t' || args[4] !== '.') return fail(state, 'Usage: docker build -t <image-name> .');
    return buildImage(state, args[3], options.dockerfile, input);
  }
  if (action === 'exec') {
    if (args.length < 4 || !ID_RE.test(target)) return fail(state, 'Usage: docker exec <running-container-id> <simulated-command>.');
    const container = state.containers.find(c => c.id === target);
    if (!container) return fail(state, `Container ${target} does not exist.`);
    if (container.status !== 'running') return fail(state, `Container ${target} is stopped. Start it before using exec.`);
    const virtual = executeVirtualCommand(container, args.slice(3).join(' '));
    if (virtual.error) return fail(state, virtual.error);
    const containers = state.containers.map(c => c.id === target ? { ...c, ...virtual.runtime } : c);
    return done(state, { ...state, containers }, `[${target}] ${virtual.message}`, virtual.steps, input);
  }
  if (!['pull', 'run', 'start', 'stop', 'rm'].includes(action) || args.length !== 3 || extra !== undefined) {
    return fail(state, 'Unknown or incomplete command. Type docker help to see supported commands.');
  }

  if (action === 'pull' || action === 'run') {
    if (!IMAGE_RE.test(target)) return fail(state, 'Invalid image name. Example: docker pull ubuntu:latest');
    const image = state.images.find(i => i.name === target);
    if (!image && !inDemoRegistry(target)) return registryNotFound(state, target);
    const resolved = image || registryImage(target);
    const images = image ? state.images : [...state.images, resolved];
    const steps = image ? [] : [
      { kind: 'pull', message: `Looking for ${target} in host image library, then fetching image layers` },
      ...resolved.layers.map(layer => ({ kind: 'layer', message: `Caching base layer ${layer.id}`, layerId: layer.id })),
    ];
    if (action === 'pull') return done(state, { ...state, images }, image ? `Image ${target} already exists locally.` : `Pulled ${target} with ${resolved.layers.length} simulated base layers.`, steps, input);
    const id = `c${String(state.nextId).padStart(3, '0')}`;
    const containers = [...state.containers, { id, image: target, imageId: resolved.id, status: 'running', layers: resolved.layers.map(l => ({ ...l })), ...createContainerRuntime(resolved) }];
    steps.push({ kind: 'create', message: `Creating ${id} from ${target}` }, { kind: 'start', message: `Starting ${id}` });
    return done(state, { ...state, images, containers, nextId: state.nextId + 1 }, `Created ${id} from ${target}. Container is running.`, steps, input);
  }
  if (!ID_RE.test(target)) return fail(state, 'Use a container ID such as c001. Check docker ps -a.');
  const container = state.containers.find(c => c.id === target);
  if (!container) return fail(state, `Container ${target} does not exist.`);
  if (action === 'start' && container.status === 'running') return fail(state, `Container ${target} is already running.`);
  if (action === 'stop' && container.status === 'stopped') return fail(state, `Container ${target} is already stopped.`);
  if (action === 'rm' && container.status === 'running') return fail(state, `Stop ${target} before removing it (docker stop ${target}).`);
  if (action === 'rm') return done(state, { ...state, containers: state.containers.filter(c => c.id !== target) }, `Removed container ${target}.`, [{ kind: 'remove', message: `Removing ${target} from host` }], input);
  const nextStatus = action === 'start' ? 'running' : 'stopped';
  return done(state, { ...state, containers: state.containers.map(c => c.id === target ? { ...c, status: nextStatus, processes: c.processes.map(p => ({ ...p, status: nextStatus === 'running' ? 'running' : 'stopped' })) } : c) }, `${target} is now ${nextStatus}.`, [{ kind: action, message: `${action === 'start' ? 'Starting' : 'Stopping'} ${target}` }], input);
}