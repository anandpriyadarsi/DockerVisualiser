# DockerVisualiser — Public deployment, acceptance and demo

**Task ID:** `DockerVisualiser` | GDG × IRIS NITK 2026 | **First-year deadline: 20 October 2026, 11:59 PM IST**

The source repository remains **PRIVATE**. The deployed website is public. The app is a browser-only teaching simulation and does not need a server, keys, cloud database or Docker daemon.

## Step 1 — Final local checks (Windows PowerShell)

```powershell
cd C:\Users\91994\DockerVisualiser
git pull origin main
npm.cmd test
npm.cmd run build
py -m http.server 5500 --directory dist
```

Open http://localhost:5500. Check that the three guided missions, terminal, image library and filesystem panel work. Use `Ctrl+C` to stop the server afterwards.

## Step 2 — Publish the static site (no command-line credentials)

1. Sign into [Netlify](https://app.netlify.com/) with a personal account.
2. Open [Netlify Drop](https://app.netlify.com/drop).
3. In File Explorer, locate `C:\Users\91994\DockerVisualiser\dist` and **drag the `dist` folder**, not the private repository or ZIP, into Netlify Drop.
4. Record the resulting public `https://...netlify.app` site URL. Claim the project in your account if prompted, so the URL remains yours.
5. Open the URL in a private/incognito browser, on phone and desktop. Check that no login is required and both JS module imports and image builds work.
6. Put the **public site URL** in your private GitHub README and in the recruitment form. Never make the GitHub repo public.

If you prefer automatic deployments, you can connect the *private* GitHub repo to Vercel/Netlify using your own hosting account, but a simple `dist` drag-and-drop is enough for this static app. The deployment step requires your own hosting login; a public URL is not created by this repository or the tests.

**Important:** Running `py -m http.server` locally does **not** publish the site for recruiters.

## Step 3 — Two-minute demonstration video outline

- **0:00–0:15:** Show the public URL, name and “no real Docker daemon” notice.
- **0:15–0:40:** Guided mission 1: `docker pull alpine`, `docker run alpine`, stop and restart. Highlight same container ID and live status updates.
- **0:40–1:05:** Mission 2: show the editable Dockerfile, build `iris-app`, inspect its 7 sample layers, rebuild to demonstrate 4 reused cache layers.
- **1:05–1:35:** Mission 3: start Ubuntu, create `/tmp/work`, create and write notes, read it back. Show the virtual filesystem and process explorer.
- **1:35–1:50:** Demonstrate incorrect command rejected (e.g., `docker start missing`), and that state is preserved.
- **1:50–2:00:** Explain the architectural limits (safe parser, zero shell execution, virtual processes), briefly show automated tests.

You can record with Xbox Game Bar (`Win+Alt+R`) or OBS Studio. Ensure the text is readable, notifications are hidden, and microphone audio is clear. Keep private tokens and unrelated tabs out of the recording.

## Step 4 — Submission checks

- [ ] Private repo includes mentor Varshini Adurti (`VarshiniAdurti28`) as a collaborator (she must accept the invitation).
- [ ] README contains Task ID `DockerVisualiser`, run instructions, architecture, supported commands, limitations, references, public deployment URL.
- [ ] `npm.cmd test` succeeds and the GitHub CI shows green on the final commit.
- [ ] Public site works without GitHub login or localhost.
- [ ] Desktop and mobile checks completed.
- [ ] Demo video uploaded as a link that organisers can view.
- [ ] First-year [submission form](https://forms.gle/rzd6zap9YTTd7tx46) submitted **before** 20 October 2026, 11:59 PM IST.

## Known limits

This is an educational Docker model, **not a real Docker runtime**. The `write` exec operation is a teaching extension, image layer hashes are illustrative, `COPY` makes placeholder files, processes never execute, and simulation state resets on page reload. Do not claim production Docker compatibility, real isolation, real registries or arbitrary command execution.
