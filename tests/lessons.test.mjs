import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, runCommand } from '../src/simulator.js';
import { LESSONS, initialProgress, chooseLesson, activeLesson, suggestedCommand, observeCommand } from '../src/lessons.js';
const DOCKERFILE = 'FROM ubuntu\nWORKDIR /app\nCOPY app.js /app/\nRUN echo ready\nCMD ["node", "app.js"]';
function execute(progress, state, command = suggestedCommand(progress)) {
  const result = runCommand(state, command, { dockerfile: DOCKERFILE });
  return { progress: observeCommand(progress, command, result), state: result.state, result };
}
test('missions expose four tracks with correct ordered actions', () => {
  assert.deepEqual(LESSONS.map(l => l.id), ['containers', 'layers', 'filesystem', 'images-containers']);
  assert.deepEqual(LESSONS.map(l => l.steps.length), [4, 3, 5, 6]);
});
test('container lesson uses successful commands and actual allocated ID', () => {
  let progress = initialProgress(), state = createInitialState();
  for (let i = 0; i < 4; i++) {
    const next = execute(progress, state);
    assert.equal(next.result.ok, true);
    progress = next.progress; state = next.state;
    assert.equal(progress.tracks.containers.index, i + 1);
  }
  assert.equal(progress.tracks.containers.containerId, 'c001');
  assert.equal(state.containers[0].status, 'running');
  assert.equal(suggestedCommand(progress), null);
});
test('wrong or failed commands cannot advance a mission', () => {
  const progress = initialProgress(), state = createInitialState();
  const wrong = execute(progress, state, 'docker run ubuntu');
  assert.equal(wrong.result.ok, true);
  assert.deepEqual(wrong.progress, progress);
  const bad = execute(progress, state, 'docker pull fake@image');
  assert.equal(bad.result.ok, false);
  assert.deepEqual(bad.progress, progress);
});
test('image lesson requires a genuinely cached rebuild', () => {
  let progress = chooseLesson(initialProgress(), 'layers');
  let state = createInitialState();
  for (let i = 0; i < 3; i++) {
    const next = execute(progress, state);
    assert.equal(next.result.ok, true, next.result.message);
    progress = next.progress; state = next.state;
  }
  assert.equal(progress.tracks.layers.index, 3);
  assert.equal(suggestedCommand(progress), null);
});
test('filesystem lesson creates real virtual files, then verifies their contents', () => {
  let progress = chooseLesson(initialProgress(), 'filesystem');
  let state = createInitialState();
  for (let i = 0; i < 5; i++) {
    const next = execute(progress, state);
    assert.equal(next.result.ok, true, next.result.message);
    progress = next.progress; state = next.state;
    assert.equal(progress.tracks.filesystem.index, i + 1);
  }
  assert.equal(state.containers[0].fs['/tmp/work/notes.txt'].content, 'hello NITK');
});
test('switching lessons preserves progress and reset gives a clean state', () => {
  const progress = execute(initialProgress(), createInitialState()).progress;
  assert.equal(progress.tracks.containers.index, 1);
  const switched = chooseLesson(progress, 'layers');
  assert.equal(activeLesson(switched).id, 'layers');
  assert.equal(chooseLesson(switched, 'containers').tracks.containers.index, 1);
  assert.equal(initialProgress().tracks.containers.index, 0);
  assert.equal(chooseLesson(switched, 'invalid'), switched);
});

test('images versus containers mission proves two independent containers share one image', () => {
  let progress = chooseLesson(initialProgress(), 'images-containers');
  let state = createInitialState();
  assert.equal(activeLesson(progress).id, 'images-containers');
  for (let i = 0; i < 6; i++) {
    const next = execute(progress, state);
    assert.equal(next.result.ok, true, next.result.message);
    progress = next.progress; state = next.state;
    assert.equal(progress.tracks['images-containers'].index, i + 1);
    if (i === 0) { assert.equal(state.images.length, 1); assert.equal(state.containers.length, 0); }
    if (i === 2) { assert.equal(state.images.length, 1); assert.equal(state.containers.length, 2); }
    if (i === 3 || i === 4) {
      assert.equal(state.containers[0].status, 'running');
      assert.equal(state.containers[1].status, 'stopped');
    }
  }
  assert.deepEqual(state.containers.map(c => c.image), ['nginx', 'nginx']);
  assert.deepEqual(state.containers.map(c => c.status), ['running', 'running']);
  assert.equal(suggestedCommand(progress), null);
});
test('images versus containers mission requires successful commands in the right order', () => {
  let progress = chooseLesson(initialProgress(), 'images-containers');
  let state = createInitialState();
  const early = execute(progress, state, 'docker run nginx');
  assert.equal(early.result.ok, true);
  assert.equal(early.progress.tracks['images-containers'].index, 0);
  const pulled = execute(progress, state);
  progress = pulled.progress;
  state = pulled.state;
  assert.equal(progress.tracks['images-containers'].index, 1);
  const invalid = execute(progress, state, 'docker stop c999');
  assert.equal(invalid.result.ok, false);
  assert.equal(invalid.progress.tracks['images-containers'].index, 1);
});
