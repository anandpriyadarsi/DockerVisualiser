/** Strict teaching subset. Tokenization is data-only and never evaluates a shell. */
export function tokenize(raw) {
  if (typeof raw !== "string" || raw.length > 500)
    throw Error("Enter a command of at most 500 characters.");
  if (/[;|&`$<>\n\r\\]/.test(raw))
    throw Error(
      "Shell operators, substitutions and redirection are not simulated. Run one Docker command at a time.",
    );
  const words = [];
  let word = "",
    quote = null,
    started = false;
  for (const ch of raw.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
      started = true;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) {
        words.push(word);
        word = "";
        started = false;
      }
    } else {
      word += ch;
      started = true;
    }
  }
  if (quote) throw Error("Unclosed quote.");
  if (started) words.push(word);
  if (words[0] !== "docker")
    throw Error(
      "Only simulated docker commands are supported. Try docker help",
    );
  return words;
}
const aliases = {
  container: {
    ls: "ps",
    list: "ps",
    run: "run",
    stop: "stop",
    start: "start",
    rm: "rm",
    remove: "rm",
    exec: "exec",
    logs: "logs",
    inspect: "inspect",
    prune: "container-prune",
  },
  image: {
    ls: "images",
    list: "images",
    pull: "pull",
    rm: "rmi",
    remove: "rmi",
    inspect: "image-inspect",
    history: "history",
    prune: "image-prune",
  },
};
export function parseCommand(raw) {
  const words = tokenize(raw);
  let action = words[1],
    args = words.slice(2);
  if (action in aliases) {
    const a = aliases[action][args[0]];
    if (!a)
      throw Error(
        `Real Docker command; not yet simulated: docker ${action} ${args[0] || ""}. Try docker help`,
      );
    action = a;
    args = args.slice(1);
  }
  if (action === "--help") action = "help";
  return { action, args, raw: raw.trim() };
}
export function parseRun(args) {
  const out = {
    detached: false,
    name: null,
    ports: [],
    image: null,
    command: [],
  };
  let i = 0;
  for (; i < args.length; i++) {
    let a = args[i];
    if (!a.startsWith("-")) {
      out.image = a;
      out.command = args.slice(i + 1);
      break;
    }
    if (a === "-d" || a === "--detach") {
      out.detached = true;
      continue;
    }
    const eq = a.indexOf("=");
    const flag = eq < 0 ? a : a.slice(0, eq);
    const value = eq < 0 ? args[++i] : a.slice(eq + 1);
    if (!["--name", "-p", "--publish"].includes(flag))
      throw Error(
        `Option ${flag} is not yet simulated. Supported run options: -d, --name, -p.`,
      );
    if (!value || value.startsWith("-"))
      throw Error(`Missing value for ${flag}.`);
    if (flag === "--name") {
      if (out.name) throw Error("Only one --name is allowed.");
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value))
        throw Error("Use a simple container name (up to 64 characters).");
      out.name = value;
    } else {
      const m = /^(\d{1,5}):(\d{1,5})$/.exec(value);
      if (!m || m.slice(1).some((v) => +v < 1 || +v > 65535))
        throw Error("Use -p HOST_PORT:CONTAINER_PORT, ports 1–65535.");
      if (out.ports.some((p) => p.host === +m[1]))
        throw Error("Duplicate host port.");
      out.ports.push({ host: +m[1], container: +m[2], protocol: "tcp" });
    }
  }
  if (!out.image)
    throw Error(
      "Usage: docker run [-d] [--name NAME] [-p HOST:CONTAINER] IMAGE [sleep SECONDS | COMMAND]",
    );
  return out;
}
