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

test('unknown registry image fails with an explicit lookup and no new image or container', () => {
  const original = createInitialState();
  for (const cmd of ['docker run definitely-not-in-demo', 'docker pull definitely-not-in-demo']) {
    const result = runCommand(original, cmd);
    assert.equal(result.ok, false, cmd);
    assert.strictEqual(result.state, original, 'failed lookup must be atomic');
    assert.deepEqual(result.steps.map(step => step.kind), ['lookup', 'missing']);
    assert.match(result.message, /not found.*offline|offline.*not found/i);
    assert.match(result.message, /no real registry was contacted/i);
  }
  assert.equal(original.images.length, 0);
  assert.equal(original.containers.length, 0);
  assert.equal(original.nextId, 1);
});

test('valid sample registry images pull once; cached runs do not re-pull', () => {
  let state = createInitialState();
  const first = runCommand(state, 'docker run nginx');
  assert.equal(first.ok, true);
  assert.deepEqual(first.steps.map(step => step.kind), ['pull', 'layer', 'layer', 'layer', 'create', 'start']);
  state = first.state;
  const second = runCommand(state, 'docker run nginx');
  assert.equal(second.ok, true);
  assert.deepEqual(second.steps.map(step => step.kind), ['create', 'start']);
  assert.equal(second.state.images.length, 1);
  assert.deepEqual(second.state.containers.map(c => c.id), ['c001', 'c002']);
});

test('missing Dockerfile FROM image aborts the entire build without changing state', () => {
  const state = createInitialState();
  const file = 'FROM definitely-not-in-demo\nWORKDIR /app\nCMD ["node", "app.js"]';
  const result = runCommand(state, 'docker build -t foo .', { dockerfile: file });
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, state);
  assert.deepEqual(result.steps.map(step => step.kind), ['lookup', 'missing']);
  assert.equal(state.history.length, 0);
});

test('existing local custom image works without querying example registry', () => {
  const file = 'FROM ubuntu\nRUN echo ready';
  const first = runCommand(createInitialState(), 'docker build -t custom-app .', { dockerfile: file });
  assert.equal(first.ok, true);
  const next = runCommand(first.state, 'docker run custom-app');
  assert.equal(next.ok, true);
  assert.deepEqual(next.steps.map(step => step.kind), ['create', 'start']);
});

test('names that masquerade as Docker Hub library paths are not silently accepted', () => {
  const state = createInitialState();
  const result = runCommand(state, 'docker run unknown-org/ubuntu');
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, state);
});


test('mentor case: docker c003 is not a command, and c003 cannot be used if absent', () => {
  let state = createInitialState();
  state = apply(state, 'docker run ubuntu');
  state = apply(state, 'docker run ubuntu');
  assert.deepEqual(state.containers.map(c => c.id), ['c001', 'c002']);
  const original = JSON.stringify(state);
  for (const input of ['docker c003', 'docker stop c003', 'docker start c003',
    'docker rm c003', 'docker exec c003 ps', 'docker run c003', 'docker pull c003']) {
    const result = runCommand(state, input);
    assert.equal(result.ok, false, input);
    assert.strictEqual(result.state, state, 'Rejected command must not mutate state');
    assert.equal(JSON.stringify(state), original);
    assert.equal(result.state.containers.length, 2);
  }
  assert.match(runCommand(state, 'docker c003').message, /unknown docker command "c003"/i);
  assert.match(runCommand(state, 'docker stop c003').message, /does not exist/i);
});

test('container c003 is a valid ID only with a valid action after creation', () => {
  let state = createInitialState();
  for (let i = 0; i < 3; i++) state = apply(state, 'docker run alpine');
  const invalid = runCommand(state, 'docker c003');
  assert.equal(invalid.ok, false);
  assert.strictEqual(invalid.state, state);
  state = apply(state, 'docker stop c003');
  assert.equal(state.containers[2].status, 'stopped');
  state = apply(state, 'docker start c003');
  assert.equal(state.containers[2].status, 'running');
});
