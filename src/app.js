import { createInitialState, runCommand } from './simulator.js';

let state = createInitialState();
let busy = false;
let selectedImage = null;
let selectedContainer = null;
const commandInput = document.querySelector('#command');
const terminalLog = document.querySelector('#terminal-log');
const imageShelf = document.querySelector('#image-shelf');
const containerShelf = document.querySelector('#container-shelf');
const inspector = document.querySelector('#layer-inspector');
const stage = document.querySelector('#stage-message');
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
}

function appendTerminal(command, message, ok) {
  const line = element('div', 'log-item');
  if (command) line.append(element('div', 'command-line', `❯ ${command}`));
  line.append(element('pre', ok ? 'terminal-ok' : 'terminal-error', message));
  terminalLog.append(line);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

async function runInteractive(command) {
  if (busy) return;
  if (!command.trim()) { commandInput.focus(); return; }
  busy = true;
  runButton.disabled = true;
  buildButton.disabled = true;
  document.querySelectorAll('[data-command]').forEach(button => { button.disabled = true; });
  if (command.trim()) {
    recentCommands.push(command);
    historyIndex = recentCommands.length;
  }
  const result = runCommand(state, command, { dockerfile: editor.value });
  appendTerminal(command, result.message, result.ok);
  if (result.ok) {
    for (const step of result.steps) {
      stage.textContent = step.message;
      stage.dataset.state = 'busy';
      markJourney(step.kind);
      await wait(200);
    }
    state = result.state;
    if (command.startsWith('docker build -t ')) selectedImage = command.split(/\s+/)[3];
    if (command.startsWith('docker run ')) selectedContainer = result.state.containers.at(-1)?.id;
    render();
    stage.textContent = result.steps.length ? 'Simulation updated successfully.' : 'State unchanged.';
    stage.dataset.state = 'ready';
  } else {
    stage.textContent = 'Command rejected. Docker state was not changed.';
    stage.dataset.state = 'error';
  }
  busy = false;
  runButton.disabled = false;
  buildButton.disabled = false;
  document.querySelectorAll('[data-command]').forEach(button => { button.disabled = false; });
  renderRuntime();
  commandInput.focus();
}

document.querySelector('#command-form').addEventListener('submit', event => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = '';
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

document.querySelector('#reset-button').addEventListener('click', () => {
  if (busy) return;
  state = createInitialState();
  selectedImage = null;
  selectedContainer = null;
  journey.forEach((node, i) => node.classList.toggle('active', i === 0));
  terminalLog.replaceChildren();
  appendTerminal('', 'Environment reset. Try docker run ubuntu.', true);
  stage.textContent = 'Ready to simulate Docker commands.';
  stage.dataset.state = 'ready';
  render();
});

appendTerminal('', 'Welcome to DockerVisualiser V3. Type docker help to list commands.', true);
render();