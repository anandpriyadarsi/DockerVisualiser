/** Guided missions advance only when the learner runs the expected successful command. */
export const LESSONS = Object.freeze([
  {
    id: 'containers', title: '01 · Containers', subtitle: 'From image to running instance',
    concept: 'Images are reusable blueprints; containers are independent running instances. Stopping does not delete them.',
    steps: [
      { action: 'pull', heading: 'Find an image', text: 'Pull Alpine into the simulated image library.' },
      { action: 'run', heading: 'Create a container', text: 'A container is created from an image and starts running.' },
      { action: 'stop', heading: 'Stop without deleting', text: 'The container still exists after its process stops.' },
      { action: 'start', heading: 'Restart the same container', text: 'The same container ID returns to the running state.' }
    ]
  },
  {
    id: 'layers', title: '02 · Image layers', subtitle: 'Build and explore the cache',
    concept: 'Dockerfiles describe a sequence of build steps. Repeating an unchanged build can reuse existing simulated layers.',
    steps: [
      { action: 'build', heading: 'Build a tagged image', text: 'Build iris-app using the editable Dockerfile below.' },
      { action: 'rebuild', heading: 'Reuse the cache', text: 'Build the same Dockerfile again. Look for reused layers.' },
      { action: 'history', heading: 'Inspect its layers', text: 'Read the ordered layer instructions with docker history.' }
    ]
  },
  {
    id: 'filesystem', title: '03 · Files and processes', subtitle: 'Explore a container from inside',
    concept: 'Each container has its own writable files. Simulated exec creates short-lived processes without changing the image.',
    steps: [
      { action: 'run', heading: 'Start a fresh container', text: 'Create an Ubuntu container for your filesystem experiment.' },
      { action: 'mkdir', heading: 'Create a directory', text: 'Create /tmp/work inside that container.' },
      { action: 'touch', heading: 'Add a file', text: 'Create /tmp/work/notes.txt in the virtual filesystem.' },
      { action: 'write', heading: 'Write a message', text: 'Store hello NITK inside the new file.' },
      { action: 'cat', heading: 'Read it back', text: 'Check that the content is still there.' }
    ]
  }
]);

export function initialProgress() {
  return { active: 'containers', tracks: Object.fromEntries(LESSONS.map(item => [item.id, { index: 0, containerId: null }])) };
}

export function activeLesson(progress) {
  return LESSONS.find(item => item.id === progress.active) || LESSONS[0];
}

export function suggestedCommand(progress) {
  const lesson = activeLesson(progress);
  const track = progress.tracks[lesson.id];
  if (track.index >= lesson.steps.length) return null;
  const action = lesson.steps[track.index].action;
  if (lesson.id === 'containers') {
    if (action === 'pull') return 'docker pull alpine';
    if (action === 'run') return 'docker run alpine';
    return `docker ${action} ${track.containerId || 'c001'}`;
  }
  if (lesson.id === 'layers') {
    if (action === 'history') return 'docker history iris-app';
    return 'docker build -t iris-app .';
  }
  if (action === 'run') return 'docker run ubuntu';
  return `docker exec ${track.containerId || 'c001'} ${{
    mkdir: 'mkdir /tmp/work', touch: 'touch /tmp/work/notes.txt',
    write: 'write /tmp/work/notes.txt hello NITK', cat: 'cat /tmp/work/notes.txt'
  }[action]}`;
}

export function observeCommand(progress, command, result) {
  const lesson = activeLesson(progress);
  const track = progress.tracks[lesson.id];
  if (!result.ok || track.index >= lesson.steps.length) return progress;
  const expected = suggestedCommand(progress);
  const normalize = value => value.trim().replace(/\s+/g, ' ');
  if (normalize(command) !== normalize(expected)) return progress;
  if (lesson.id === 'layers' && track.index === 1 && !/\b[1-9]\d* reused from cache\b/.test(result.message)) return progress;
  const created = /docker run /.test(command) ? result.state.containers.at(-1) : null;
  const newTrack = { index: track.index + 1, containerId: created?.id ?? track.containerId };
  return { ...progress, tracks: { ...progress.tracks, [lesson.id]: newTrack } };
}

export function chooseLesson(progress, id) {
  if (!LESSONS.some(lesson => lesson.id === id)) return progress;
  return { ...progress, active: id };
}
