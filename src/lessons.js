/** Guided missions advance only when the learner runs the expected successful command. */
export const LESSONS = Object.freeze([
  {
    id: "containers",
    title: "01 · Containers",
    subtitle: "From image to running instance",
    concept:
      "Images are reusable blueprints; containers are independent running instances. Stopping does not delete them.",
    steps: [
      {
        action: "pull",
        heading: "Find an image",
        text: "Pull nginx into the simulated image library.",
      },
      {
        action: "run",
        heading: "Create a container",
        text: "A container is created from an image and starts running.",
      },
      {
        action: "stop",
        heading: "Stop without deleting",
        text: "The container still exists after its process stops.",
      },
      {
        action: "start",
        heading: "Restart the same container",
        text: "The same container ID returns to the running state.",
      },
    ],
  },
  {
    id: "layers",
    title: "02 · Image layers",
    subtitle: "Build and explore the cache",
    concept:
      "Dockerfiles describe a sequence of build steps. Repeating an unchanged build can reuse existing simulated layers.",
    steps: [
      {
        action: "build",
        heading: "Build a tagged image",
        text: "Build iris-app using the editable Dockerfile below.",
      },
      {
        action: "rebuild",
        heading: "Reuse the cache",
        text: "Build the same Dockerfile again. Look for reused layers.",
      },
      {
        action: "history",
        heading: "Inspect its layers",
        text: "Read the ordered layer instructions with docker history.",
      },
    ],
  },
  {
    id: "filesystem",
    title: "03 · Files and processes",
    subtitle: "Explore a container from inside",
    concept:
      "Each container has its own writable files. Simulated exec creates short-lived processes without changing the image.",
    steps: [
      {
        action: "run",
        heading: "Start a fresh container",
        text: "Create a persistent nginx-profile container for your filesystem experiment.",
      },
      {
        action: "mkdir",
        heading: "Create a directory",
        text: "Create /tmp/work inside that container.",
      },
      {
        action: "touch",
        heading: "Add a file",
        text: "Create /tmp/work/notes.txt in the virtual filesystem.",
      },
      {
        action: "write",
        heading: "Write a message",
        text: "Store hello NITK with write, a simulator-only helper (not a real Linux command).",
      },
      {
        action: "cat",
        heading: "Read it back",
        text: "Check that the content is still there.",
      },
    ],
  },
  {
    id: "images-containers",
    title: "04 · Images vs containers",
    subtitle: "One image, two independent instances",
    concept:
      "One image can launch multiple independent containers. Stopping a container does not delete the image or stop another container.",
    steps: [
      {
        action: "pull-image",
        heading: "Download one image",
        text: "Pull nginx once into your simulated image library. This does not create any container.",
      },
      {
        action: "run-first",
        heading: "Start the first container",
        text: "Run nginx and watch the first container appear.",
      },
      {
        action: "run-second",
        heading: "Start another from the same image",
        text: "Run nginx again. A second independent container appears, but nginx is not downloaded again.",
      },
      {
        action: "stop-second",
        heading: "Stop only the second",
        text: "Stop your newest container. Check that the first is still running.",
      },
      {
        action: "list-all",
        heading: "Inspect both containers",
        text: "Use docker ps -a to see the stopped and running containers together.",
      },
      {
        action: "restart-second",
        heading: "Restart the stopped container",
        text: "Start that same container ID again, without creating a third container.",
      },
    ],
  },
]);

export function initialProgress() {
  return {
    active: "containers",
    tracks: Object.fromEntries(
      LESSONS.map((item) => [item.id, { index: 0, containerId: null }]),
    ),
  };
}

export function activeLesson(progress) {
  return LESSONS.find((item) => item.id === progress.active) || LESSONS[0];
}

export function suggestedCommand(progress) {
  const lesson = activeLesson(progress);
  const track = progress.tracks[lesson.id];
  if (track.index >= lesson.steps.length) return null;
  const action = lesson.steps[track.index].action;
  if (lesson.id === "containers") {
    if (action === "pull") return "docker pull nginx";
    if (action === "run") return "docker run nginx";
    return `docker ${action} ${track.containerId || "c001"}`;
  }
  if (lesson.id === "images-containers") {
    if (action === "pull-image") return "docker pull nginx";
    if (action === "run-first" || action === "run-second")
      return "docker run nginx";
    if (action === "stop-second")
      return `docker stop ${track.secondContainerId || "c002"}`;
    if (action === "list-all") return "docker ps -a";
    return `docker start ${track.secondContainerId || "c002"}`;
  }
  if (lesson.id === "layers") {
    if (action === "history") return "docker history iris-app";
    return "docker build -t iris-app .";
  }
  if (action === "run") return "docker run nginx";
  return `docker exec ${track.containerId || "c001"} ${
    {
      mkdir: "mkdir /tmp/work",
      touch: "touch /tmp/work/notes.txt",
      write: "write /tmp/work/notes.txt hello NITK",
      cat: "cat /tmp/work/notes.txt",
    }[action]
  }`;
}

export function observeCommand(progress, command, result) {
  const lesson = activeLesson(progress);
  const track = progress.tracks[lesson.id];
  if (!result.ok || track.index >= lesson.steps.length) return progress;
  const expected = suggestedCommand(progress);
  const normalize = (value) => value.trim().replace(/\s+/g, " ");
  if (normalize(command) !== normalize(expected)) return progress;
  if (
    lesson.id === "layers" &&
    track.index === 1 &&
    !/\b[1-9]\d* reused from cache\b/.test(result.message)
  )
    return progress;
  const created = /docker run /.test(command)
    ? result.state.containers.at(-1)
    : null;
  if (lesson.id === "images-containers") {
    const first = result.state.containers.find(
      (c) => c.id === track.firstContainerId,
    );
    const second = result.state.containers.find(
      (c) => c.id === track.secondContainerId,
    );
    if (
      track.index === 0 &&
      !result.state.images.some((i) => i.name === "nginx")
    )
      return progress;
    if (
      (track.index === 1 || track.index === 2) &&
      (!created || created.image !== "nginx" || created.status !== "running")
    )
      return progress;
    if (
      track.index === 2 &&
      (!first || first.id === created.id || first.status !== "running")
    )
      return progress;
    if (
      (track.index === 3 || track.index === 4) &&
      (!first ||
        !second ||
        first.status !== "running" ||
        second.status !== "stopped")
    )
      return progress;
    if (
      track.index === 4 &&
      (!result.message.includes(first.id) ||
        !result.message.includes(second.id))
    )
      return progress;
    if (
      track.index === 5 &&
      (!first ||
        !second ||
        first.status !== "running" ||
        second.status !== "running" ||
        result.state.containers.filter(
          (c) => c.image === "nginx" && [first.id, second.id].includes(c.id),
        ).length !== 2)
    )
      return progress;
  }
  const newTrack = {
    ...track,
    index: track.index + 1,
    containerId: created?.id ?? track.containerId,
  };
  if (lesson.id === "images-containers" && track.index === 1)
    newTrack.firstContainerId = created.id;
  if (lesson.id === "images-containers" && track.index === 2)
    newTrack.secondContainerId = created.id;
  return { ...progress, tracks: { ...progress.tracks, [lesson.id]: newTrack } };
}

export function chooseLesson(progress, id) {
  if (!LESSONS.some((lesson) => lesson.id === id)) return progress;
  return { ...progress, active: id };
}
