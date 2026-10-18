# Opia for Android

A phone version of Opia with four workspaces, built for touch: **Lens**, **Imagine**, **Folio** and **Groove**. Everything runs on the phone; the app has no internet permission at all.

| Workspace | What it does on the phone |
| --- | --- |
| **Lens** | Bring in photos with the phone's photo picker. Rate them, mark favourites, filter. Develop them: exposure, contrast, highlights, shadows, whites, blacks, warmth, tint, vibrance, saturation, fade, vignette, sharpen and grain, plus ten filters, crop with fixed ratios, rotate, flip and straighten. Hold the photo to compare with the original. Edits are kept as settings, so the original never changes. *Save copy* writes the developed photo to `Pictures/Opia`. |
| **Imagine** | Start from a page size (square, post, story, wide) or a photo (from the phone or from Lens). Add photos, text (five fonts, colours, a label behind it), stickers and drawings, each on its own layer. Drag to move, pinch to resize and turn. Layers can be hidden, reordered and faded. Pictures save as you go, and export as PNG or JPEG to `Pictures/Opia`. |
| **Folio** | Open a PDF. Fill in its form, sign with your finger (signatures are kept for next time), add text, highlights and drawing, and turn, reorder, copy or delete pages. Save to `Download/Opia` or share. *Revert* goes back to the PDF as you opened it. |
| **Groove** | The desktop app's music engine, with real instrument samples. Pick a style and Opia writes drums, bass, chords and melody that fit together; then change any part on a grid of steps, swap instruments, and record your voice over the top. Save as WAV to `Music/Opia`. |

The app is in English and Spanish, follows the phone's light or dark mode (or you can choose), and is built for screen readers: every control has a spoken name, and an automated accessibility check (axe-core) passes in both themes. It has not yet been tried with TalkBack on a real phone.

## Installing

The newest build is always at **https://github.com/kanisakhpara-devs/Opia/releases/download/android/Opia.apk** (the *android* release on the Releases page). Open that link on the phone, then open the downloaded file. Android will ask once to allow installing apps from your browser or file manager. It needs Android 10 or newer.

It is not on the Play Store, so Play Protect may warn that it does not recognise the app. That is expected for any app installed this way.

## How it is built

- `www/` is the app itself: plain HTML, CSS and JavaScript, the same way the desktop app's front end is written.
- `assemble.py` copies `www/` to `build/www` and adds what is shared with the desktop app: the music engine (`web/js/music-engine.js`), the instrument samples (`web/samples`), the fonts and the workspace icons. One copy of each, so a fix to the music engine reaches both apps.
- `android/` is a small Android app (Java, no libraries beyond Android itself) that shows `build/www` in a WebView. It serves the files from inside the APK at `https://appassets.androidplatform.net`, so the page counts as secure (storage and the microphone need that). It also handles the photo picker and file picker, saving to the gallery through MediaStore, sharing, the microphone permission and the back button.
- PDFs are shown with [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174 (Apache 2.0, run with `isEvalSupported: false`) and changed with [pdf-lib](https://pdf-lib.js.org/) 1.17.1 (MIT). Both are in `www/vendor` with their licences.

GitHub builds the APK (`.github/workflows/android.yml`) whenever anything in `mobile/`, the music engine or the samples changes on `main`, and puts it on the *android* release.

To build it yourself: install Android Studio (or the Android SDK and JDK 17) and Python 3, then run `gradlew assembleRelease` in `mobile/android`. To try the app in a browser instead, run `python assemble.py` and serve `mobile/build/www` (for example `python -m http.server -d mobile/build/www`).

## Signing

An Android app has to be signed, and each update has to be signed with the same key as the copy already installed.

Until you set up your own key, builds are signed with `android/opia-public.jks`, a key that is deliberately public (its passwords are in `app/build.gradle`). Every build then installs over the previous one. The catch is that anyone could sign an app with the same key, so do not install an "Opia" APK from anywhere except this repository's Releases page.

To switch to a private key, add four repository secrets (Settings → Secrets and variables → Actions):
`OPIA_KEYSTORE_BASE64` (the keystore file, base64), `OPIA_KEYSTORE_PASSWORD`, `OPIA_KEY_ALIAS` and `OPIA_KEY_PASSWORD`. The next build uses it. Because the key changes, that one time you need to uninstall the old app first, which removes its photos, pictures, PDFs and songs; save anything you want to keep first.

## Limits

- **Photos:** JPEG, PNG, WebP, GIF and AVIF. HEIC photos and RAW files open only if the phone's WebView can decode them; most cannot.
- **PDFs:** text you add uses Helvetica, which covers Western European letters; others are left out, and the app says so. PDFs locked with a password can be viewed but not changed. Marks are written into the page when you save; page changes write in marks added so far.
- **Groove:** the voice recording is lined up using the latency the phone reports, which is close but not exact on every phone. Wear headphones, or the music is recorded too.
- **Storage:** everything lives in the app's own storage on the phone. Uninstalling the app or clearing its storage deletes it. Saved and shared copies in Pictures, Music and Download stay.
- There is no video editor (Motion) on the phone yet, and nothing syncs between the phone and the desktop app.
