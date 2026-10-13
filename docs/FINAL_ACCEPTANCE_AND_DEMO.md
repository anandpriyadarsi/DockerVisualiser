# Final recruitment acceptance and demonstration — DockerVisualiser

**Task ID:** `DockerVisualiser`  
**Official deadline:** 20 October 2026, 11:59 PM IST  
**Public site candidate:** https://prismatic-lamington-67be56.netlify.app/  
**Source repository:** Keep `anandpriyadarsi/DockerVisualiser` **PRIVATE**. Add mentor `VarshiniAdurti28` as collaborator.

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

## 2. Record an actual 2–3 minute demonstration video

Use Windows Game Bar (`Win+Alt+R`) or OBS. Record the **public site URL** in the browser, not localhost. Hide notifications and private tabs. Speak naturally and demonstrate the behaviour; do not submit an AI-generated pretend demo.

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
- [ ] Mentor invitation is accepted or at least pending; keep the source repo **private**.
- [ ] Update the README's live-site field if URL changes. State clearly that AI assistance was used.
- [ ] Record an **actual** demonstration video and upload it to a shareable service with **Anyone with the link can view** permission. Verify in Incognito.
- [ ] Submit the official **first-year** form: https://forms.gle/rzd6zap9YTTd7tx46 before 20 October 2026, 11:59 PM IST.

## Submission information to copy

- **Task ID:** `DockerVisualiser`
- **GitHub repository:** https://github.com/anandpriyadarsi/DockerVisualiser (private; mentor must have access)
- **Public deployment candidate:** https://prismatic-lamington-67be56.netlify.app/
- **Demo video:** add the real share link after recording.
- **Description:** An interactive browser-based Docker learning simulator with container lifecycle, image-layer caching, a simulated Dockerfile builder and per-container filesystem/process visualisation.

**Do not claim recruitment submission is complete** until the public site, the real video and the official form are verified.
