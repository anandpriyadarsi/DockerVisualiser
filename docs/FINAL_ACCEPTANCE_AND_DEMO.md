# Final recruitment acceptance and demonstration — DockerVisualiser

**Task ID:** `DockerVisualiser`  
**Official deadline:** 20 October 2026, 11:59 PM IST  
**Public site candidate:** https://prismatic-lamington-67be56.netlify.app/  
**Source repository:** Keep `anandpriyadarsi/DockerVisualiser` **PRIVATE**. Mentor `VarshiniAdurti28` has verified `write` access.  
**Real demo (2:02):** https://drive.google.com/file/d/1GMBPOgHI5H0fiBdP-WJ6-wBLZNCBc-yW/view — genuine high-resolution phone screen recording, applicant's original narration; anyone-with-link read access confirmed in Drive metadata.  
**Submission state (17 October 2026):** app and video prepared; applicant reports public Netlify access; scripted live checks/last-commit CI and official form still outstanding.

**Verified cross-platform CI:** [Final code-changing PR #3 run 38414619218](https://github.com/anandpriyadarsi/DockerVisualiser/actions/runs/38414619218) passed Ubuntu, Windows and Chromium desktop/mobile smoke jobs; [release gate run 38406777744](https://github.com/anandpriyadarsi/DockerVisualiser/actions/runs/38406777744) likewise passed. This does not verify the live Netlify assets or documentation-only commits.

## 1. Public acceptance: one command

From the repo on Windows, update and run:

```powershell
cd C:\Users\91994\DockerVisualiser
git pull origin main
npm.cmd test
npm.cmd run build
npm.cmd run verify:release
npm.cmd run check:live -- https://prismatic-lamington-67be56.netlify.app/
```

`check:live` is read-only and checks **six deployed paths**: HTML, CSS, and four JavaScript modules. It requires HTTPS, HTTP 200, expected content types and markers, and no redirects to other sites. This catches the earlier errors where Netlify received only `index.html` or flattened the `src/` folder. If it reports failure, check Netlify's *Deploy file browser* and redeploy the entire **`dist/` folder**.

**A successful check does not prove the site is anonymously accessible:** open the site from a Chrome **Incognito** window while logged out of Netlify and confirm it loads without a password. If Netlify shows **Team only**, choose **Make public** in the site settings. Never publish the GitHub repository.

## 2. Genuine demonstration recorded — reference outline and future rechecks

A genuine 2:02 applicant-recorded phone-screen demonstration with the applicant's own voice is already available at the Drive link above. The detailed outline below is retained as a **rehearsal/reference plan**, not a claim that every listed command is shown in the recorded edit. Do not substitute an AI-generated pretend demo.

| Approx. time | On-screen action | What to explain |
| --- | --- | --- |
| 0:00–0:15 | Show page header and URL. | This is a browser-only **simulation**, never a real Docker daemon. |
| 0:15–0:45 | Mission 01 (Containers): `docker pull alpine`, `docker run alpine`, `docker stop c001`, `docker start c001`. | Images are blueprints; a container starts and stops while retaining its ID. |
| 0:45–1:15 | Click **Reset**. Mission 02 (Layers): click **Build image** twice; run `docker history iris-app`. | Ordered Dockerfile instructions, image creation and deterministic cache reuse. |
| 1:15–1:55 | Click **Reset**. Mission 03 (Files & processes): `docker run ubuntu`, `docker exec c001 mkdir /tmp/work`, `docker exec c001 touch /tmp/work/notes.txt`, `docker exec c001 write /tmp/work/notes.txt hello NITK`, `docker exec c001 cat /tmp/work/notes.txt`. | In-memory per-container files and short-lived simulated processes. |
| 1:55–2:15 | `docker stop c001`, then `docker exec c001 ps` (expected failure). | Invalid state transitions are rejected safely; file state is preserved. |
| 2:15–2:35 | Show GitHub CI tests and README briefly. | No shell execution, tested state consistency, code documentation and honest model limitations. |

Use each lesson's **Use this command** button if helpful. The `c001` ID is valid if you reset between missions as instructed. If your container has another ID, copy its actual ID from the UI.

## 3. Checklist before filling the form

- [ ] Open the deployed website in Chrome Incognito, while **not logged into Netlify**.
- [ ] Verify dark CSS, working terminal, container/image animations, and browser mobile view.
- [ ] Pass `npm.cmd test`, `npm.cmd run verify:release`, and the public `check:live` command.
- [ ] Ensure Netlify site is **Public** and remains claimed in your account.
- [x] GitHub source repo is **private** and the mentor `VarshiniAdurti28` has verified **write** access.
- [ ] Update the README's live-site field if URL changes. State clearly that AI assistance was used.
- [x] Actual phone-screen demo recorded, edited, and uploaded to Google Drive; connector metadata confirms **anyone with the link: reader**.
- [ ] Optional independent Incognito playback verification on the video URL (Drive metadata confirms permissions but not actual streaming playback).
- [ ] Submit the official **first-year** form: https://forms.gle/rzd6zap9YTTd7tx46 before 20 October 2026, 11:59 PM IST.

## Submission information to copy

- **Task ID:** `DockerVisualiser`
- **GitHub repository:** https://github.com/anandpriyadarsi/DockerVisualiser (private; mentor must have access)
- **Public deployment candidate:** https://prismatic-lamington-67be56.netlify.app/
- **Demo video:** https://drive.google.com/file/d/1GMBPOgHI5H0fiBdP-WJ6-wBLZNCBc-yW/view
- **Description:** An interactive browser-based Docker learning simulator with container lifecycle, image-layer caching, a simulated Dockerfile builder and per-container filesystem/process visualisation.

**Do not claim recruitment submission is complete** until remaining release checks and the actual first-year form submission are verified. The student has already shared the project with the mentor for feedback; feedback is welcome but not a submission prerequisite.
