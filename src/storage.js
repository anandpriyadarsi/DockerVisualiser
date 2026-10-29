import { createInitialState, CORE_VERSION } from "./simulator.js";
import { initialProgress, LESSONS } from "./lessons.js";
import { EXERCISES } from "./exercises.js";
export const KEY = "docker-visualiser-workspace-v1";
const obj = (x) => x && typeof x === "object" && !Array.isArray(x);
export function emptyWorkspace() {
  return {
    schemaVersion: 1,
    coreVersion: CORE_VERSION,
    sandbox: createInitialState(),
    exerciseSessions: {},
    missionProgress: initialProgress(),
    editorDraft: null,
    commandHistory: [],
  };
}
function safe(x, depth = 0) {
  if (depth > 35) throw Error("State nested too deeply");
  if (x && typeof x === "object")
    for (const k of Object.keys(x)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("Unsafe key");
      safe(x[k], depth + 1);
    }
}
export function validateState(s) {
  if (
    !obj(s) ||
    !Array.isArray(s.images) ||
    !Array.isArray(s.containers) ||
    !Array.isArray(s.history) ||
    s.images.length > 100 ||
    s.containers.length > 100 ||
    s.history.length > 100 ||
    !Number.isSafeInteger(s.nextId) ||
    s.nextId < 1
  )
    throw Error("Invalid simulation state");
  const ids = new Set(),
    tagsSeen = new Set();
  for (const i of s.images) {
    if (
      !obj(i) ||
      typeof i.id !== "string" ||
      ids.has(i.id) ||
      typeof i.name !== "string" ||
      !Array.isArray(i.layers) ||
      i.layers.length > 100
    )
      throw Error("Invalid image");
    ids.add(i.id);
    if (
      !Array.isArray(i.tags) ||
      !i.tags.every((t) => typeof t === "string" && t.length <= 150) ||
      new Set(i.tags).size !== i.tags.length
    )
      throw Error("Invalid image tags");
    for (const tag of i.tags) {
      if (tagsSeen.has(tag)) throw Error("Image tag has multiple owners");
      tagsSeen.add(tag);
    }
    if (
      i.runtimeConfig &&
      (!obj(i.runtimeConfig) ||
        typeof i.runtimeConfig.family !== "string" ||
        !Array.isArray(i.runtimeConfig.defaultCommand) ||
        !i.runtimeConfig.defaultCommand.length ||
        !i.runtimeConfig.defaultCommand.every((x) => typeof x === "string") ||
        !Array.isArray(i.runtimeConfig.executables) ||
        !i.runtimeConfig.executables.every((x) => typeof x === "string"))
    )
      throw Error("Invalid image process configuration");
    for (const l of i.layers)
      if (typeof l.id !== "string" || typeof l.instruction !== "string")
        throw Error("Invalid layer");
  }
  const cids = new Set(),
    names = new Set();
  for (const c of s.containers) {
    if (
      !obj(c) ||
      !ids.has(c.imageId) ||
      typeof c.id !== "string" ||
      cids.has(c.id) ||
      typeof c.name !== "string" ||
      names.has(c.name) ||
      !["running", "stopped"].includes(c.status) ||
      !obj(c.fs) ||
      Object.keys(c.fs).length > 120 ||
      !c.fs["/"] ||
      !Array.isArray(c.processes) ||
      !c.processes.length ||
      !Array.isArray(c.logs) ||
      c.logs.length > 100 ||
      !Array.isArray(c.layers) ||
      !Array.isArray(c.ports) ||
      !obj(c.profile) ||
      !Array.isArray(c.profile.logs) ||
      !Number.isSafeInteger(c.nextPid) ||
      !Number.isSafeInteger(c.starts)
    )
      throw Error("Invalid container");
    cids.add(c.id);
    names.add(c.name);
    for (const [p, f] of Object.entries(c.fs))
      if (
        !p.startsWith("/") ||
        !obj(f) ||
        !["dir", "file"].includes(f.type) ||
        (f.type === "file" && typeof f.content !== "string")
      )
        throw Error("Invalid virtual file");
    for (const p of c.ports)
      if (
        !Number.isInteger(p.host) ||
        p.host < 1 ||
        p.host > 65535 ||
        !Number.isInteger(p.container) ||
        p.container < 1 ||
        p.container > 65535
      )
        throw Error("Invalid port");
  }
  return s;
}
export function validateWorkspace(w) {
  if (
    !obj(w) ||
    w.schemaVersion !== 1 ||
    w.coreVersion !== CORE_VERSION ||
    JSON.stringify(w).length > 2500000
  )
    throw Error("Unsupported or oversized workspace");
  safe(w);
  validateState(w.sandbox);
  if (
    !obj(w.exerciseSessions) ||
    Object.keys(w.exerciseSessions).length > 30 ||
    !obj(w.missionProgress) ||
    !Array.isArray(w.commandHistory) ||
    w.commandHistory.length > 100 ||
    w.commandHistory.some((c) => typeof c !== "string" || c.length > 500) ||
    (w.editorDraft !== null &&
      (typeof w.editorDraft !== "string" || w.editorDraft.length > 6000))
  )
    throw Error("Invalid workspace");
  for (const l of LESSONS) {
    const p = w.missionProgress.tracks?.[l.id];
    if (
      !obj(p) ||
      !Number.isInteger(p.index) ||
      p.index < 0 ||
      p.index > l.steps.length
    )
      throw Error("Invalid mission progress");
  }
  if (!LESSONS.some((l) => l.id === w.missionProgress.active))
    throw Error("Unknown mission");
  for (const [id, e] of Object.entries(w.exerciseSessions)) {
    if (
      !EXERCISES[id] ||
      !obj(e) ||
      e.id !== id ||
      !obj(e.progress) ||
      typeof e.progress.complete !== "boolean" ||
      !Array.isArray(e.progress.evidence) ||
      e.progress.evidence.length > 10 ||
      !e.progress.evidence.every((x) =>
        ["logs", "inspect", "unsafe-rejected"].includes(x),
      ) ||
      !obj(e.fixtureSummary) ||
      !Array.isArray(e.fixtureSummary.images) ||
      !e.fixtureSummary.images.every((x) => typeof x === "string") ||
      !Array.isArray(e.fixtureSummary.containers) ||
      !e.fixtureSummary.containers.every(
        (c) =>
          obj(c) &&
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          ["running", "stopped"].includes(c.status),
      )
    )
      throw Error("Invalid exercise session");
    if (
      e.progress.diagnosis !== undefined &&
      !["missing-executable", "detached", "port"].includes(e.progress.diagnosis)
    )
      throw Error("Invalid exercise diagnosis");
    validateState(e.state);
  }
  return w;
}
export function saveWorkspace(storage, w) {
  try {
    const raw = JSON.stringify(validateWorkspace(w));
    storage.setItem(KEY, raw);
    if (storage.getItem(KEY) !== raw) throw Error("Save verification failed");
    return { saved: true };
  } catch (e) {
    return { saved: false, error: e.message };
  }
}
export function loadWorkspace(storage) {
  try {
    const raw = storage.getItem(KEY);
    return {
      workspace: raw ? validateWorkspace(JSON.parse(raw)) : emptyWorkspace(),
      saved: true,
    };
  } catch (e) {
    return {
      workspace: emptyWorkspace(),
      saved: false,
      error: e.message,
      protected: true,
    };
  }
}
