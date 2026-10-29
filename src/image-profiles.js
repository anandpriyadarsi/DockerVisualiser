/** Immutable declared synthetic image metadata; never downloaded manifests. */
const BASE_TOOLS = [
  "/bin/sh",
  "sh",
  "ls",
  "pwd",
  "cat",
  "touch",
  "mkdir",
  "rm",
  "sleep",
];
export function imageConfiguration(image) {
  if (image.runtimeConfig) return structuredClone(image.runtimeConfig);
  const family = (image.base || image.name).split(":")[0].split("/").at(-1);
  const defaults = {
    nginx: ["nginx", "-g", "daemon off;"],
    redis: ["redis-server"],
    httpd: ["httpd", "-DFOREGROUND"],
    "hello-world": ["/hello"],
    node: ["node"],
    python: ["python"],
    ubuntu: ["/bin/bash"],
    debian: ["/bin/bash"],
  };
  const executable = {
    nginx: "nginx",
    redis: "redis-server",
    httpd: "httpd",
    node: "node",
    python: "python",
    "hello-world": "/hello",
  }[family];
  return {
    family,
    defaultCommand: defaults[family] || ["/bin/sh"],
    executables:
      family === "hello-world"
        ? ["/hello"]
        : [
            ...BASE_TOOLS,
            ...(["ubuntu", "debian"].includes(family)
              ? ["/bin/bash", "bash"]
              : []),
            ...(executable ? [executable] : []),
          ],
  };
}
export function parseDefaultCommand(arg) {
  try {
    const value = JSON.parse(arg);
    if (
      Array.isArray(value) &&
      value.length &&
      value.every((x) => typeof x === "string")
    )
      return value;
  } catch {}
  return arg.trim().split(/\s+/);
}
export function profileFor(image, command = []) {
  const config = imageConfiguration(image),
    cmd = command.length ? command : config.defaultCommand,
    exe = cmd[0],
    name = cmd.join(" ");
  if (exe === "sleep")
    return {
      unsupported: true,
      message:
        "Finite sleep workloads are not yet simulated. Use the nginx foreground service for lifecycle practice; this model does not advance timed processes.",
    };
  if (!config.executables.includes(exe))
    return {
      running: false,
      name,
      exitCode: 127,
      logs: [
        `${exe}: executable not found in the selected synthetic image profile. No code was executed.`,
      ],
    };
  const service =
    (config.family === "nginx" &&
      exe === "nginx" &&
      cmd.includes("daemon off;")) ||
    (config.family === "redis" && exe === "redis-server") ||
    (config.family === "httpd" &&
      exe === "httpd" &&
      cmd.includes("-DFOREGROUND"));
  if (service)
    return {
      running: true,
      name:
        config.family === "nginx"
          ? "nginx: master process (" + name + ")"
          : name,
      exitCode: null,
      logs: [
        `${config.family}: synthetic foreground service started; no real server is listening.`,
      ],
    };
  if (exe === "/hello")
    return {
      running: false,
      name,
      exitCode: 0,
      logs: [
        "Hello from Docker! (simulated)",
        "The main process completed successfully.",
      ],
    };
  if (
    ["/bin/sh", "sh", "/bin/bash", "bash", "node", "python"].includes(exe) &&
    cmd.length === 1
  )
    return {
      running: false,
      name,
      exitCode: 0,
      logs: [
        "Noninteractive default process completed; -d does not keep it alive.",
      ],
    };
  return {
    unsupported: true,
    message:
      "This executable/argument combination is not yet simulated; application and shell execution are unavailable. Try the default nginx service or the guided diagnostic fixture.",
  };
}
