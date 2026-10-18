# Changelog

Every change to Opia is listed here, newest first, with what was tested and what was not.
Work done in a cloud session (no access to the Windows PC) says so: those changes were tested in headless Chromium on Linux, not in the packaged `Opia.exe` window.

## Updates from GitHub (cloud session, 2026-10-18)

**Added** an update wizard: **Help → Check for Updates…** (`server/updates.py`, `web/js/updates.js`).

**How it asks:**
- Before it goes online at all, it asks: "To look for a new version, Opia needs to go online and ask GitHub… Nothing about you, this computer or your files is sent."
- There is a box to check automatically once a day.
- The question comes once, a few seconds after start-up, but not during the first-run tour. After that it lives in Help.
- Every result has **Don't go online for updates**, which takes the permission back.

**What it does:**
- When there's something new, it shows what changed (the release's notes, or the commit messages) and offers **Update now**.
- It updates with a progress bar in the activity area, then **Restart now** closes Opia and opens the new version. A small script waits for Opia to exit first.
- How it updates depends on how Opia is installed:
  - **Opia.exe:** downloads the newest release's Opia.exe, checks that it is a complete Windows program, and swaps it in.
  - **A git copy:** `git pull --ff-only` from GitHub, then `pip install -r requirements.txt`. It refuses if the copy has its own changes, and says so.
  - **A plain folder:** downloads the code archive and copies it over the folder.

**Also added:**
- **A Windows build workflow** (`.github/workflows/windows.yml`). On every push to `main`, GitHub's Windows machines install the requirements, stamp the version (1.0.N) and build Opia.exe with the usual PyInstaller command.
- **A smoke test:** the workflow starts the exe, asks it a question over its API, and only then publishes the exe as release v1.0.N. That gives the Releases page, the website's Download button and the exe updater something to download. The notes are the changes since the last release.
- **`requirements.txt`**, so the README, the website and the updater install the same packages.

**Changed:** the About box and the website's privacy section now name update checks as one of the things Opia goes online for.

**Tested here (Linux):**
- **Checking GitHub for real:** refused before permission; "up to date" for this copy; one commit found, with its message, when pretending to be a commit behind.
- **The git update** on a throwaway copy a commit behind: it moved forward to the newest commit.
- **The folder update:** it downloaded 43 MB and the result matches the git copy exactly.
- **The wizard in the app:** the first-start question, Allow, "up to date", the offer screen with notes, and Help → Check for Updates…, with no script errors.

**Not tested:**
- **The exe swap and the restart script.** They are Windows-only, and there was no exe release to update from yet. The first Windows build runs on GitHub after this push.
- **Spanish:** the wizard's Spanish text is in place but wasn't checked on screen.

## Opia for Windows, and Opia for Android moves out (cloud session, 2026-10-18)

**Renamed** this project to **Opia for Windows**: in the README's title and introduction, and on the website's title, hero, download ticket and footer (in English and Spanish). The links now point to `github.com/kanisakhpara-devs/Opia-for-Windows` and `kanisakhpara-devs.github.io/Opia-for-Windows`. GitHub repository names can't contain spaces, so the repository itself is to be named `Opia-for-Windows`; that rename is done in the repository's settings.

**Moved** the Android app (`mobile/` and `.github/workflows/android.yml`) to its own repository, **[Opia for Android](https://github.com/kanisakhpara-devs/Opia-for-Android)**, with its own README, website and releases. The changes to it since the entry below are in that repository's changelog. This README, the website's "What's new" and its download ticket link to it.

**Left as it was:** the XMP namespace in `server/xmp.py` (`https://github.com/kanisakhpara-devs/Opia/ns/1.0/`). It names Opia's tags inside photo sidecar files, rather than being a link, so changing it would stop Opia reading tags it has already written. The old *android* release in this repository stays until it is deleted by hand; newer builds are only in Opia for Android.

**Tested** (headless Chromium): the website in light/English and dark/Spanish, with no accessibility violations, no sideways scrolling on phones and no script errors.

## Opia for Android (cloud session, 2026-10-18)

**Added** `mobile/`, a phone version of Opia built for touch, with four workspaces. You chose "phone-first" over squeezing in the desktop app or making a remote control for the PC. Everything runs on the phone, and the app has no internet permission.
- **Lens:**
  - Photos come in through the phone's photo picker. You can rate them, mark favourites and filter the grid.
  - Swipe between photos; double-tap or pinch to zoom.
  - A develop editor with 14 adjustments, 10 filters, and crop with fixed ratios, rotate, flip and straighten. Hold the photo to compare with the original.
  - Undo and redo. Edits are kept as numbers, so the original never changes.
  - *Save copy* renders the photo at full size into `Pictures/Opia`.
- **Imagine:**
  - Pictures made of photo, text, sticker and drawing layers.
  - Drag to move; pinch to resize and turn, snapping to straight.
  - Five fonts, colours, a label behind text, opacity, layer order and hiding, an eraser that only rubs out its own drawing, and undo.
  - Pictures save as you go and export as PNG or JPEG.
  - Photos can come straight from Lens, with their edits.
- **Folio:**
  - PDFs shown with pdf.js and changed with pdf-lib.
  - Fill in the form, sign with your finger (signatures are kept), add text, highlights and drawing, and move or resize marks.
  - Turn, reorder, copy and delete pages; revert to the original.
  - Save to `Download/Opia` or share.
- **Groove:** uses the desktop's `web/js/music-engine.js` and instrument samples unchanged.
  - Pick a style and four parts are written to fit together.
  - Change them on a grid of steps, with "new idea", instrument, kit, key, scale, tempo, riff length and a mixer.
  - Record your voice over the song, then save it as WAV to `Music/Opia`.
- **App-wide:**
  - English and Spanish, light and dark (following the phone by default).
  - The back button closes the top sheet or screen first.
  - Every control has a spoken name.

**How it fits together:**
- `mobile/www` is plain HTML, CSS and JavaScript.
- `mobile/assemble.py` adds the files shared with the desktop app (music engine, samples, fonts, icons) into `mobile/build/www`.
- `mobile/android` is a small Java app, using no libraries beyond Android itself. It serves those files from inside the APK to a WebView, and adds the photo and file pickers, saving through MediaStore, sharing, the microphone and the back button.
- `.github/workflows/android.yml` builds the APK on GitHub and puts it on the rolling **android** release, so the newest build is always at `releases/download/android/Opia.apk`.
- New third-party code: pdf.js 3.11.174 (Apache-2.0, run with `isEvalSupported: false`) and pdf-lib 1.17.1 (MIT), in `mobile/www/vendor` with their licences.

**Signing:**
- Builds are signed with `mobile/android/opia-public.jks`, a key that is public on purpose, so each build installs over the last without you setting anything up.
- Anyone could sign an app with that key, so only install Opia from this repository's Releases.
- `mobile/README.md` explains how to switch to a private key through repository secrets. Switching needs one uninstall, which deletes the app's data.

**Tested** (headless Chromium at phone size, 390 × 844 with touch, serving `mobile/build/www`):
- **Lens:** importing 8 photos, rating, favourites, Adjust, Filters, square crop, rotate, and *Save copy* (1600 × 1600 JPEG, cropped, turned and filtered).
- **Imagine:** from a photo, adding text with a font and a label, a sticker, a drawing, layers, undo/redo, PNG export (2400 × 1600).
- **Folio:** filling a form (text with accents, checkbox, dropdown), text, highlight and a drawn signature, moving and rotating pages, saving. pypdf confirms the page order, the rotation, the text and the form values in the saved file.
- **Groove:** a Lo-fi song playing, the drum and melody grids, WAV export (14.8 s, stereo), and a 3-second voice recording with Chromium's fake microphone.
- **Everywhere:** Spanish, the back button closing sheets and screens in order, and no script errors.
- **Accessibility:** axe-core found **no violations** on 18 screens in dark and light.

Fixed during testing:
- The crop shading covered the whole screen.
- A tap that opened a sheet also closed it straight away (it would have broken the Text and Sign tools on real phones).
- Low contrast on light-theme buttons.
- Header landmarks, a nameless photo viewer and the star buttons.

The Android Java code compiles against the Android 14 framework classes.

**Not tested:**
- **Not run on a phone.** This cloud computer cannot download the Android SDK, so the app is built on GitHub instead. The first build there (Android workflow, run 1) **succeeded** and published a 6.2 MB `Opia.apk` to the *android* release. I downloaded that APK and checked that it contains the app, the music engine and the PDF libraries; I could not install or run it.
- Not tried on a real phone, a real microphone or TalkBack.
- HEIC and RAW photos mostly will not open on phones.

## Website: the privacy stamp reads properly (cloud session, 2026-10-15)

**Fixed** the "KEPT ON THIS COMPUTER" stamp. The phrase was too long for the ring, so the second copy was cut off after "KEPT ON THIS C" and the first copy started straight after it, which looked like a mistake. A small script in `docs/site.js` now measures the phrase once the font has loaded, and after each language switch, and sizes and spaces it so exactly two copies go once around the ring. The Spanish phrase is longer, so its letters come out smaller. The join between the two copies now has the same "·" and spacing as the middle.

**Tested** (headless Chromium): the stamp in light/English and in dark/Spanish. In both, the text measures 465 units against a ring of 465. axe still finds no violations, and there are no script errors. **Not tested**: Safari or Firefox. Without JavaScript the old cut-off version still shows.

## Website redesign: the light table (cloud session, 2026-10-15)

**Changed** `docs/index.html`, `docs/site.css` and `docs/site.js`, rewritten from scratch so the site no longer looks like a template. It is now laid out like a desk covered in your own work:
- **Hero:** prints of the five workspaces, each with a white border, masking tape and a handwritten caption. They drop onto the desk when the page opens and drift a little as you scroll. Two workspace icons sit on the desk as stickers.
- **Index strip** under the hero, linking to each workspace.
- **One numbered spread per workspace** (01 Lens … 05 Folio): a big outlined number, the text, a taped print that settles into place, and a handwritten red note that writes itself in. The spreads alternate left and right.
- **"Also in the box"**: a sheet of ruled paper where the boxes tick themselves.
- **Private by design**: a round rubber stamp reading "KEPT ON THIS COMPUTER" that stamps down.
- **What's new**: a yellow memo pinned to the desk. **FAQ** on ruled lines. **Download**: a ticket with an "ADMIT ONE" stub and the run-from-source box with its Copy button. The footer credits stay.
- **Light is now the default**, with a dark "night desk" theme on the toggle. The EN/ES switch (English by default) and reduce-motion support are kept.

**Added** `docs/assets/Caveat.ttf` (the handwriting typeface) and `docs/assets/Caveat-OFL.txt`. Caveat is under the SIL Open Font License and is served from the site itself, so the page still loads nothing from other websites.

**Tested** (headless Chromium, served locally):
- desktop 1440 × 900 at every section in light and dark
- phone 390 × 844
- Spanish
- reduced motion (prints shown at once, no animation)
- no script errors

axe-core found **no accessibility violations** in light/English or in dark/Spanish. Fixed during testing:
- The download ticket was 1300 px wide on phones, which made the page scroll sideways.
- The tilted prints also pushed the page wider than the screen.
- The handwritten notes were too small, and their last letters were clipped.

**Not tested**: Safari or Firefox, or a real phone.

## Project website for GitHub Pages (cloud session, 2026-10-15)

**Added** `docs/index.html`, `docs/site.css`, `docs/site.js`, `docs/assets/` (the five workspace icons, plus the Nunito font with its OFL licence) and `docs/.nojekyll`. It is a one-page site, built to your choices:
- **Hero:** the Opia wordmark draws itself and the blue dot orbits, like the app's splash. The tagline and buttons rise in, and the Lens screenshot starts tilted back and lies flat as you scroll.
- **Workspaces as a pinned scroll story:** an app window stays pinned while you read about Lens, Imagine, Motion, Groove and Folio. Its screenshot cross-fades, the small switch in its title bar moves along, and the page's glow and buttons take each workspace's colour. On phones it becomes a simple list with a screenshot under each workspace.
- **Feature grid**, with cards that pop in one after another.
- **Private by design**, with an animated graphic of the workspace icons flowing into a computer under a crossed-out cloud.
- **What's new**, as a timeline.
- **FAQ**, answered honestly, including no licence chosen yet, Windows-only parts and no Lightroom catalogs.
- **Download:** a button to GitHub Releases, plus a run-from-source box with a Copy button.
- **Footer** with credits and licences (FFmpeg GPL note, Fluid R3 CC BY, Nunito OFL).
- **Dark by default with a light/dark toggle**, and an **EN/ES switch** (English by default). Both choices are remembered in the browser.
- Animations stay smooth and tasteful. Visitors whose computer is set to reduce motion get a still page.

The site reuses the screenshots in `docs/readme/`. It loads nothing from other websites.

**Tested** (headless Chromium, served locally): desktop 1440 × 900 at every section, phone 390 × 844 (no sideways scrolling), light theme, Spanish, the FAQ opening, and the Copy button. axe-core found **no accessibility violations** in either dark/English or light/Spanish. During testing I fixed a script error (a name clash that stopped the scroll effects), low contrast on the not-yet-active workspace text, and white text on the light accent colours.

**Needs you**: GitHub Pages has to be switched on once in the repository settings (see the reply). Until then the README's Website link shows a 404. The Download button goes to the Releases page, which is empty until you publish the exe there.

## Workspaces renamed: Lens, Imagine, Motion, Groove, Folio (cloud session, 2026-10-15)

You picked new names: **Photos → Lens, Image → Imagine, Video → Motion, Music → Groove, PDF → Folio**.

**Changed**
- The workspace switch in the top bar, its hover text ("Lens: organise and edit photos"...), the welcome-screen headings, the tour, and the About box.
- Messages and menu items that named a workspace: *Photo › Edit in Imagine* (was Edit in Image Editor), *Edit Frame in Imagine*, *Make a Video in Motion*, "Add it to the Lens catalog", "Pick a photo in Lens first", and so on.
- The workspace names are never translated: Spanish shows the same five names. Without this, "Lens" would have shown as "Objetivo", because the camera-lens metadata field already uses that word. The rest of the new text has Spanish versions.
- The icon files' accessible names now say Lens / Imagine / Motion / Groove / Folio.
- README: headings, links, the shortcut table, the limits and credits use the new names. The banner and all six screenshots were taken again so they show the new names.

**Kept as they were, on purpose**
- Folders on disk: `Pictures\Opia\Music\<song>` and `Pictures\Opia\Video\<project>`. Renaming them would hide your existing songs and projects. The README calls them Groove songs and Motion projects.
- Internal identifiers (`image`, `video`, `music`, `pdf`), so saved settings, custom shortcuts and projects all keep working.
- Menu titles that describe actions rather than the workspace, such as the "Image" menu in Imagine (image size, rotate...), "Export Video…", and the "Photo" menu in Lens.

**Tested**: every workspace opens with its new name and its menus; the switch keeps the five names in Spanish; no page errors.

## A nicer GitHub front page (cloud session, 2026-10-15)

**Changed**: `README.md` is rewritten as a product page:
- a banner with the Opia wordmark, a tagline and the five workspace icons
- badges and quick links
- a short introduction
- one section per workspace, each with its icon, a real screenshot and its main features (Photos also has a Develop screenshot)
- Get started, keyboard shortcuts, where files are kept and writing a plug-in, each folded into a click-to-open section
- an Accessibility section
- the honest limits per workspace, also folded
- credits and licences, including the FFmpeg GPL note

None of the facts were removed, only reorganised. I checked the feature claims against the code (for example the export formats and the Develop panels).

**Added**: `docs/readme/` holds `banner.png` and the screenshots `photos.png`, `develop.png`, `image.png`, `video.png`, `music.png` and `pdf.png`, about 4.5 MB together. They are screenshots of the real app (headless Chromium, 1600 × 960). The landscape "photos", the itinerary PDF and the music in them were generated for the screenshots; the README says so. They are not used by the app.

**Not done**: the repository's About box (description, website, topics) is set on GitHub itself and cannot be changed from here.

## Music: drag and drop audio like a video editor (cloud session, 2026-10-15)

You asked for Filmora / Canva-style dragging of audio in the Music workspace's Advanced timeline.

**Changed** (`web/js/music.js`, `web/css/app.css`)
- **Drop sound files from your computer onto the timeline, and they land where you let go.** Over an audio track, the sound is added to that track at that moment. Anywhere else (a drums / bass / chords / melody lane, the ruler or empty space), it gets a new audio track starting there. While dragging, a line and a label show where it will land ("Add to Vocals at 0:15" or "New audio track at 0:04"). Several files dropped at once go one after another. Before, a dropped file always got a new track at the cursor. Beginner mode still adds dropped files from the start of the song.
- **Drag a clip by any part of it**, not just its thin name strip, to move it in time, **and onto another audio track**.
- **Drag either end of a clip to trim it** (the start cannot go before the beginning of the recording, the end not past its end). Snap to the beat applies; hold Alt to place freely.
- A plain click on a clip still selects it and puts the cursor there. **Selecting part of a clip's waveform is now Shift-drag**, because a plain drag moves the clip. A drag on empty lane space still selects a range as before.
- The fade dots at the top corners of a clip still set fade in and out.
- Unchanged: clicking a bar in a drums / bass / chords / melody lane turns that part on or off for that bar. That is the "it hides itself" behaviour; it was not removed.
- Spanish text for the new hints.

**Tested** (headless Chromium, Playwright, real server): drag-and-drop of a WAV over a riff lane (new track at the drop time), over an audio track (added to it at the drop time), and over the ruler (new track); dragging a clip to another audio track; trimming the end and the start (in point moved correctly); click selects without moving; Shift-drag selects a range; undo; riff bar clicks still toggle. No page or console errors.
**Not tested**: in the Windows exe / WebView2, with real files dragged from Explorer (the test made the drag-and-drop events in the page), and compressed formats like MP3 or M4A on Windows.
**Accessibility note**: moving and trimming clips this way needs a mouse, pen or touch, as before. Clips can still be edited with the Edit buttons and keys (S to split, Ctrl+X / C / V).

## Bug check and accessibility check, whole app (cloud session, 2026-10-15)

**How it was checked**
- Python: pyflakes on `server/`, `run.py` and the plug-ins. Nothing found apart from imports that are there on purpose (they register the API) and one unused variable in `catalog.py`.
- JavaScript: syntax check and ESLint (recommended rules, with every file's shared names declared) on all 22 files in `web/js`. No errors.
- A browser sweep that ran **every menu command in every workspace**: all seven Photos modules, plus Image (with a picture open), Video (with a project open), PDF (with a document open) and Music. It watched for page errors, console errors, server errors (HTTP 5xx) and red error messages.
- axe-core 4.10 (an automated accessibility checker) on every workspace in Opia Dark, and on Library, Image and Video in the light themes. It was also run on a menu, the New Picture dialog and the Export and Export Video dialogs.
- Keyboard-only tests: menus, dialogs, the Image layer list, Video timeline clips and media, and sliders.
- Every earlier Image and Video test, run again afterwards.

**Bugs fixed**
- Folder pickers failed with "Cannot read ... (No such file or directory)" when their starting folder did not exist yet. For example, Save Frame as Picture before the first export, because `Opia Exports` did not exist. They now start from the nearest folder that does exist. Found by the sweep; it affects every folder and file picker in the app.
- Video: a picture or title clip could not be stretched to the left beyond where it started. Its left edge was limited as if it were a video file.
- Video: two clips of the same unplayable file could make the same preview copy at the same time and spoil it. Now one copy is made at a time per file.
- Image: the undo history's memory limit was computed wrongly, and could throw away too much or too little history. It now counts each stored canvas once.
- Keyboard: on a focused slider, the arrow keys did something else (nudge, seek) instead of moving the slider. On a focused button, Enter or Space ran the workspace's shortcut (for example Image's Enter = apply) instead of pressing the button. Both are fixed for the whole app.

**Accessibility fixed**: axe found about 1,300 problems before, and **0 after**, on every screen it checked.
- Contrast: the dim grey text was 2.7-3.0:1 in every theme (the standard minimum is 4.5:1). It is now at least 4.6:1 on every panel colour. New values: Opia Dark #98979b, Midnight #929fa9, Porcelain #656259, Lilac #645f7d. The dim text is a little brighter in the dark themes and a little darker in the light ones.
- Accent colours that were too pale for their text were made deeper:
  - Porcelain gold: #94701f and #74530a.
  - Lilac violet: #6a4bef.
  - Light-theme PDF blue: #0f75b0 and #0a5f92.
  - Light-theme Music coral: #c4381d and #a8301a.
  - Light-theme Video amber: #9a5c00 and #7d4e00.
  - In Opia Dark, Music's coral buttons now have dark text instead of white; white on coral was 3.1:1.
  - The Record button's red is lighter.
  - Dim text inside selected photo cells now uses the normal text colour.
- Names for screen readers: every slider, text box, dropdown and colour picker now has a name. Most are given directly; the new `web/js/a11y.js` takes the rest from the label next to them. Buttons that show only a symbol (×, ↶, ⏮) are named from their hover text. Photo thumbnails are described by their file name, the print and web preview frames have titles, and the canvases are named. Aria-labels are translated into Spanish like titles are.
- Page structure: a navigation landmark for the menus, a banner for the top bar, a main area with a hidden "Opia" heading, regions for the filmstrip and tether bar, and a live region so messages are read out (errors as alerts).
- Keyboard:
  - Everything that responds to a click can now be reached with Tab and pressed with Enter or Space. This is done once in `h()` in `core.js`, so it covers every workspace.
  - A visible focus ring shows where the keyboard is.
  - F10 jumps to the menu bar. Left and Right move between menus; Enter or Down opens one. Up, Down, Home and End move through the items, Enter picks one, and Escape or Left closes it and returns focus.
  - Dialogs are announced as dialogs, put focus on the first field (or the main button), keep Tab inside the dialog, and return focus to where it was when they close.
  - The Trackpad switch is a real switch that can be reached by keyboard.
- Image: the tool buttons say which one is selected and name their shortcut key. The layer list is a list: Up and Down pick a layer, Space shows or hides it, Alt+Up and Alt+Down move it. The colour squares have names.
- Video:
  - Timeline clips can be reached with Tab and are read as, for example, "Video clip.mp4, from 0:02, 4.0 seconds". Enter picks one (Shift+Enter adds it to the selection).
  - Alt+Left and Alt+Right move the selected clips by a frame (with Shift, by a second).
  - Enter on an item in the media list adds it to the timeline.
  - The timeline and PDF page areas are labelled regions.

**Limits, honestly**
- Automated checkers like axe find roughly a third to a half of real accessibility problems. Nothing was tested with an actual screen reader (NVDA, Narrator or JAWS) or in the Windows exe.
- Painting, selecting, cropping and placing things on the picture are mouse, pen or touch actions. Keyboard users can move layers, transform them with the arrow keys and run every command from the menus, but cannot paint or draw freehand. The same goes for drawing on PDF pages and for trimming video clips by dragging (clip length can be typed in Details instead).
- Most hover-help cards are still English-only, as before.
- The sweep runs each command once, from a default state. It is not a test of every option inside every dialog.

## Icons for Image and Video (cloud session, 2026-10-15)

Three icon options were drawn for each workspace in the style of the existing ones (dark tile, cream ring, one coloured accent). You picked **Image C (crop marks)** and **Video B (film strip)**.

**Added**
- `web/img/opia-image-icon.svg`: the Opia ring and dot inside four violet (#B57CFF) crop corners.
- `web/img/opia-video-icon.svg`: the Opia ring with an amber (#FFB020) dot, between two rows of film sprocket holes.
- Each icon is shown on its workspace's welcome screen, the way the PDF icon is.
- The top-bar logo changes with the workspace: in Image, the crop corners appear around the ring and the dot turns violet. In Video, the sprocket holes appear and the dot turns amber. These are extra shapes in the `#brand` logo in `web/index.html`, shown by CSS.
- Accent colours: violet for Image and amber for Video, replacing the default blue. Buttons, the workspace switch, selected items and section headings use them. The light themes (Porcelain, Lilac) use darker versions (#8A4FE0, #D98A00) so the colours keep their contrast.

**Tested**: screenshots in headless Chromium of both welcome screens and the top bar in Opia Dark, and the top bar in Porcelain; no page errors.
**Not tested**: the Midnight Teal and Lilac themes, and the packaged exe. No new packages; the icons ship inside `web/`, which the exe already includes.

## Video workspace (cloud session, 2026-10-15)

A new **Video** workspace on the top-bar switch (Photos | Image | Video | Music | PDF): a timeline editor that exports MP4.

**Added**
- `web/js/video.js` (new): projects (new, open, rename, delete; saved automatically a moment after each change), a media list, a preview with transport (play / pause, start, previous / next edit, time), a details panel, and the timeline.
- Timeline: video and audio tracks (add, rename, delete, hide, mute, track volume), clips that move along and between tracks with snapping (Alt places freely), trimming from either end (limited to the length of the file), split at the playhead (S), delete, delete and close the gap, duplicate, select all, crossfade with the clip before, detach a video clip's sound onto an audio track. Ruler scrubbing, zoom (Ctrl+wheel, slider, Show All), resizable timeline height, thumbnail strips on video clips and waveforms on sound.
- Clip settings: start, length, in point, fade in / out (picture and sound), crossfade, volume (0-200%), mute, fit or fill, and in Advanced size, position and opacity (picture-in-picture). Titles: text, typeface, size, colour, bold, position (top, centre, bottom, lower third), dark box.
- Project settings: size presets (1080p, 720p, 4K, square, vertical, 4:5) or custom, frame rate, background colour. The first video put on an empty timeline sets the project's size and frame rate.
- Import: file picker or drag and drop (files without a known location are copied into the project's `Media` folder as they arrive, without loading them into memory), Import from Disk (Advanced), and Add Selected Photos / Photos > *Make a Video from Selected Photos* (4 s each with 0.5 s crossfades, rendered with their Develop edits).
- Export: MP4, H.264 + AAC, project size or 1080p / 720p / 480p, three qualities, with progress and cancel in the activity area. Save Frame as Picture, Edit Frame in Image Editor.
- Preview copies: files the window cannot decode (AVI, WMV, HEVC, 10-bit or 4:2:2 H.264, larger than 4096 px, unknown audio codecs...) get a 720p H.264 copy in `Pictures\Opia\Video\.cache`. If a file that should play fails anyway, the copy is made then. Export always reads the original.
- `server/video.py` (new): finding ffmpeg (config.json `"ffmpeg"`, then imageio-ffmpeg, then the PATH), reading what a file holds, preview copies, thumbnail strips (one ffmpeg run per strip), waveforms (cached), projects, the export filter graph, and `video_ffmpeg` for the About box. On Windows ffmpeg runs without a console window.
- `server/app.py` / `server/core.py`: files can now be served with HTTP byte ranges (`FileRef`), which the browser needs to seek in audio and video, and streamed uploads (`/api/stream/...`) that write to disk as they arrive.
- Help > About now also says which FFmpeg is in use. Tour says five workspaces. Spanish strings for the Video workspace's labels, buttons, dialogs and menus (hover help is English only).
- README: Video section, the FFmpeg licence note, and the new `imageio-ffmpeg` requirement.
- Icon: added later the same day, see "Icons for Image and Video" above.

**FFmpeg licence**: imageio-ffmpeg's Python code is BSD-2-Clause. The ffmpeg program inside it is not covered by that: on Linux it is a GPL v3 build (checked: `--enable-gpl --enable-version3`, includes x264). The Windows one is very likely the same kind of build; check with `ffmpeg -version`. Fine for personal use; if `Opia.exe` is ever given to other people with that ffmpeg inside, the GPL's terms apply to the ffmpeg part. The README says this too.

**Tested** (headless Chromium on Linux, real server, Playwright; and the export graph run directly):
- Reading files: H.264 MP4 with AAC, MPEG-4 AVI (flagged for a preview copy, copy made), MP3, JPEG; VP9/Opus WebM.
- Putting clips on tracks, the project taking the first video's size and frame rate, crossfade (clip moved back 1 s, marked), title added and its text typed, split at 2 s (in points correct), trimming the end of a sound clip and moving a picture with the mouse, snapping, undo.
- Playback with a WebM clip: at 2.2 s on the timeline the right clip was playing at 2.20 s in its file, the picture was drawn, the sound clip was playing.
- Export from the UI to 640 × 360 (13 s) and, separately, a 1280 × 720 export whose frames were checked by eye: fade in from black, title over video, crossfade between two clips, fill vs fit, picture with fade out, and rising sound level during a fade in.
- Byte-range requests (206 with the right Content-Range), streamed import through the file picker, the photo slideshow from the catalog, reloading a saved project, Beginner / Advanced, Spanish, every menu; no page or console errors.

**Not tested**
- Anything inside the packaged `Opia.exe` / WebView2 window on Windows, including Windows paths. **H.264 playback in the preview could not be tested here**: the Chromium used for testing has no H.264 decoder (WebView2 / Edge does), so H.264 clips (and the H.264 preview copies) only showed as "cannot be shown in the preview" in testing. Export of H.264 sources was tested and works.
- Long or large files (hours, 4K), many tracks at once (preview smoothness), phone videos with rotation metadata, variable frame rate footage, files with several audio streams, and the speed of thumbnail strips on big files.

**Packaging (needs doing on the PC)**:
1. `pip install imageio-ffmpeg` on the PC.
2. Rebuild with one more flag so the bundled ffmpeg goes into the exe: `--collect-all imageio_ffmpeg`. The full command becomes:
   `python -m PyInstaller --noconfirm --onefile --windowed --name Opia --icon web/img/opia.ico --splash web/img/opia.png --add-data "web;web" --add-data "models;models" --add-data "plugins;plugins" --collect-submodules PIL --collect-all webview --collect-all soundfile --collect-all _soundfile_data --collect-all pillow_heif --collect-all pypdfium2 --collect-all pypdfium2_raw --collect-submodules pypdf --collect-submodules cryptography --collect-all imageio_ffmpeg`
   (that is the base command from the notes plus the last flag; if the PC's saved command has other flags, keep them and add this one).
3. Expect the exe to grow by roughly the size of ffmpeg (tens of MB). The one-file exe unpacks ffmpeg to a temporary folder at start-up; that worked for the other bundled binaries.

## Image workspace (cloud session, 2026-10-15)

A new **Image** workspace on the top-bar switch (Photos | Image | Music | PDF): a layered picture editor.

**Added**
- `web/js/image.js` (new): the editor. Layers (pixel, text, shape) with visibility, opacity, 16 blend modes, drag to reorder, rename, duplicate, delete, merge down, merge visible, flatten, turn into pixels.
- Tools: move (Ctrl-click picks the layer under the pointer, arrow keys nudge), rectangle and oval selections, lasso, magic wand, brush and eraser (size, hardness, opacity, pen pressure, Shift-click straight lines), fill bucket (tolerance, contiguous, sample all layers), gradient, eyedropper, text (editable, font / size / bold / italic / alignment / colour), shapes (rectangle with optional rounded corners, oval, line, arrow; editable), crop, hand. Space-drag and middle-drag pan; the wheel zooms (Trackpad mode: two fingers pan, pinch zooms).
- Selections: new / add / subtract / overlap (Shift and Alt as shortcuts), invert, feather, select layer pixels, fill, delete, copy, cut, paste, copy merged, layer via copy / cut, crop to selection. Marching-ants outline.
- Free Transform (Ctrl+T): corner handles resize (Shift stretches freely), drag outside turns (Shift snaps to 15°), drag inside moves. Text and shape layers keep a transform and stay editable; pixel layers are resampled when applied.
- Image menu: image size, canvas size (with anchor), rotate 90° / 180°, flip, crop to selection, trim empty edges.
- Adjustments with live preview, limited to the selection if there is one: brightness / contrast, levels (with histogram), curves (per channel, monotone curve), hue / saturation / lightness (with colorize), colour balance, auto tone, black & white, invert, posterize, threshold. Filters: blur (edges do not fade), sharpen (unsharp mask), add noise, pixelate.
- Undo / redo of every step (whole states that share layer canvases; a canvas is copied only when it changes; capped at about 60 steps or a rough memory budget).
- Files: opens PNG, JPEG, WebP, GIF, BMP directly in the browser; TIFF, HEIC and RAW go through the server. Paste a picture from the clipboard, drop files on the window (onto an open picture they become new layers), File > Place Picture as Layer.
- Export Picture: PNG, JPEG, WebP or TIFF, quality, optional downscale, optional "add to the Photos catalog".
- Projects: `.opiaimg` = a zip holding `project.json`, one PNG per pixel layer and a `preview.png`. Text and shape layers are stored as their settings and redrawn on open.
- Photos: *Photo > Edit in Image Editor* (both modes) opens the selected photo with its Develop edits applied (it uses the same renderer as Export). Exporting such a picture defaults to adding it to the catalog.
- Beginner / Advanced: Beginner hides Oval Select, Gradient, Eyedropper and Hand (choosing one switches to Advanced), blend modes, Merge Down / Flatten buttons and the longer menus. Menus: File, Edit, Image, Layer, Select, (Filter in Advanced), View, Help.
- `server/imageedit.py` (new): `/img/imgfile` (a file on disk in a form the browser can draw), uploads `image_decode`, `image_export`, `image_project_save`, `image_project_upload`, and `image_project_open`. Registered in `server/app.py`.
- Spanish strings for the Image workspace's labels, buttons, hints, dialogs and menus (hover-help cards are English only, as in the PDF workspace).
- Tour: the workspace step now says four workspaces and describes Image. README: new Image section and honest limits.
- Tool icons in the toolbox are plain line glyphs drawn in CSS (move arrows, brush, crop marks...), not brand artwork. The workspace icon was added later the same day, see "Icons for Image and Video" above.

**Tested** (headless Chromium (Playwright build 1194) on Linux against the real Python server, scripted with Playwright):
- Opening a JPEG; brush stroke changes the right pixels; rectangle selection + Ctrl+J; moving a layer; Multiply blend; text layer typed and named after its first line; multi-line text; changing text size / bold from the options bar; shape layer; Free Transform rotate + scale on a shape layer (matrix checked); undo twice / redo twice restores layers and the transform.
- Magic wand finds the right area; fill selection; Hue / Saturation and Curves dialogs (dragging a curve point) and OK; every other adjustment dialog opens and cancels; auto tone, invert, black & white.
- Rotate 90° both ways, flip, canvas size, crop, undo of crop, image size, undo.
- Lasso + Ctrl+C + Ctrl+V pastes in place; eraser makes pixels transparent; gradient end colours; layer opacity.
- Export PNG and JPEG through the server; export with "add to catalog" adds one photo; project save, then reopen: same layers, kinds, blend modes, positions and sizes.
- Photos > Edit in Image Editor on an imported photo with Develop exposure and saturation edits: the editor gets the edited pixels.
- Beginner and Advanced layouts, Spanish, every menu opens; no page errors or console errors during the runs.

**Not tested**
- Inside the packaged `Opia.exe` / pywebview window on Windows, and with Windows paths (the save dialogs build paths with `\`). Drag-and-drop of real files, the system clipboard (paste from another app, and whether Copy reaches the Windows clipboard), pen pressure, HEIC / TIFF / RAW opening, very large pictures (memory and speed), and the light themes.
- Whether `file.path` is available for files picked in the pywebview window (if it is not, opening still works by uploading the file, but "Save" defaults to the export folder instead of the picture's folder, and the file is not added to Opened recently).

**Packaging (needs doing on the PC)**: rebuild `dist\Opia.exe`. The Image workspace needs no new Python packages; see the Video entry above for the one new PyInstaller flag.
