import { createInitialState, runCommand } from "./simulator.js";
import {
  LESSONS,
  initialProgress,
  activeLesson,
  suggestedCommand,
  observeCommand,
  chooseLesson,
} from "./lessons.js";

import { loadWorkspace, saveWorkspace, validateWorkspace } from "./storage.js";
import {
  EXERCISES,
  createExercise,
  observeExercise,
  answerDiagnosis,
} from "./exercises.js";
import { parseLaunch, returnUrl } from "./integration.js";
let storage;
try {
  storage = localStorage;
} catch {
  storage = {
    getItem() {
      throw Error("Storage is unavailable");
    },
    setItem() {
      throw Error("Storage is unavailable");
    },
  };
}
const loaded = loadWorkspace(storage);
let workspace = loaded.workspace;
let protectedStorage = !!loaded.protected;
const request = parseLaunch(window.location.search);
let exercise = request.exercise
  ? workspace.exerciseSessions[request.exercise] ||
    createExercise(request.exercise)
  : null;
let state = exercise ? exercise.state : workspace.sandbox;
let busy = false,
  selectedImage = null,
  selectedContainer = null;
let lessonProgress = workspace.missionProgress;
const requestedLesson = request.legacyLesson;
if (requestedLesson)
  lessonProgress = chooseLesson(lessonProgress, requestedLesson);
const commandInput = document.querySelector("#command");
const terminalLog = document.querySelector("#terminal-log");
const imageShelf = document.querySelector("#image-shelf");
const containerShelf = document.querySelector("#container-shelf");
const inspector = document.querySelector("#layer-inspector");
const stage = document.querySelector("#stage-message");
const pullPanel = document.querySelector("#pull-visualizer");
const pullTarget = document.querySelector("#pull-target");
const pullStatus = document.querySelector("#pull-status");
const pullSteps = document.querySelector("#pull-steps");
const pullLayers = document.querySelector("#pull-layers");
const pullMeter = pullPanel.querySelector('[role="progressbar"]');
const pullMeterFill = document.querySelector("#pull-meter-fill");
const runButton = document.querySelector("#run-button");
const buildButton = document.querySelector("#build-button");
const editor = document.querySelector("#dockerfile-editor");
const imageTagInput = document.querySelector("#image-tag");
const journey = [...document.querySelectorAll(".journey-step")];
const containerSelect = document.querySelector("#container-select");
const filesystemTree = document.querySelector("#filesystem-tree");
const processList = document.querySelector("#process-list");
const recentCommands = [...workspace.commandHistory];
let historyIndex = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // No untrusted HTML.
  return node;
}

function markJourney(kind) {
  const index = {
    dockerfile: 0,
    pull: 1,
    layer: 1,
    build: 2,
    create: 3,
    start: 3,
    exec: 3,
    filesystem: 3,
    process: 3,
  }[kind];
  if (index === undefined) return;
  journey.forEach((node, i) => node.classList.toggle("active", i === index));
}

// All visual events are derived from the deterministic simulator result.
// No registry request, image download, shell command, or disk write occurs here.
function pullRow(message, kind = "info") {
  const li = element("li", `pull-row ${kind}`);
  li.append(
    element(
      "span",
      "pull-icon",
      kind === "error" ? "×" : kind === "success" ? "✓" : "→",
    ),
  );
  li.append(element("span", "", message));
  pullSteps.append(li);
  pullSteps.scrollTop = pullSteps.scrollHeight;
}
function pullProgress(percent) {
  const value = Math.round(Math.max(0, Math.min(100, percent)));
  pullMeter.setAttribute("aria-valuenow", String(value));
  pullMeterFill.style.width = `${value}%`;
}
function beginPull(imageName, alreadyCached) {
  pullSteps.replaceChildren();
  pullLayers.replaceChildren();
  pullPanel.dataset.state = "busy";
  pullStatus.textContent = alreadyCached ? "LOCAL CACHE HIT" : "LOOKING UP";
  pullTarget.textContent = `Image: ${imageName} · ${alreadyCached ? "already cached on this simulated host" : "checking the offline example registry"}`;
  pullProgress(0);
  pullRow(
    alreadyCached
      ? `Local image ${imageName} found; registry pull skipped.`
      : `Local image ${imageName} not found.`,
  );
}
function showPullStep(step, index, count) {
  if (step.kind === "pull") {
    pullStatus.textContent = "FETCHING IMAGE";
    pullRow("Available in offline demo registry — starting simulated pull.");
  } else if (step.kind === "layer") {
    const layer = element("div", "pull-layer");
    layer.append(
      element("span", "", `LAYER ${pullLayers.children.length + 1}`),
      element("code", "", step.layerId || "simulated"),
    );
    pullLayers.append(layer);
    pullRow(step.message, "success");
    pullStatus.textContent = `${pullLayers.children.length} LAYERS CACHED`;
  } else if (step.kind === "lookup") {
    pullStatus.textContent = "REGISTRY LOOKUP";
    pullRow(step.message);
  } else if (step.kind === "missing") {
    pullStatus.textContent = "IMAGE NOT FOUND";
    pullPanel.dataset.state = "error";
    pullRow(step.message, "error");
  } else if (step.kind === "create" || step.kind === "start") {
    pullRow(step.message, "success");
    pullStatus.textContent =
      step.kind === "start" ? "CONTAINER STARTED" : "CREATING CONTAINER";
  }
  pullProgress(((index + 1) / count) * 100);
}
function finishPull(ok) {
  pullPanel.dataset.state = ok ? "complete" : "error";
  if (ok) {
    pullStatus.textContent = "COMPLETE";
    pullProgress(100);
  }
}
function resetPull() {
  pullPanel.dataset.state = "idle";
  pullStatus.textContent = "READY";
  pullTarget.textContent =
    "Try docker run nginx to watch local lookup, simulated registry fetch and layer caching.";
  pullSteps.replaceChildren(element("li", "", "Waiting for an image command"));
  pullLayers.replaceChildren();
  pullProgress(0);
}

// Do not leave a previous successful image-pull animation saying COMPLETE
// when a later invalid Docker command is rejected.
function showRejectedCommand(command, message) {
  pullPanel.dataset.state = "error";
  pullStatus.textContent = "COMMAND REJECTED";
  pullTarget.textContent = `Invalid command: ${command.trim()}`;
  pullSteps.replaceChildren();
  pullLayers.replaceChildren();
  pullProgress(0);
  pullRow(message, "error");
}

function renderLayers() {
  inspector.replaceChildren();
  const image = state.images.find((i) => i.name === selectedImage);
  if (!image) {
    inspector.append(
      element(
        "p",
        "empty-note",
        "Select an image to inspect its ordered layers.",
      ),
    );
    return;
  }
  const heading = element("div", "inspector-title");
  heading.append(
    element("strong", "", image.name),
    element(
      "small",
      "",
      `${image.layers.length} simulated layers · ${image.source === "build" ? "Built from Dockerfile" : "From registry"}`,
    ),
  );
  inspector.append(heading);
  const stack = element("ol", "layer-stack");
  image.layers.forEach((layer, i) => {
    const item = element("li", `layer-brick ${layer.kind}`);
    item.style.setProperty("--layer-index", String(i));
    item.append(element("span", "layer-count", String(i + 1).padStart(2, "0")));
    const info = element("div", "layer-text");
    info.append(
      element("strong", "", layer.instruction),
      element("small", "", layer.id),
    );
    item.append(info);
    if (layer.cached) item.append(element("span", "cache-label", "CACHE"));
    stack.append(item);
  });
  inspector.append(stack);
  inspector.append(
    element(
      "p",
      "layer-footnote",
      "Synthetic filesystem layers; CMD appears in history as metadata. COPY cache keys include synthetic file content. RUN instructions are never executed.",
    ),
  );
}

function renderRuntime() {
  containerSelect.replaceChildren();
  if (!state.containers.some((c) => c.id === selectedContainer))
    selectedContainer = state.containers.at(-1)?.id || null;
  if (!state.containers.length) {
    const option = element("option", "", "Run an image first");
    option.value = "";
    containerSelect.append(option);
  }
  for (const container of state.containers) {
    const option = element(
      "option",
      "",
      `${container.id} · ${container.image} · ${container.status}`,
    );
    option.value = container.id;
    option.selected = container.id === selectedContainer;
    containerSelect.append(option);
  }
  const container = state.containers.find((c) => c.id === selectedContainer);
  filesystemTree.replaceChildren();
  processList.replaceChildren();
  document.querySelector("#file-count").textContent =
    `${container ? Object.keys(container.fs).length : 0} entries`;
  if (!container) {
    filesystemTree.append(
      element(
        "p",
        "empty-note",
        "Run an image and select its container to explore.",
      ),
    );
    processList.append(
      element("p", "empty-note", "Waiting for a simulated container."),
    );
  } else {
    const entries = Object.entries(container.fs).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [path, entry] of entries) {
      const item = element("div", `file-entry ${entry.type}`);
      item.append(
        element("span", "entry-icon", entry.type === "dir" ? "▣" : "▤"),
        element(
          "span",
          "entry-name",
          `${path}${entry.type === "dir" && path !== "/" ? "/" : ""}`,
        ),
      );
      if (entry.type === "file") item.title = entry.content || "(empty file)";
      filesystemTree.append(item);
    }
    for (const proc of [
      ...container.processes,
      ...(container.recentExec || []).slice(-6).reverse(),
    ]) {
      const item = element("div", `process-row ${proc.status}`);
      item.append(
        element("span", "process-pid", `PID ${proc.pid}`),
        element("span", "process-name", proc.name),
        element("span", "process-status", proc.status),
      );
      processList.append(item);
    }
  }
  document.querySelectorAll("[data-runtime]").forEach((button) => {
    button.disabled = !container || container.status !== "running" || busy;
  });
}

function render() {
  const running = state.containers.filter((c) => c.status === "running").length;
  document.querySelector("#image-count").textContent = state.images.length;
  document.querySelector("#container-count").textContent =
    state.containers.length;
  document.querySelector("#running-count").textContent = running;

  imageShelf.replaceChildren();
  if (!state.images.length)
    imageShelf.append(
      element("p", "empty-note", "No images yet. Try docker pull ubuntu."),
    );
  for (const image of state.images) {
    const card = element(
      "button",
      `image-chip ${image.name === selectedImage ? "selected" : ""}`,
    );
    card.type = "button";
    card.setAttribute("aria-pressed", String(image.name === selectedImage));
    const names = element("span", "image-chip-names");
    names.append(
      element("strong", "", image.name),
      element("small", "", `${image.layers.length} layers · ${image.source}`),
    );
    card.append(element("span", "image-icon", "▦"), names);
    card.addEventListener("click", () => {
      selectedImage = image.name;
      render();
    });
    imageShelf.append(card);
  }
  if (!state.images.some((i) => i.name === selectedImage))
    selectedImage = state.images.at(-1)?.name || null;
  renderLayers();

  containerShelf.replaceChildren();
  if (!state.containers.length)
    containerShelf.append(
      element("p", "empty-note", "Your first container will appear here."),
    );
  for (const container of state.containers) {
    const card = element(
      "button",
      `container-card ${container.status} ${selectedContainer === container.id ? "selected" : ""}`,
    );
    card.type = "button";
    card.setAttribute(
      "aria-pressed",
      String(selectedContainer === container.id),
    );
    card.addEventListener("click", () => {
      selectedContainer = container.id;
      render();
    });
    const art = element("div", "cube-wrap");
    art.append(
      element("div", "cube-top"),
      element("div", "cube-front"),
      element("div", "cube-side"),
    );
    const info = element("div", "container-info");
    info.append(
      element("strong", "", container.name),
      element(
        "small",
        "",
        container.id + " · " + container.legacyId + " · " + container.image,
      ),
    );
    const status = element("span", "status-dot", container.status);
    const count = element(
      "span",
      "container-layer-count",
      `${container.layers?.length ?? 0} layer snapshot`,
    );
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
  document.querySelectorAll("[data-lesson]").forEach((tab) => {
    const active = tab.dataset.lesson === lesson.id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document
    .querySelector("#lesson-detail")
    .setAttribute("aria-labelledby", `lesson-tab-${lesson.id}`);
  document.querySelector("#lesson-step-label").textContent = finished
    ? "MISSION COMPLETE"
    : `STEP ${track.index + 1} OF ${lesson.steps.length}`;
  document.querySelector("#lesson-step-title").textContent = finished
    ? "Excellent work — mission complete!"
    : lesson.steps[track.index].heading;
  document.querySelector("#lesson-step-description").textContent = finished
    ? "You performed every checkpoint in the simulator. Choose another lesson to continue."
    : lesson.steps[track.index].text;
  document.querySelector("#lesson-concept").textContent = lesson.concept;
  const code = document.querySelector("#lesson-command");
  code.textContent = finished
    ? "✓ All checkpoints completed"
    : suggestedCommand(lessonProgress);
  const load = document.querySelector("#lesson-load");
  load.disabled = finished;
  load.textContent = finished ? "Mission complete ✓" : "Use this command ↗";
  document.querySelector("#lesson-progress-text").textContent =
    `${track.index} of ${lesson.steps.length} steps complete`;
  const meter = document.querySelector("#lesson-progressbar");
  meter.setAttribute("aria-valuemax", String(lesson.steps.length));
  meter.setAttribute("aria-valuenow", String(track.index));
  document.querySelector("#lesson-meter-fill").style.width =
    `${(100 * track.index) / lesson.steps.length}%`;
  const list = document.querySelector("#lesson-checkpoints");
  list.replaceChildren();
  lesson.steps.forEach((step, i) => {
    const item = element(
      "li",
      `${i < track.index ? "complete" : ""} ${i === track.index ? "current" : ""}`,
    );
    item.append(
      element(
        "span",
        "checkpoint-marker",
        i < track.index ? "✓" : String(i + 1),
      ),
      element("span", "", step.heading),
    );
    if (i === track.index) item.setAttribute("aria-current", "step");
    list.append(item);
  });
}

function appendTerminal(command, message, ok) {
  const line = element("div", "log-item");
  if (command) line.append(element("div", "command-line", `❯ ${command}`));
  line.append(element("pre", ok ? "terminal-ok" : "terminal-error", message));
  terminalLog.append(line);
  while (terminalLog.children.length > 100)
    terminalLog.firstElementChild.remove();
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

function persist() {
  if (exercise) {
    exercise = { ...exercise, state };
    workspace.exerciseSessions[exercise.id] = exercise;
  } else workspace.sandbox = state;
  workspace.missionProgress = lessonProgress;
  workspace.editorDraft = editor.value;
  workspace.commandHistory = recentCommands.slice(-100);
  const result = protectedStorage
    ? {
        saved: false,
        error:
          "Previous saved data needs recovery. Export this session before replacing it.",
      }
    : saveWorkspace(storage, workspace);
  const status = document.querySelector("#save-status");
  status.textContent = result.saved
    ? "Saved on this device"
    : "Not saved — export your session";
  status.title = result.error || "";
  return result;
}
function renderExercise() {
  const panel = document.querySelector("#academy-exercise");
  panel.hidden = !exercise && !request.error;
  panel.replaceChildren();
  if (request.error) {
    panel.append(
      element("h2", "", "Exercise link unavailable"),
      element("p", "", request.error),
    );
    const a = element("a", "", "Open Docker Academy");
    a.href = "https://dockeracademy.netlify.app/";
    panel.append(a);
    return;
  }
  if (!exercise) return;
  const e = EXERCISES[exercise.id];
  panel.append(
    element(
      "span",
      "panel-kicker",
      "DOCKER ACADEMY · PREPARED EXERCISE SCENARIO",
    ),
    element("h2", "", e.title),
    element("p", "", e.description),
  );
  panel.append(
    element(
      "p",
      "learning-note",
      "This scenario is separate from your sandbox. Prepared images: " +
        (exercise.fixtureSummary.images.join(", ") || "none") +
        ". Prepared containers: " +
        (exercise.fixtureSummary.containers
          .map((c) => c.name + " (" + c.status + ")")
          .join(", ") || "none") +
        ". No exercise command runs automatically.",
    ),
  );
  const code = element("code", "", e.solution[0]);
  const load = element("button", "", "Use first command");
  load.onclick = () => {
    commandInput.value = e.solution[0];
    commandInput.focus();
  };
  panel.append(code, load);
  const hint = element("details");
  hint.append(element("summary", "", "Hints"));
  e.hints.forEach((h) => hint.append(element("p", "", h)));
  panel.append(hint);
  if (exercise.id === "m01.debug-exit") {
    panel.append(
      element("p", "", "After reading logs and inspect, choose the cause:"),
    );
    for (const [value, text] of [
      [
        "missing-executable",
        "The configured executable is unavailable in this image.",
      ],
      ["detached", "Detached mode deletes the image."],
      ["port", "An unpublished port removes the container."],
    ]) {
      const button = element("button", "", text);
      button.onclick = () => {
        exercise = answerDiagnosis(exercise, value);
        persist();
        renderExercise();
      };
      panel.append(button);
    }
  }
  panel.append(
    element(
      "p",
      "",
      exercise.progress.complete
        ? "✓ Practice complete — simulator-reported progress"
        : "Practice in progress",
    ),
  );
  const back = element(
    "a",
    "return-link",
    "Return to lesson" + (exercise.progress.complete ? " with result" : ""),
  );
  back.href = returnUrl(request, exercise.progress.complete, location.origin);
  back.onclick = () => persist();
  panel.append(back);
  const sandbox = element("a", "return-link", "Open your preserved sandbox");
  sandbox.href = "./";
  sandbox.onclick = () => persist();
  panel.append(sandbox);
}
async function runInteractive(command) {
  if (busy) return;
  if (!command.trim()) {
    commandInput.focus();
    return;
  }
  busy = true;
  runButton.disabled = true;
  buildButton.disabled = true;
  document
    .querySelectorAll("[data-command]")
    .forEach((b) => (b.disabled = true));
  try {
    recentCommands.push(command);
    if (recentCommands.length > 100) recentCommands.shift();
    historyIndex = recentCommands.length;
    const before = state;
    let result = runCommand(state, command, { dockerfile: editor.value });
    if (
      result.confirmation &&
      confirm(
        result.message +
          " This affects only the current simulated workspace. Export first if needed.",
      )
    )
      result = runCommand(state, command, {
        dockerfile: editor.value,
        confirmed: true,
      });
    if (exercise) exercise = observeExercise(exercise, command, result, before);
    if (result.ok) {
      state = result.state;
      if (!exercise)
        lessonProgress = observeCommand(lessonProgress, command, result);
    }
    // Commit pure state before animation, so backgrounding cannot discard a successful command.
    persist();
    appendTerminal(command, result.message, result.ok);
    render();
    renderExercise();
    if (command.startsWith("docker build -t "))
      selectedImage = command.split(/\s+/)[3];
    if (command.startsWith("docker run "))
      selectedContainer = state.containers.at(-1)?.id;
    const imageName = state.images.at(-1)?.name;
    const showJourney = result.steps.some((st) =>
      ["pull", "create", "missing"].includes(st.kind),
    );
    if (showJourney)
      beginPull(
        imageName || "requested image",
        !result.steps.some((st) => st.kind === "pull"),
      );
    for (const [i, step] of result.steps.entries()) {
      stage.textContent = step.message;
      markJourney(step.kind);
      if (showJourney) showPullStep(step, i, result.steps.length);
      if (
        !document.querySelector("#skip-animation").checked &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        await wait(100);
    }
    if (showJourney) finishPull(result.ok);
    else if (!result.ok) showRejectedCommand(command, result.message);
    stage.textContent = result.ok
      ? "Simulation updated. " +
        (state.containers.at(-1)?.status === "stopped"
          ? "The newest container has exited; use logs or inspect."
          : "")
      : result.message;
    stage.dataset.state = result.ok ? "ready" : "error";
    render();
  } catch (error) {
    appendTerminal(
      "",
      "The view could not update: " +
        error.message +
        ". Your last saved state is retained.",
      false,
    );
  } finally {
    busy = false;
    runButton.disabled = false;
    buildButton.disabled = false;
    document
      .querySelectorAll("[data-command]")
      .forEach((b) => (b.disabled = false));
    renderRuntime();
    commandInput.focus({ preventScroll: true });
  }
}

document.querySelector("#command-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = "";
  void runInteractive(command);
});

buildButton.addEventListener(
  "click",
  () => void runInteractive(`docker build -t ${imageTagInput.value.trim()} .`),
);

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    commandInput.value = recentCommands[historyIndex] || "";
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(recentCommands.length, historyIndex + 1);
    commandInput.value = recentCommands[historyIndex] || "";
  }
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener(
    "click",
    () => void runInteractive(button.dataset.command),
  );
});

containerSelect.addEventListener("change", () => {
  selectedContainer = containerSelect.value;
  render();
});
document.querySelectorAll("[data-runtime]").forEach((button) =>
  button.addEventListener("click", () => {
    if (selectedContainer)
      void runInteractive(
        `docker exec ${selectedContainer} ${button.dataset.runtime}`,
      );
  }),
);

document.querySelectorAll("[data-lesson]").forEach((tab) =>
  tab.addEventListener("click", () => {
    lessonProgress = chooseLesson(lessonProgress, tab.dataset.lesson);
    persist();
    renderLesson();
  }),
);
document.querySelector("#lesson-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const ids = LESSONS.map((item) => item.id);
  const previous = ids.indexOf(lessonProgress.active);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? ids.length - 1
        : (previous + (event.key === "ArrowRight" ? 1 : -1) + ids.length) %
          ids.length;
  lessonProgress = chooseLesson(lessonProgress, ids[next]);
  persist();
  renderLesson();
  document.querySelector(`[data-lesson="${ids[next]}"]`).focus();
});
document.querySelector("#lesson-load").addEventListener("click", () => {
  const command = suggestedCommand(lessonProgress);
  if (!command) return;
  commandInput.value = command;
  document
    .querySelector(".terminal-panel")
    .scrollIntoView({ behavior: "smooth", block: "start" });
  commandInput.focus({ preventScroll: true });
});

document.querySelector("#reset-button").addEventListener("click", () => {
  if (
    busy ||
    !confirm(
      "Reset " +
        (exercise
          ? "this prepared exercise"
          : "the sandbox and mission progress") +
        "? Export first to keep a backup. Other exercise sessions are preserved.",
    )
  )
    return;
  if (exercise) {
    exercise = createExercise(exercise.id);
    state = exercise.state;
  } else state = createInitialState();
  if (!exercise)
    lessonProgress = requestedLesson
      ? chooseLesson(initialProgress(), requestedLesson)
      : initialProgress();
  protectedStorage = false;
  selectedImage = null;
  selectedContainer = null;
  journey.forEach((node, i) => node.classList.toggle("active", i === 0));
  terminalLog.replaceChildren();
  appendTerminal("", "Environment reset. Try docker run nginx.", true);
  resetPull();
  stage.textContent = "Ready to simulate Docker commands.";
  stage.dataset.state = "ready";
  persist();
  render();
  renderExercise();
});

appendTerminal(
  "",
  "Welcome to DockerVisualiser 2.0. Type docker help to list commands.",
  true,
);
render();

if (workspace.editorDraft !== null) editor.value = workspace.editorDraft;
for (const input of [editor, imageTagInput])
  input.addEventListener("input", persist);
document.querySelector("#export-state").onclick = () => {
  persist();
  const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "DockerVisualiser-workspace.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.querySelector("#import-state").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2500000) throw Error("Backup too large");
    const next = validateWorkspace(JSON.parse(await file.text()));
    if (
      !confirm(
        "Replace this simulator workspace with the selected backup? Export the current session first if needed.",
      )
    )
      return;
    workspace = next;
    protectedStorage = false;
    exercise = request.exercise
      ? workspace.exerciseSessions[request.exercise] ||
        createExercise(request.exercise)
      : null;
    state = exercise ? exercise.state : workspace.sandbox;
    lessonProgress = workspace.missionProgress;
    editor.value = workspace.editorDraft || "FROM nginx";
    recentCommands.splice(
      0,
      recentCommands.length,
      ...workspace.commandHistory,
    );
    persist();
    render();
    renderExercise();
  } catch (error) {
    alert("Backup not imported: " + error.message);
  } finally {
    e.target.value = "";
  }
};
if (loaded.error)
  document.querySelector("#save-status").textContent =
    "Not saved — " + loaded.error;
else persist();
renderExercise();
window.addEventListener("pagehide", persist);

window.addEventListener("before-app-update", (event) => {
  const result = persist();
  event.detail.saved = result.saved;
  if (!result.saved) event.preventDefault();
});
