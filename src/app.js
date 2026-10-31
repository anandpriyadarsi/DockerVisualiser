import { createInitialState, runCommand } from './simulator.js';
import { LESSONS, initialProgress, activeLesson, suggestedCommand, observeCommand, chooseLesson } from './lessons.js';

let state = createInitialState();
let busy = false;
let selectedImage = null;
let selectedContainer = null;
let lessonProgress = initialProgress();
// Course deep links can select a supported mission without changing the simulator state.
// Example: ?lesson=images-containers (used by Docker Academy).
const requestedLesson = new URLSearchParams(window.location.search).get('lesson');
if (requestedLesson) lessonProgress = chooseLesson(lessonProgress, requestedLesson);
const commandInput = document.querySelector('#command');
const terminalLog = document.querySelector('#terminal-log');
const clearTerminalButton = document.querySelector('#clear-terminal');
const toggleTerminalButton = document.querySelector('#toggle-terminal');
const workbench = document.querySelector('.workbench');
const playgroundTabs = {
  images: document.querySelector('#images-tab'),
  containers: document.querySelector('#containers-tab'),
};
const playgroundViews = {
  images: document.querySelector('#images-view'),
  containers: document.querySelector('#containers-view'),
};
const imageShelf = document.querySelector('#image-shelf');
const containerShelf = document.querySelector('#container-shelf');
const inspector = document.querySelector('#layer-inspector');
const stage = document.querySelector('#stage-message');
const pullPanel = document.querySelector('#pull-visualizer');
const pullTarget = document.querySelector('#pull-target');
const pullStatus = document.querySelector('#pull-status');
const pullSteps = document.querySelector('#pull-steps');
const pullLayers = document.querySelector('#pull-layers');
const pullMeter = pullPanel.querySelector('[role="progressbar"]');
const pullMeterFill = document.querySelector('#pull-meter-fill');
const runButton = document.querySelector('#run-button');
const buildButton = document.querySelector('#build-button');
const editor = document.querySelector('#dockerfile-editor');
const imageTagInput = document.querySelector('#image-tag');
const journey = [...document.querySelectorAll('.journey-step')];
const containerSelect = document.querySelector('#container-select');
const filesystemTree = document.querySelector('#filesystem-tree');
const processList = document.querySelector('#process-list');
const recentCommands = [];
let historyIndex = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // No untrusted HTML.
  return node;
}

function markJourney(kind) {
  const index = ({ dockerfile: 0, pull: 1, layer: 1, build: 2, create: 3, start: 3, exec: 3, filesystem: 3, process: 3 })[kind];
  if (index === undefined) return;
  journey.forEach((node, i) => node.classList.toggle('active', i === index));
}

// All visual events are derived from the deterministic simulator result.
// No registry request, image download, shell command, or disk write occurs here.
function pullRow(message, kind = 'info') {
  const li = element('li', `pull-row ${kind}`);
  li.append(element('span', 'pull-icon', kind === 'error' ? '×' : kind === 'success' ? '✓' : '→'));
  li.append(element('span', '', message));
  pullSteps.append(li);
  pullSteps.scrollTop = pullSteps.scrollHeight;
}
function pullProgress(percent) {
  const value = Math.round(Math.max(0, Math.min(100, percent)));
  pullMeter.setAttribute('aria-valuenow', String(value));
  pullMeterFill.style.width = `${value}%`;
}
function beginPull(imageName, alreadyCached) {
  pullSteps.replaceChildren();
  pullLayers.replaceChildren();
  pullPanel.dataset.state = 'busy';
  pullStatus.textContent = alreadyCached ? 'LOCAL CACHE HIT' : 'LOOKING UP';
  pullTarget.textContent = `Image: ${imageName} · ${alreadyCached ? 'already cached on this simulated host' : 'checking the offline example registry'}`;
  pullProgress(0);
  pullRow(alreadyCached ? `Local image ${imageName} found; registry pull skipped.` : `Local image ${imageName} not found.`);
}
function showPullStep(step, index, count) {
  if (step.kind === 'pull') {
    pullStatus.textContent = 'FETCHING IMAGE';
    pullRow('Available in offline demo registry — starting simulated pull.');
  } else if (step.kind === 'layer') {
    const layer = element('div', 'pull-layer');
    layer.append(element('span', '', `LAYER ${pullLayers.children.length + 1}`),
      element('code', '', step.layerId || 'simulated'));
    pullLayers.append(layer);
    pullRow(step.message, 'success');
    pullStatus.textContent = `${pullLayers.children.length} LAYERS CACHED`;
  } else if (step.kind === 'lookup') {
    pullStatus.textContent = 'REGISTRY LOOKUP';
    pullRow(step.message);
  } else if (step.kind === 'missing') {
    pullStatus.textContent = 'IMAGE NOT FOUND';
    pullPanel.dataset.state = 'error';
    pullRow(step.message, 'error');
  } else if (step.kind === 'create' || step.kind === 'start') {
    pullRow(step.message, 'success');
    pullStatus.textContent = step.kind === 'start' ? 'CONTAINER STARTED' : 'CREATING CONTAINER';
  }
  pullProgress((index + 1) / count * 100);
}
function finishPull(ok) {
  pullPanel.dataset.state = ok ? 'complete' : 'error';
  if (ok) {
    pullStatus.textContent = 'COMPLETE';
    pullProgress(100);
  }
}
function resetPull() {
  pullPanel.dataset.state = 'idle';
  pullStatus.textContent = 'READY';
  pullTarget.textContent = 'Try docker run nginx to watch local lookup, simulated registry fetch and layer caching.';
  pullSteps.replaceChildren(element('li', '', 'Waiting for an image command'));
  pullLayers.replaceChildren();
  pullProgress(0);
}

// Do not leave a previous successful image-pull animation saying COMPLETE
// when a later invalid Docker command is rejected.
function showRejectedCommand(command, message) {
  pullPanel.dataset.state = 'error';
  pullStatus.textContent = 'COMMAND REJECTED';
  pullTarget.textContent = `Invalid command: ${command.trim()}`;
  pullSteps.replaceChildren();
  pullLayers.replaceChildren();
  pullProgress(0);
  pullRow(message, 'error');
}

function renderLayers() {
  inspector.replaceChildren();
  const image = state.images.find(i => i.name === selectedImage);
  if (!image) {
    inspector.append(element('p', 'empty-note', 'Select an image to inspect its ordered layers.'));
    return;
  }
  const heading = element('div', 'inspector-title');
  heading.append(element('strong', '', image.name), element('small', '', `${image.layers.length} simulated layers · ${image.source === 'build' ? 'Built from Dockerfile' : 'From registry'}`));
  inspector.append(heading);
  const stack = element('ol', 'layer-stack');
  image.layers.forEach((layer, i) => {
    const item = element('li', `layer-brick ${layer.kind}`);
    item.style.setProperty('--layer-index', String(i));
    item.append(element('span', 'layer-count', String(i + 1).padStart(2, '0')));
    const info = element('div', 'layer-text');
    info.append(element('strong', '', layer.instruction), element('small', '', layer.id));
    item.append(info);
    if (layer.cached) item.append(element('span', 'cache-label', 'CACHE'));
    stack.append(item);
  });
  inspector.append(stack);
  inspector.append(element('p', 'layer-footnote', 'Each rectangle is a simulated image layer; subsequent Dockerfile changes invalidate dependent layers.'));
}

function renderRuntime() {
  containerSelect.replaceChildren();
  if (!state.containers.some(c => c.id === selectedContainer)) selectedContainer = state.containers.at(-1)?.id || null;
  if (!state.containers.length) {
    const option = element('option', '', 'Run an image first'); option.value = '';
    containerSelect.append(option);
  }
  for (const container of state.containers) {
    const option = element('option', '', `${container.id} · ${container.image} · ${container.status}`);
    option.value = container.id;
    option.selected = container.id === selectedContainer;
    containerSelect.append(option);
  }
  const container = state.containers.find(c => c.id === selectedContainer);
  filesystemTree.replaceChildren(); processList.replaceChildren();
  document.querySelector('#file-count').textContent = `${container ? Object.keys(container.fs).length : 0} entries`;
  if (!container) {
    filesystemTree.append(element('p', 'empty-note', 'Run an image and select its container to explore.'));
    processList.append(element('p', 'empty-note', 'Waiting for a simulated container.'));
  } else {
    const entries = Object.entries(container.fs).sort(([a],[b]) => a.localeCompare(b));
    for (const [path, entry] of entries) {
      const item = element('div', `file-entry ${entry.type}`);
      item.append(element('span', 'entry-icon', entry.type === 'dir' ? '▣' : '▤'), element('span', 'entry-name', `${path}${entry.type === 'dir' && path !== '/' ? '/' : ''}`));
      if (entry.type === 'file') item.title = entry.content || '(empty file)';
      filesystemTree.append(item);
    }
    for (const proc of [...container.processes, ...(container.recentExec || []).slice(-6).reverse()]) {
      const item = element('div', `process-row ${proc.status}`);
      item.append(element('span', 'process-pid', `PID ${proc.pid}`), element('span', 'process-name', proc.name), element('span', 'process-status', proc.status));
      processList.append(item);
    }
  }
  document.querySelectorAll('[data-runtime]').forEach(button => {
    button.disabled = !container || container.status !== 'running' || busy;
  });
}

function render() {
  const running = state.containers.filter(c => c.status === 'running').length;
  document.querySelector('#image-count').textContent = state.images.length;
  document.querySelector('#container-count').textContent = state.containers.length;
  document.querySelector('#running-count').textContent = running;

  imageShelf.replaceChildren();
  if (!state.images.length) imageShelf.append(element('p', 'empty-note', 'No images yet. Try docker pull ubuntu.'));
  for (const image of state.images) {
    const card = element('button', `image-chip ${image.name === selectedImage ? 'selected' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(image.name === selectedImage));
    const names = element('span', 'image-chip-names');
    names.append(element('strong', '', image.name), element('small', '', `${image.layers.length} layers · ${image.source}`));
    card.append(element('span', 'image-icon', '▦'), names);
    card.addEventListener('click', () => {
      selectedImage = image.name;
      render();
    });
    imageShelf.append(card);
  }
  if (!state.images.some(i => i.name === selectedImage)) selectedImage = state.images.at(-1)?.name || null;
  renderLayers();

  containerShelf.replaceChildren();
  if (!state.containers.length) containerShelf.append(element('p', 'empty-note', 'Your first container will appear here.'));
  for (const container of state.containers) {
    const card = element('button', `container-card ${container.status} ${selectedContainer === container.id ? 'selected' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(selectedContainer === container.id));
    card.addEventListener('click', () => { selectedContainer = container.id; render(); });
    const art = element('div', 'cube-wrap');
    art.append(element('div', 'cube-top'), element('div', 'cube-front'), element('div', 'cube-side'));
    const info = element('div', 'container-info');
    info.append(element('strong', '', container.id), element('small', '', container.image));
    const status = element('span', 'status-dot', container.status);
    const count = element('span', 'container-layer-count', `${container.layers?.length ?? 0} layer snapshot`);
    card.append(art, info, status, count);
    containerShelf.append(card);
  }
  renderRuntime();
  renderLesson();
}

function renderLesson() {
  const lesson = activeLesson(lessonProgress);
  const track = lessonProgress.tracks[lesson.id];
  const finished = track.index === lesson.steps.length;
  document.querySelectorAll('[data-lesson]').forEach(tab => {
    const active = tab.dataset.lesson === lesson.id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelector('#lesson-detail').setAttribute('aria-labelledby', `lesson-tab-${lesson.id}`);
  document.querySelector('#lesson-step-label').textContent = finished ? 'MISSION COMPLETE' : `STEP ${track.index + 1} OF ${lesson.steps.length}`;
  document.querySelector('#lesson-step-title').textContent = finished ? 'Excellent work — mission complete!' : lesson.steps[track.index].heading;
  document.querySelector('#lesson-step-description').textContent = finished ? 'You performed every checkpoint in the simulator. Choose another lesson to continue.' : lesson.steps[track.index].text;
  document.querySelector('#lesson-concept').textContent = lesson.concept;
  const code = document.querySelector('#lesson-command');
  code.textContent = finished ? '✓ All checkpoints completed' : suggestedCommand(lessonProgress);
  const load = document.querySelector('#lesson-load');
  load.disabled = finished;
  load.textContent = finished ? 'Mission complete ✓' : 'Use this command ↗';
  document.querySelector('#lesson-progress-text').textContent = `${track.index} of ${lesson.steps.length} steps complete`;
  const meter = document.querySelector('#lesson-progressbar');
  meter.setAttribute('aria-valuemax', String(lesson.steps.length));
  meter.setAttribute('aria-valuenow', String(track.index));
  document.querySelector('#lesson-meter-fill').style.width = `${100 * track.index / lesson.steps.length}%`;
  const list = document.querySelector('#lesson-checkpoints');
  list.replaceChildren();
  lesson.steps.forEach((step, i) => {
    const item = element('li', `${i < track.index ? 'complete' : ''} ${i === track.index ? 'current' : ''}`);
    item.append(element('span', 'checkpoint-marker', i < track.index ? '✓' : String(i + 1)), element('span', '', step.heading));
    if (i === track.index) item.setAttribute('aria-current', 'step');
    list.append(item);
  });
}

// Clearing terminal output is a UI action, never a simulated Docker command.
function clearTerminal() {
  if (busy) return;
  terminalLog.replaceChildren();
  recentCommands.length = 0;
  historyIndex = 0;
  commandInput.value = '';
  appendTerminal('', 'Terminal cleared. Images and containers are unchanged.', true);
  commandInput.focus();
}

function setTerminalExpanded(expanded) {
  workbench.classList.toggle('terminal-expanded', expanded);
  document.body.classList.toggle('terminal-fullscreen-open', expanded);
  toggleTerminalButton.setAttribute('aria-pressed', String(expanded));
  toggleTerminalButton.setAttribute('aria-label', expanded ? 'Exit fullscreen terminal' : 'Expand terminal to fullscreen');
  toggleTerminalButton.textContent = expanded ? '↙ Exit fullscreen' : '⛶ Fullscreen';
}

function showPlaygroundView(view, focusTab = false) {
  for (const name of ['images', 'containers']) {
    const selected = name === view;
    playgroundTabs[name].setAttribute('aria-selected', String(selected));
    playgroundTabs[name].tabIndex = selected ? 0 : -1;
    playgroundViews[name].hidden = !selected;
  }
  if (focusTab) playgroundTabs[view].focus();
}

function appendTerminal(command, message, ok) {
  const line = element('div', 'log-item');
  if (command) line.append(element('div', 'command-line', `❯ ${command}`));
  line.append(element('pre', ok ? 'terminal-ok' : 'terminal-error', message));
  terminalLog.append(line);
  // Bound retained output without affecting the actual simulation state.
  while (terminalLog.childElementCount > 120) terminalLog.firstElementChild.remove();
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

async function runInteractive(command) {
  if (busy) return;
  if (!command.trim()) { commandInput.focus(); return; }
  busy = true;
  runButton.disabled = true;
  buildButton.disabled = true;
  clearTerminalButton.disabled = true;
  document.querySelectorAll('[data-command]').forEach(button => { button.disabled = true; });
  if (command.trim()) {
    recentCommands.push(command);
    historyIndex = recentCommands.length;
  }
  const result = runCommand(state, command, { dockerfile: editor.value });
  const parts = command.trim().split(/\s+/);
  const imageCommand = parts[0] === 'docker' && ['pull', 'run'].includes(parts[1]) && parts.length === 3;
  const missingRegistry = result.steps.some(step => step.kind === 'missing');
  const imageName = imageCommand ? parts[2] :
    missingRegistry ? result.steps[0].message.replace(/^Checking offline simulated registry for /, '') : null;
  const showJourney = !!imageName && (result.ok || missingRegistry);
  if (showJourney) {
    const cached = state.images.some(image => image.name === imageName);
    beginPull(imageName, cached);
    stage.textContent = cached ? 'Local image cache hit; no remote lookup required.' : `Looking up ${imageName} in the offline demonstration registry…`;
    stage.dataset.state = 'busy';
    await wait(420);
  }
  for (const [index, step] of result.steps.entries()) {
    stage.textContent = step.message;
    stage.dataset.state = 'busy';
    markJourney(step.kind);
    if (showJourney) showPullStep(step, index, result.steps.length);
    await wait(showJourney && step.kind === 'layer' ? 460 : showJourney ? 350 : 200);
  }
  if (showJourney) {
    finishPull(result.ok);
  } else if (!result.ok) {
    showRejectedCommand(command, result.message);
  } else {
    resetPull();
  }
  appendTerminal(command, result.message, result.ok);
  if (result.ok) {
    const previousLesson = activeLesson(lessonProgress);
    const previousIndex = lessonProgress.tracks[previousLesson.id].index;
    lessonProgress = observeCommand(lessonProgress, command, result);
    state = result.state;
    // Optional companion-course integration. No grades, identifiers, or private data are sent.
    // A course embedding this simulator must verify BOTH event.origin and event.source.
    const completedTrack = lessonProgress.tracks[previousLesson.id];
    if (window.parent !== window &&
        completedTrack.index === previousLesson.steps.length &&
        previousIndex < previousLesson.steps.length) {
      const completion = { type: 'docker-academy:mission-complete', version: 1,
        missionId: previousLesson.id };
      // Only public mission ID is shared; never send command history or filesystem data.
      window.parent.postMessage(completion, '*');
    }
    if (command.startsWith('docker build -t ')) selectedImage = command.split(/\s+/)[3];
    if (command.startsWith('docker run ')) selectedContainer = result.state.containers.at(-1)?.id;
    if (imageCommand && result.state.images.some(image => image.name === imageName)) selectedImage = imageName;
    render();
    stage.textContent = result.steps.length ? 'Simulation updated successfully.' : 'State unchanged.';
    stage.dataset.state = 'ready';
  } else {
    stage.textContent = result.message;
    stage.dataset.state = 'error';
  }
  busy = false;
  runButton.disabled = false;
  buildButton.disabled = false;
  clearTerminalButton.disabled = false;
  document.querySelectorAll('[data-command]').forEach(button => { button.disabled = false; });
  renderRuntime();
  commandInput.focus();
}

document.querySelector('#command-form').addEventListener('submit', event => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = '';
  if (/^(clear|cls)$/i.test(command.trim())) {
    clearTerminal();
    return;
  }
  void runInteractive(command);
});

buildButton.addEventListener('click', () => void runInteractive(`docker build -t ${imageTagInput.value.trim()} .`));

commandInput.addEventListener('keydown', event => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    commandInput.value = recentCommands[historyIndex] || '';
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(recentCommands.length, historyIndex + 1);
    commandInput.value = recentCommands[historyIndex] || '';
  }
});

document.querySelectorAll('[data-command]').forEach(button => {
  button.addEventListener('click', () => void runInteractive(button.dataset.command));
});

containerSelect.addEventListener('change', () => { selectedContainer = containerSelect.value; render(); });
document.querySelectorAll('[data-runtime]').forEach(button => button.addEventListener('click', () => {
  if (selectedContainer) void runInteractive(`docker exec ${selectedContainer} ${button.dataset.runtime}`);
}));

document.querySelectorAll('[data-lesson]').forEach(tab => tab.addEventListener('click', () => {
  lessonProgress = chooseLesson(lessonProgress, tab.dataset.lesson);
  renderLesson();
}));
document.querySelector('#lesson-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const ids = LESSONS.map(item => item.id);
  const previous = ids.indexOf(lessonProgress.active);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (previous + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
  lessonProgress = chooseLesson(lessonProgress, ids[next]);
  renderLesson();
  document.querySelector(`[data-lesson="${ids[next]}"]`).focus();
});
document.querySelector('#lesson-load').addEventListener('click', () => {
  const command = suggestedCommand(lessonProgress);
  if (!command) return;
  commandInput.value = command;
  document.querySelector('.terminal-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  commandInput.focus({ preventScroll: true });
});

clearTerminalButton.addEventListener('click', clearTerminal);
toggleTerminalButton.addEventListener('click', () => {
  setTerminalExpanded(!workbench.classList.contains('terminal-expanded'));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && workbench.classList.contains('terminal-expanded')) {
    setTerminalExpanded(false);
    toggleTerminalButton.focus();
  }
});
for (const name of ['images', 'containers']) {
  playgroundTabs[name].addEventListener('click', () => showPlaygroundView(name));
}
document.querySelector('.playground-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = playgroundTabs.images.getAttribute('aria-selected') === 'true' ? 0 : 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (current + 1) % 2;
  showPlaygroundView(next === 0 ? 'images' : 'containers', true);
});

document.querySelector('#reset-button').addEventListener('click', () => {
  if (busy) return;
  state = createInitialState();
  lessonProgress = requestedLesson ? chooseLesson(initialProgress(), requestedLesson) : initialProgress();
  selectedImage = null;
  selectedContainer = null;
  journey.forEach((node, i) => node.classList.toggle('active', i === 0));
  terminalLog.replaceChildren();
  appendTerminal('', 'Environment reset. Try docker run ubuntu.', true);
  resetPull();
  stage.textContent = 'Ready to simulate Docker commands.';
  stage.dataset.state = 'ready';
  render();
});

appendTerminal('', 'Welcome to DockerVisualiser V3. Type docker help to list commands.', true);
render();
