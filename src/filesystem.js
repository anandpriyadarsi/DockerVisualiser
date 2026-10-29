/**
 * Version 3 virtual filesystem/process model.
 * Educational, in-memory only: never touches the host filesystem or executes a process.
 * File entries are plain JSON data and every operation returns fresh data on success.
 */
const MAX_ENTRIES = 120;
const MAX_CONTENT = 160;
const DEFAULT_DIRS = ["/", "/bin", "/etc", "/home", "/tmp"];

function validPath(path) {
  return (
    typeof path === "string" &&
    path.length <= 110 &&
    /^\/[a-zA-Z0-9._/-]*$/.test(path) &&
    !path.includes("//") &&
    !path.split("/").some((part) => part === "." || part === "..")
  );
}
function clean(path) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
function parentOf(path) {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}
function addDir(fs, path, recursive = false) {
  path = clean(path);
  if (!validPath(path)) return false;
  if (fs[path]) return fs[path].type === "dir";
  const parent = parentOf(path);
  if (!fs[parent] && recursive && !addDir(fs, parent, true)) return false;
  if (
    !fs[parent] ||
    fs[parent].type !== "dir" ||
    Object.keys(fs).length >= MAX_ENTRIES
  )
    return false;
  fs[path] = { type: "dir" };
  return true;
}
function initialProcess(image) {
  const cmdLayer = [...(image.history || image.layers)]
    .reverse()
    .find((layer) => layer.instruction.startsWith("CMD "));
  return {
    pid: 1,
    name: cmdLayer ? cmdLayer.instruction.slice(4) : "/bin/sh (simulated)",
    status: "running",
  };
}
export function createContainerRuntime(image) {
  const fs = { "/": { type: "dir" } };
  DEFAULT_DIRS.slice(1).forEach((dir) => addDir(fs, dir));
  let cwd = "/";
  for (const layer of image.layers) {
    if (layer.instruction.startsWith("WORKDIR ")) {
      const dest = clean(layer.instruction.slice(8));
      if (addDir(fs, dest, true)) cwd = dest;
    }
    if (layer.instruction.startsWith("COPY ")) {
      const parts = layer.instruction.slice(5).trim().split(/\s+/);
      if (parts.length !== 2) continue;
      let dest = parts[1];
      if (dest.endsWith("/")) dest += parts[0].split("/").at(-1);
      else if (!dest.startsWith("/"))
        dest = `${cwd === "/" ? "" : cwd}/${dest}`;
      if (
        validPath(dest) &&
        addDir(fs, parentOf(dest), true) &&
        Object.keys(fs).length < MAX_ENTRIES
      ) {
        fs[clean(dest)] = {
          type: "file",
          content: layer.content ?? `[Simulated COPY from ${parts[0]}]`,
        };
      }
    }
  }
  return {
    fs,
    cwd,
    processes: [initialProcess(image)],
    recentExec: [],
    nextPid: 2,
  };
}
function list(fs, path) {
  if (!fs[path]) return null;
  if (fs[path].type === "file") return path.split("/").at(-1);
  const children = Object.keys(fs)
    .filter((key) => key !== path && parentOf(key) === path)
    .sort();
  return (
    children
      .map(
        (key) =>
          `${fs[key].type === "dir" ? "📁" : "📄"} ${key.slice(path === "/" ? 1 : path.length + 1)}${fs[key].type === "dir" ? "/" : ""}`,
      )
      .join("\n") || "(empty directory)"
  );
}
export function executeVirtualCommand(container, subcommand) {
  if (
    typeof subcommand !== "string" ||
    !subcommand.trim() ||
    subcommand.length > 240
  )
    return {
      error:
        "Usage: docker exec <running-id> <command>. Try docker exec c001 ls /tmp.",
    };
  const words = subcommand.trim().split(/\s+/);
  const [op, arg] = words;
  const supported =
    "pwd, ls [path], ps, cat <file>, mkdir <path>, touch <file>, write <file> <text>, rm <file>";
  const fs = structuredClone(container.fs);
  const cwd = container.cwd || "/";
  const onePath = ["cat", "mkdir", "touch", "rm"].includes(op);
  const optionalPath = op === "ls";
  if (!["pwd", "ls", "ps", "cat", "mkdir", "touch", "write", "rm"].includes(op))
    return {
      error: `Unsupported simulated exec command. Supported: ${supported}. Never runs a shell.`,
    };
  if (
    (["pwd", "ps"].includes(op) && words.length !== 1) ||
    (onePath && words.length !== 2) ||
    (optionalPath && words.length > 2) ||
    (op === "write" && words.length < 3)
  ) {
    return { error: `Incorrect arguments for ${op}. Supported: ${supported}.` };
  }
  const path = arg || cwd;
  if (!["pwd", "ps"].includes(op) && !validPath(path))
    return {
      error:
        "Use an absolute path without .., repeated slashes or special characters. Example: /tmp/notes.txt",
    };
  const p = clean(path);
  let message;
  let changed = false;
  if (op === "pwd") message = cwd;
  if (op === "ps")
    message =
      container.processes
        .filter((pr) => pr.status === "running")
        .map((pr) => `${pr.pid}  ${pr.name}`)
        .join("\n") || "No running processes.";
  if (op === "ls") {
    message = list(fs, p);
    if (message === null)
      return { error: `Cannot list ${p}: path does not exist.` };
  }
  if (op === "cat") {
    if (!fs[p] || fs[p].type !== "file")
      return { error: `Cannot read ${p}: file does not exist.` };
    message = fs[p].content || "(empty file)";
  }
  if (op === "mkdir") {
    if (fs[p]) return { error: `${p} already exists.` };
    if (!fs[parentOf(p)] || fs[parentOf(p)].type !== "dir")
      return { error: `Parent directory ${parentOf(p)} does not exist.` };
    if (!addDir(fs, p))
      return { error: "Virtual filesystem limit reached (120 entries)." };
    message = `Created directory ${p}`;
    changed = true;
  }
  if (op === "touch" || op === "write") {
    if (!fs[parentOf(p)] || fs[parentOf(p)].type !== "dir")
      return { error: `Parent directory ${parentOf(p)} does not exist.` };
    if (fs[p]?.type === "dir") return { error: `${p} is a directory.` };
    if (!fs[p] && Object.keys(fs).length >= MAX_ENTRIES)
      return { error: "Virtual filesystem limit reached (120 entries)." };
    const content =
      op === "write" ? words.slice(2).join(" ") : (fs[p]?.content ?? "");
    if (content.length > MAX_CONTENT)
      return { error: "Simulated file content exceeds 160 characters." };
    fs[p] = { type: "file", content };
    message = `${op === "write" ? "Wrote" : "Touched"} ${p}`;
    changed = true;
  }
  if (op === "rm") {
    if (!fs[p] || fs[p].type !== "file")
      return {
        error: `Cannot remove ${p}: no such file (rm only supports files).`,
      };
    delete fs[p];
    message = `Removed ${p}`;
    changed = true;
  }
  const pid = container.nextPid;
  const recentExec = [
    ...(container.recentExec || []),
    { pid, name: subcommand.trim(), status: "exited" },
  ].slice(-12);
  return {
    message,
    changed,
    runtime: {
      fs,
      cwd,
      processes: container.processes.map((pr) => ({ ...pr })),
      recentExec,
      nextPid: pid + 1,
    },
    steps: [
      {
        kind: "exec",
        message: `Spawn simulated PID ${pid}: ${subcommand.trim()}`,
      },
      {
        kind: changed ? "filesystem" : "process",
        message: `${changed ? "Updating virtual filesystem" : "Reading simulated state"} for ${container.id}`,
      },
    ],
  };
}
