import { EXERCISES } from "./exercises.js";
export const LESSON_IDS = [
  "server",
  "vm",
  "process",
  "features",
  "architecture",
  "image-container",
  "pull-run",
  "lifecycle",
  "inspect",
  "flags",
  "cleanup",
  "capstone",
];
export const ACADEMY_ORIGIN = "https://dockeracademy.netlify.app";
export const SIMULATOR_ORIGIN = "https://dockervisualiser.netlify.app";
// Fixed local pair for automated two-origin tests; never an arbitrary returnUrl.
export function origins(locationOrigin = "") {
  return ["http://127.0.0.1:4173", "http://127.0.0.1:4174"].includes(
    locationOrigin,
  )
    ? { academy: "http://127.0.0.1:4173", simulator: "http://127.0.0.1:4174" }
    : { academy: ACADEMY_ORIGIN, simulator: SIMULATOR_ORIGIN };
}
export function parseLaunch(search) {
  if (search.length > 1000) return { error: "Exercise link is too long." };
  const p = new URLSearchParams(search);
  if (!p.has("exercise")) return { legacyLesson: p.get("lesson") };
  const allowed = ["v", "exercise", "lesson", "returnLesson", "attempt"];
  for (const k of p.keys())
    if (!allowed.includes(k) || p.getAll(k).length !== 1)
      return { error: "Unsupported or duplicate exercise-link field." };
  const v = p.get("v"),
    exercise = p.get("exercise"),
    lesson = p.get("lesson"),
    returnLesson = p.get("returnLesson"),
    attempt = p.get("attempt");
  if (
    v !== "1" ||
    !EXERCISES[exercise] ||
    !LESSON_IDS.includes(lesson) ||
    returnLesson !== lesson ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(attempt || "")
  )
    return {
      error: "Unsupported exercise link or version. Your sandbox is preserved.",
    };
  return { v: 1, exercise, lesson, returnLesson, attempt };
}
export function launchUrl(request, origin = "") {
  const o = origins(origin);
  const params = new URLSearchParams({ ...request, v: "1" });
  const parsed = parseLaunch("?" + params);
  if (parsed.error) throw Error(parsed.error);
  return o.simulator + "/?" + params;
}
export function returnUrl(request, complete, origin = "") {
  const o = origins(origin);
  return (
    o.academy +
    "/#" +
    request.returnLesson +
    "?" +
    new URLSearchParams({
      tab: "practice",
      exercise: request.exercise,
      attempt: request.attempt,
      result: complete ? "complete" : "incomplete",
      v: "1",
    })
  );
}
export function parseRoute(hash) {
  try {
    if (hash.length > 1000) throw Error();
    const [part, query = ""] = hash.replace(/^#/, "").split("?");
    const lesson = decodeURIComponent(part);
    if (!LESSON_IDS.includes(lesson)) return { lesson: "server", tab: "learn" };
    const p = new URLSearchParams(query);
    for (const k of p.keys())
      if (
        !["tab", "exercise", "attempt", "result", "v"].includes(k) ||
        p.getAll(k).length !== 1
      )
        return { lesson, tab: "learn" };
    return {
      lesson,
      tab: ["learn", "practice", "quiz", "commands"].includes(p.get("tab"))
        ? p.get("tab")
        : "learn",
      exercise: p.get("exercise"),
      attempt: p.get("attempt"),
      result: p.get("result"),
      v: p.get("v"),
    };
  } catch {
    return { lesson: "server", tab: "learn" };
  }
}
export function consumeReceipt(pending, route) {
  const p = pending[route.attempt];
  if (
    !p ||
    route.v !== "1" ||
    !EXERCISES[route.exercise] ||
    p.exercise !== route.exercise ||
    p.lesson !== route.lesson ||
    p.v !== 1 ||
    !["complete", "incomplete"].includes(route.result)
  )
    return { accepted: false };
  delete pending[route.attempt];
  return {
    accepted: true,
    complete: route.result === "complete",
    exercise: route.exercise,
  };
}
