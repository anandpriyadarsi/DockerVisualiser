import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, runCommand } from '../src/simulator.js';

function apply(state, command) {
  const result = runCommand(state, command);
  assert.equal(result.ok, true, `${command}: ${result.message}`);
  return result.state;
}

test('docker run auto-pulls an absent image and starts a container', () => {
  const result = runCommand(createInitialState(), 'docker run ubuntu');
  assert.equal(result.ok, true);
  assert.deepEqual(result.steps.map(s => s.kind), ['pull', 'layer', 'layer', 'layer', 'create', 'start']);
  assert.equal(result.state.images[0].name, 'ubuntu');
  assert.equal(result.state.containers[0].status, 'running');
  assert.equal(result.state.containers[0].id, 'c001');
});

test('subsequent runs reuse the downloaded image and receive unique IDs', () => {
  let state = apply(createInitialState(), 'docker run ubuntu');
  const next = runCommand(state, 'docker run ubuntu');
  assert.deepEqual(next.steps.map(s => s.kind), ['create', 'start']);
  assert.equal(next.state.images.length, 1);
  assert.deepEqual(next.state.containers.map(c => c.id), ['c001', 'c002']);
});

test('start stop remove lifecycle is consistent', () => {
  let state = apply(createInitialState(), 'docker run ubuntu');
  state = apply(state, 'docker stop c001');
  assert.equal(state.containers[0].status, 'stopped');
  state = apply(state, 'docker start c001');
  assert.equal(state.containers[0].status, 'running');
  state = apply(state, 'docker stop c001');
  state = apply(state, 'docker rm c001');
  assert.equal(state.containers.length, 0);
  assert.equal(state.images.length, 1);
});

test('cannot remove a running container or restart a removed container', () => {
  let state = apply(createInitialState(), 'docker run ubuntu');
  let result = runCommand(state, 'docker rm c001');
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, state);
  state = apply(state, 'docker stop c001');
  state = apply(state, 'docker rm c001');
  result = runCommand(state, 'docker start c001');
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, state);
});

test('errors are atomic and leave the original state unchanged', () => {
  const state = apply(createInitialState(), 'docker run alpine');
  const original = JSON.stringify(state);
  for (const command of ['docker stop c999', 'docker start c001', 'docker run', 'docker run alpine; echo hacked', 'ls', 'docker rm c001', 'docker execute c001']) {
    const result = runCommand(state, command);
    assert.equal(result.ok, false, command);
    assert.strictEqual(result.state, state);
    assert.equal(JSON.stringify(state), original);
  }
});

test('all output commands keep state and show correct containers', () => {
  let state = apply(createInitialState(), 'docker run ubuntu');
  state = apply(state, 'docker stop c001');
  assert.equal(runCommand(state, 'docker ps').message, 'No matching containers.');
  assert.match(runCommand(state, 'docker ps -a').message, /c001.*stopped/i);
  assert.match(runCommand(state, 'docker images').message, /ubuntu/);
  assert.match(runCommand(state, 'docker help').message, /docker run/);
});

test('invalid image names are rejected without shell execution', () => {
  const original = createInitialState();
  for (const value of ['docker run hello;rm', 'docker pull $(whoami)', 'docker run image | bash', 'docker run image && whoami']) {
    const result = runCommand(original, value);
    assert.equal(result.ok, false, value);
    assert.strictEqual(result.state, original);
  }
});

test('a second stop and malformed container IDs fail safely', () => {
  let state = apply(createInitialState(), 'docker run ubuntu');
  state = apply(state, 'docker stop c001');
  assert.equal(runCommand(state, 'docker stop c001').ok, false);
  assert.equal(runCommand(state, 'docker start ../c001').ok, false);
});
