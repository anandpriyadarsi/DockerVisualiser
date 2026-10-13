import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, runCommand } from '../src/simulator.js';

function command(state, input, options) {
  const result = runCommand(state, input, options);
  assert.equal(result.ok, true, `${input}: ${result.message}`);
  return result.state;
}
function rejected(state, input) {
  const result = runCommand(state, input);
  assert.equal(result.ok, false, input);
  assert.strictEqual(result.state, state, 'Failed commands must be atomic');
}

test('containers have simulated root directories and PID 1', () => {
  const state = command(createInitialState(), 'docker run ubuntu');
  const c = state.containers[0];
  assert.equal(c.fs['/tmp'].type, 'dir');
  assert.equal(c.fs['/etc'].type, 'dir');
  assert.equal(c.processes[0].pid, 1);
  assert.match(runCommand(state, 'docker exec c001 ps').message, /1  \/bin\/sh/);
  assert.match(runCommand(state, 'docker exec c001 ls /').message, /tmp\//);
});

test('Dockerfile WORKDIR and COPY seed filesystem; CMD gives PID1 name', () => {
  const dockerfile = 'FROM ubuntu\nWORKDIR /app\nCOPY app.js /app/\nCMD ["node", "app.js"]';
  let s = command(createInitialState(), 'docker build -t iris-app .', { dockerfile });
  s = command(s, 'docker run iris-app');
  assert.equal(s.containers[0].cwd, '/app');
  assert.equal(s.containers[0].fs['/app/app.js'].type, 'file');
  assert.match(runCommand(s, 'docker exec c001 cat /app/app.js').message, /Simulated COPY/);
  assert.match(runCommand(s, 'docker exec c001 ps').message, /node/);
});

test('mkdir touch write cat rm provide observable filesystem changes', () => {
  let s = command(createInitialState(), 'docker run ubuntu');
  s = command(s, 'docker exec c001 mkdir /tmp/work');
  s = command(s, 'docker exec c001 touch /tmp/work/notes.txt');
  s = command(s, 'docker exec c001 write /tmp/work/notes.txt hello world');
  assert.equal(s.containers[0].fs['/tmp/work/notes.txt'].content, 'hello world');
  assert.match(runCommand(s, 'docker exec c001 cat /tmp/work/notes.txt').message, /hello world/);
  assert.match(runCommand(s, 'docker exec c001 ls /tmp/work').message, /notes.txt/);
  s = command(s, 'docker exec c001 rm /tmp/work/notes.txt');
  assert.equal(s.containers[0].fs['/tmp/work/notes.txt'], undefined);
  assert.equal(s.containers[0].recentExec.at(-1).status, 'exited');
  assert.equal(s.containers[0].recentExec.at(-1).pid, 5);
});

test('filesystem changes are isolated per container, not image layers', () => {
  let s = command(createInitialState(), 'docker run alpine');
  s = command(s, 'docker run alpine');
  const originalFS = s.containers[0].fs;
  const untouched = s.containers[1].fs;
  s = command(s, 'docker exec c001 touch /tmp/unique.txt');
  assert.equal(originalFS['/tmp/unique.txt'], undefined);
  assert.equal(s.containers[0].fs['/tmp/unique.txt'].type, 'file');
  assert.strictEqual(s.containers[1].fs, untouched);
  assert.equal(s.containers[1].fs['/tmp/unique.txt'], undefined);
  assert.equal(s.images[0].fs, undefined);
});

test('stop disables exec, restart retains writable layer, remove cleans runtime', () => {
  let s = command(createInitialState(), 'docker run ubuntu');
  s = command(s, 'docker exec c001 touch /tmp/keep.txt');
  s = command(s, 'docker stop c001');
  assert.equal(s.containers[0].processes[0].status, 'stopped');
  rejected(s, 'docker exec c001 ls /tmp');
  s = command(s, 'docker start c001');
  assert.equal(s.containers[0].processes[0].status, 'running');
  assert.equal(s.containers[0].fs['/tmp/keep.txt'].type, 'file');
  s = command(s, 'docker stop c001');
  s = command(s, 'docker rm c001');
  rejected(s, 'docker exec c001 ls /tmp');
});

test('invalid paths, commands and missing parents never mutate state', () => {
  const s = command(createInitialState(), 'docker run ubuntu');
  for (const cmd of [
    'mkdir /tmp/../../etc', 'touch /missing/nope.txt', 'rm /tmp',
    'cat /tmp/nope', 'ls /missing', 'sh -c danger', 'touch ../../escape',
    'write /tmp/log.txt', 'touch /tmp/..', 'mkdir /tmp',
  ]) rejected(s, `docker exec c001 ${cmd}`);
});

test('simulated write and process history have resource bounds', () => {
  let s = command(createInitialState(), 'docker run ubuntu');
  rejected(s, `docker exec c001 write /tmp/huge ${'x'.repeat(161)}`);
  for (let i = 0; i < 18; i++) s = command(s, 'docker exec c001 pwd');
  assert.equal(s.containers[0].recentExec.length, 12);
  assert.equal(s.containers[0].recentExec[0].pid, 8);
  assert.equal(s.containers[0].nextPid, 20);
});