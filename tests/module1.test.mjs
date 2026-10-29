import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, runCommand } from "../src/simulator.js";
const run = (s, c, o) => {
  const r = runCommand(s, c, o);
  assert.equal(r.ok, true, c + ": " + r.message);
  return r.state;
};
test("equivalent Docker Hub default references share one immutable image", () => {
  let s = createInitialState();
  for (const n of [
    "nginx",
    "nginx:latest",
    "library/nginx",
    "docker.io/library/nginx:latest",
  ])
    s = run(s, "docker pull " + n);
  assert.equal(s.images.length, 1);
});
test("hello-world exits naturally even detached and logs remain readable", () => {
  let s = run(
    createInitialState(),
    "docker run -d --name greeting hello-world",
  );
  assert.equal(s.containers[0].status, "stopped");
  assert.equal(s.containers[0].exitCode, 0);
  assert.match(
    runCommand(s, "docker logs greeting").message,
    /Hello from Docker/,
  );
  assert.doesNotMatch(runCommand(s, "docker ps").message, /greeting/);
  assert.match(runCommand(s, "docker ps -a").message, /greeting/);
});
test("default noninteractive Ubuntu shell exits; detach does not keep it alive", () => {
  let s = run(createInitialState(), "docker run -d ubuntu");
  assert.equal(s.containers[0].status, "stopped");
});
test("names ports and restart preserve filesystem but launch process anew", () => {
  let s = run(
    createInitialState(),
    'docker run -d --name "web" -p 8080:80 nginx',
  );
  const id = s.containers[0].id;
  assert.match(id, /^[a-f0-9]{12}$/);
  s = run(s, "docker exec web touch /tmp/keep");
  s = run(s, "docker stop web");
  s = run(s, "docker start web");
  assert.equal(s.containers[0].id, id);
  assert.equal(s.containers[0].fs["/tmp/keep"].type, "file");
  assert.equal(s.containers[0].starts, 2);
  assert.match(s.containers[0].processes[0].name, /nginx/);
});
test("duplicate name, port conflicts and unsupported syntax are atomic", () => {
  const s = run(
    createInitialState(),
    "docker run -d --name web -p 8080:80 nginx",
  );
  for (const c of [
    "docker run --name web nginx",
    "docker run -p 8080:80 nginx",
    "docker run -e A=B nginx",
    "docker run --name",
    "docker run nginx; ls",
    "docker exec web sh -c echo",
    "docker run nginx | cat",
  ]) {
    const r = runCommand(s, c);
    assert.equal(r.ok, false, c);
    assert.strictEqual(r.state, s);
  }
});
test("diagnostic aliases reflect stopped state and removal respects references", () => {
  let s = run(createInitialState(), "docker run --name web nginx");
  assert.deepEqual(
    JSON.parse(runCommand(s, "docker inspect web").message),
    JSON.parse(runCommand(s, "docker container inspect web").message),
  );
  assert.equal(runCommand(s, "docker rmi nginx").ok, false);
  s = run(s, "docker stop web");
  assert.equal(runCommand(s, "docker rmi nginx").ok, false);
  assert.match(runCommand(s, "docker logs web").message, /nginx/);
  s = run(s, "docker container rm web");
  s = run(s, "docker image rm nginx");
  assert.equal(s.images.length, 0);
});
test("prune confirmation and scope preserve running and referenced images", () => {
  let s = run(createInitialState(), "docker run --name web nginx");
  s = run(s, "docker run hello-world");
  s = run(s, "docker pull redis");
  const r = runCommand(s, "docker container prune");
  assert.equal(r.ok, false);
  assert.equal(r.confirmation, true);
  s = run(s, "docker container prune", { confirmed: true });
  assert.equal(s.containers.length, 1);
  s = run(s, "docker image prune -a", { confirmed: true });
  assert.equal(s.images.length, 1);
  assert.equal(s.images[0].name, "nginx");
});
test("all command help and list aliases are stateful without inventing support", () => {
  let s = run(createInitialState(), "docker run nginx");
  for (const c of [
    "docker --help",
    "docker run --help",
    "docker exec --help",
    "docker image ls",
    "docker container ls -a",
    "docker image inspect nginx",
  ])
    assert.equal(runCommand(s, c).ok, true, c);
  assert.match(runCommand(s, "docker stats").message, /not yet simulated/i);
});
test("missing executable gives natural failed exit and diagnostic evidence", () => {
  let s = run(
    createInitialState(),
    "docker run --name broken ubuntu node app.js",
  );
  assert.equal(s.containers[0].status, "stopped");
  assert.equal(s.containers[0].exitCode, 127);
  assert.match(runCommand(s, "docker logs broken").message, /not found/);
});
test("COPY cache keys include synthetic context content; CMD is metadata history", () => {
  const dockerfile = 'FROM nginx\nCOPY page.html /tmp/\nCMD ["nginx"]';
  let a = runCommand(createInitialState(), "docker build -t demo .", {
    dockerfile,
    context: { "page.html": "one" },
  });
  let b = runCommand(a.state, "docker build -t demo .", {
    dockerfile,
    context: { "page.html": "two" },
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.notEqual(
    a.state.images.at(-1).layers.at(-1).id,
    b.state.images.at(-1).layers.at(-1).id,
  );
  assert.equal(
    a.state.images.at(-1).layers.some((l) => l.instruction.startsWith("CMD")),
    false,
  );
  assert.match(runCommand(b.state, "docker history demo").message, /metadata/);
});
test("identical build content gets one image identity with multiple tags and safe untagging", () => {
  const opts = { dockerfile: "FROM nginx\nWORKDIR /app" };
  let s = run(createInitialState(), "docker build -t app:v1 .", opts);
  s = run(s, "docker build -t app:stable .", opts);
  assert.equal(s.images.length, 2);
  assert.deepEqual(s.images.at(-1).tags.sort(), ["app:stable", "app:v1"]);
  s = run(s, "docker run --name live app:stable");
  s = run(s, "docker rmi app:v1");
  assert.equal(s.images.length, 2);
  assert.equal(runCommand(s, "docker rmi app:stable").ok, false);
  assert.equal(runCommand(s, "docker image inspect app:v1").ok, false);
});
test("inherited persistent service CMD works in a built image; unknown process behavior is explicit", () => {
  let s = run(createInitialState(), "docker build -t service .", {
    dockerfile: 'FROM nginx\nWORKDIR /app\nCMD ["nginx", "-g", "daemon off;"]',
  });
  s = run(s, "docker run service");
  assert.equal(s.containers[0].status, "running");
  assert.match(s.containers[0].processes[0].name, /nginx/);
});
