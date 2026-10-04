# REDI — Development Data, API Switch, and Protected Downloads

Paste this prompt **after the REDI React Native CLI master prompt**, or give it to the coding assistant working on that project. Keep the original HTML design attached.

This addendum takes precedence over conflicting instructions in the earlier prompt. In particular, it replaces external PDF/video download, sharing, printing, and external-viewer behavior with **offline viewing inside the REDI app only**, including admit cards and certificates.

---

## 1. Implement these requirements

Extend the REDI React Native Community CLI application with:

1. Complete, realistic dummy data for development across the existing 32 screens and their supporting flows.
2. A clean mechanism that removes the development dataset and switches the application to real APIs when I later say **“Remove all dummy data.”**
3. An API-only production data flow. Courses, course details, lessons, resources, admit cards, and certificates are created or issued through the separate admin portal and exposed to the app by the separate backend.
4. Protected offline PDFs and videos that can be opened only inside the app's own reader/player. Do not save usable copies in public Downloads, Files, Gallery, an SD card, or another app.

Build the mobile implementation and its integration boundaries. Do not build the admin portal or backend. Define missing server/provider requirements for the other developer and report dependencies honestly.

Preserve the REDI design, navigation, TypeScript architecture, and existing business flows, except for the explicit changes to protected-content controls below.

The security objective is to prevent ordinary file-manager access, export, and use by other apps on supported, uncompromised devices, with encryption and DRM limiting extraction of copied files. Do not claim absolute protection against a rooted/jailbroken device, an instrumented application, an OS vulnerability, or somebody filming the display with another camera.

## 2. Keep development data isolated

### 2.1 Two explicit data modes

Use a single typed configuration:

```ts
type DataMode = 'mock' | 'api';
```

During development, `mock` selects development repositories. `api` selects the real repositories. The production/release build always uses `api`. A missing or invalid mode must never silently enable mock behavior.

Bind repositories once at application composition. Screens use the same query hooks and domain models in either mode. Do not put `if (mock)` conditions, sample arrays, sample learner objects, or fake API responses directly inside screen components.

Keep application business data flowing through repositories even in development. Use the same response schemas, pagination shapes, state transitions, and error model as the real integration wherever its contract is known.

**Never fall back from an API error or empty response to dummy data.** In API mode:

- No courses returns the designed empty state.
- No issued admit card returns “Not issued yet.”
- No certificate returns the appropriate unavailable/pending state.
- Missing API configuration shows a connection/configuration state suitable for that build.
- Network failure shows retry/offline behavior and only permitted previously fetched API cache.
- Invalid, expired, or revoked access never becomes sample access.

Use separate build entry/dependency paths so release bundles cannot include the mock implementation or mock assets. A disabled button or a runtime `__DEV__` condition alone is not proof that the packager excluded them. Verify the generated bundle and native assets.

### 2.2 Organize removable source data

Use clearly owned, removable locations, adapted to the existing project:

| Location | Contents |
| --- | --- |
| `src/mocks/data/` | Fixture records for the REDI development dataset |
| `src/mocks/repositories/` | Mock repository implementations |
| `src/mocks/scenarios/` | Deterministic success, empty, pending, and failure scenarios |
| `src/mocks/assets/` | Demo-only PDFs, videos, thumbnails, avatars, and document artwork |
| `src/mocks/devtools/` | Development scenario controls and mock account selection |
| `scripts/devdata/` | Setup, validation, source cleanup, and verification scripts |
| `src/core/migrations/` | Small retained cleanup migration, with no fixture payloads |
| `docs/development-data.md` | Mode selection, source ownership, cleanup instructions, and results |

Do not duplicate dummy content into `constants`, shared UI components, theme files, fallback API responses, or native resource folders without recording those copies in the removal manifest.

Generate a manifest of exact mock-owned paths, runtime namespaces, asset IDs, and fixture dependencies. Deletion must use this explicit ownership information; never recursively delete a generic folder merely because its name contains “data,” “downloads,” or “cache.”

Keep real brand assets, fonts, icons, neutral image placeholders, loading skeletons, translations, and empty-state copy separate from removable business data. Keep the user's original reference HTML as design documentation outside the production dependency graph; do not delete their supplied design file.

### 2.3 Isolate runtime state

Namespace every persisted mock record by mode, schema version, and mock account. For example:

```text
redi:mock:v1:learner-demo-001:...
redi:api:v1:<account-id>:...
```

Use equivalent separation for query-cache persistence, local databases, file manifests, native download jobs, secure-storage aliases, pending work queues, notification records, bookmarks, playback positions, and temporary assets.

All mock records have trustworthy local provenance such as `source: 'mock'`, a dataset version, and stable IDs such as `mock_course_001`. Do not infer provenance from a display name like “Tally” or “Deepak”; those names could also exist in real data. Do not send mock-only provenance fields to real APIs.

Mock login credentials, OTP flows, purchases, certificates, review decisions, and notification actions stay inside the mock adapters. They must never hit a production endpoint, submit a real payment, register a mock user for real push messages, or upload a demo document into the admin system.

Use development build identifiers/schemes where practical. A cleanup command for one development installation must not wipe a separate production installation.

## 3. Dummy-data coverage and behavior

Provide enough data to exercise the complete app, not just fill a home screen:

| Area | Required development records/scenarios |
| --- | --- |
| Account | Guest, new learner, active learner, mock login/recovery, profile and preferences |
| Home | Live banner, discovery sections, continuing lessons, notifications |
| Courses | All 16 reference catalogue entries, free/paid/purchased states, details, overview, instructor, reviews |
| Curriculum | Lessons, durations, valid next-lesson IDs, resources, Q&A, completed/current/locked rows |
| Competitive exams | All 13 reference categories, syllabus, tests, question/option IDs, marking rules |
| Assessments | New/resumed/submitted attempts, timed and practice modes, coherent results and solutions |
| News and awareness | Seven news categories, feeds/articles, 16 awareness topics with appropriate structured content |
| Facts and interview | Four facts categories, fact details/reactions, six interview categories, question readers/practice |
| Learning | Enrollments, bookmarks, realistic progress, streak summaries, attempt history |
| Semester courses | Sequential semesters, required tests/projects, review pending/approved/rework states |
| Live classes | Scheduled/live/ended/cancelled sessions, chat fixtures, reminders, recording states |
| Payment | Development-only pending/success/cancel/failure and delayed-access cases; no real charges |
| Documents | Not-issued/issued/revoked admit cards and certificates tied to the correct mock learner |
| Downloads | At least one playable sample video and a multi-page sample PDF, plus paused/failed/expired cases |

Use synthetic personal information and deterministic data. Mark demo admit cards and certificates **“DEMO — NOT VALID”** so they cannot be mistaken for issued qualifications or exam authorization. Use clearly fake IDs; no production signatures, verification claims, payment references, or real learner information.

Use coherent relationships and calculations. Completed counts must match fixture lessons; results must match fixture attempts; purchased products must map to explicit entitlements. Use a seeded clock/scenario definition where reproducibility matters, rather than unrelated random values on each render.

Mock mutations should work: saving a bookmark changes My Learning, lesson completion updates the corresponding fixture progress, a mock purchase changes only mock access, and a simulated admin approval updates the fixture semester state. Put any simulated admin event control in development tools, never in learner-facing production screens.

Use actual safe sample media to test local reading/playback. A spinner that eventually says “Downloaded” without storing a readable/playable file is not a completed download implementation. Sample media must use the same private-storage and reader/player boundary as real content, with explicitly labeled test licenses or test encryption. A simulated license test does not verify production DRM.

## 4. The future command: “Remove all dummy data”

### 4.1 What this instruction means

When I later tell the coding assistant **“Remove all dummy data,”** treat that as an instruction to execute the complete cleanup and API transition below. It is a developer workflow command, not an in-app chat/NLP feature.

**Do not remove the dataset now.** First implement the development dataset, its isolation, and the removal mechanism. Run full removal only when I give that later instruction.

Provide one documented project command, for example:

```bash
npm run devdata:remove
```

That command, supported by the coding assistant for any necessary source edits, must do more than flip an environment flag. Implement an optional manifest-based dry-run for inspection, but do not repeatedly ask for approval to remove the exact mock-owned scope once I have requested its removal.

### 4.2 Required cleanup sequence

1. **Stop mock activity.** Cancel mock queries, timers, realtime subscriptions, downloads, queued writes, notification schedules, and delayed callbacks. Advance the mode/session generation so late mock responses cannot repopulate state.
2. **Identify mock-owned data.** Use the explicit source manifest and runtime namespaces. Preserve real API records and real user content. Report ambiguous legacy ownership instead of deleting unclassified data.
3. **Clear stored mock data.** Delete mock query caches, database rows/files, mock sessions/tokens, mock entitlements, bookmarks, attempts, receipts, document metadata, media files, decrypted caches if any, demo thumbnails, partial downloads, pending sync operations, and mock encryption/license material.
4. **Clean development notifications.** Cancel locally scheduled mock notifications and remove mock notification records. Never send mock cleanup operations to the production backend.
5. **Remove source datasets and assets.** Delete the development fixture records, mock repository/scenario implementation, seeded business data, demo media/documents, and demo-only native assets from the active project according to the manifest.
6. **Repair composition and imports.** Remove mock exports, imports, build aliases, dev-only controls, sample default values, mock account selectors, package scripts/dependencies used only by removed fixtures, and obsolete asset references. Preserve working UI, types, adapters, real API code, and actual application services.
7. **Select API-only operation.** Make real repositories the only app data implementation. Remove persisted mock-mode choices and runtime controls that could re-enable the dataset. Missing backend configuration must produce a clear failure state, not recreate fixtures.
8. **Retain an upgrade cleanup migration.** Before hydrating app state or rendering authenticated content, run an idempotent migration that clears legacy mock namespaces on previously used installations. Keep only the cleanup identifiers/version logic, not the mock payloads or reseeding code.
9. **Rebuild and inspect.** Clean project-generated stale bundles/assets as needed, rebuild applicable native artifacts, scan the production dependency graph and packaged resources, and verify that mock datasets/media and login bypasses are absent.
10. **Report the result.** List removed source areas and runtime namespaces, mode status, API connection results, build/test results, and devices on which runtime cleanup actually ran.

If the backend is not ready when removal is requested, still complete the authorized mock cleanup and switch to API-only behavior. Leave the designed empty/error states and typed integration boundaries in place. Do not restore sample content to make the screen look finished.

### 4.3 Scope and recovery details

- Cleanup must be idempotent: running it again should safely report no remaining mock data.
- Run the runtime migration before query persistence is restored; otherwise old dummy content can flash on screen or be written back to storage.
- Retain the migration until supported installations can no longer carry that legacy namespace. A completed migration marker does not restore a mock-mode option.
- Remove the original demo dataset from app source/assets. Preserve tests; where tests need data, use small test-local generated inputs excluded from the app, not the removed demo catalogue or media bundle.
- Preserve real API-derived offline downloads and valid account data when they can be identified. Purging mocks must not mean “delete the entire device's storage.”
- A source command cannot erase files from a disconnected phone or another installed app ID. Its app-local migration runs when that installation receives and launches the updated build; report that distinction.
- Removing active project/app data does not rewrite Git history, erase unrelated backups, or invalidate an already distributed old APK/IPA. Do not claim it does, and do not delete those historical/user-owned items without a separate request.
- Unlinking files is not a forensic secure-wipe guarantee on flash storage. Delete relevant mock keys as well as files where encryption is used, and describe only the cleanup actually performed.

## 5. All production content comes from the admin-managed backend

The learner app must never manage institute content locally as its source of truth.

| Content/action | Separate admin/backend responsibility | Mobile responsibility |
| --- | --- | --- |
| Course catalogue | Create/update/publish/archive courses and set ordering/access | Fetch, filter, display, cache API responses |
| Course details | Manage descriptions, instructors, prices, syllabi, semesters and rules | Render returned detail and access state |
| Lessons/videos/PDFs | Upload, process, encrypt/package, authorize, version and publish | Request access, play/read, save protected offline copies |
| Enrollments and progress | Validate access and learning completion | Report allowed progress and display confirmed results |
| Semester verification | Review, reject/approve and unlock next semester | Show status and refresh after server changes |
| Admit cards | Issue official data/PDF, assign to learner, revise or revoke | Fetch learner-specific metadata and show/save internally |
| Certificates | Issue official certificate/PDF/signatures/verification data | Read-only preview and protected internal access |

An admin-issued PDF is not generated by the mobile app from a locally completed course. Development demo documents are the only exception, stay in the removable mock layer, and are visibly non-official.

After the transition, Home, Course Detail, My Learning, Downloads, Admit Card, and Certificate must share real IDs, revisions, and access status. Refetch relevant data after admin updates using focus refresh, explicit refresh, or backend events. A push message signals a refresh; it does not grant access by itself.

The mobile app calls backend APIs. It does not scrape the admin website, connect directly to the database, use an admin token, or embed storage/service secrets.

## 6. Protected downloads: the exact product rule

For every protected downloadable PDF or video:

- “Download” means **save an authorized offline copy inside REDI**.
- Open it only through REDI's own native PDF reader or video player.
- Do not create a usable plaintext file in public/shared storage.
- Do not expose Share, Export, Print, Open With, Save to Files, Save to Gallery, AirDrop, or external-player actions.
- Do not copy a file URI, signed download URL, raw document body, media bytes, or decryption material to the clipboard or logs.
- Do not use a public/external viewer as a fallback when internal playback or rendering fails.
- Do not expose a file-serving localhost endpoint, exported Android content provider, granted file URI, or iOS document-sharing interface for these assets.
- Reject a backend instruction that would enable export for this protected resource class. The server may further restrict access but cannot silently relax this app requirement.

This includes course PDFs, downloaded videos, admit cards, certificates, and any receipt PDF downloaded within the app. Audio or other protected attachments should follow the same storage/access policy; if a format has no safe internal viewer, do not download it for external opening.

Public news/fact text sharing may remain where already supported, but it must never include a protected document/media file, an access token, or a private asset URL. Document verification links must not expose the protected original PDF as a side effect.

### 6.1 Required changes to the original screen controls

| Existing reference action | Updated action |
| --- | --- |
| Lesson resource download | Save for offline → open REDI's internal reader |
| Video download | Save encrypted/licensed offline media → play in REDI |
| Admit Card “Download PDF” | Save for offline; show Offline Available after completion |
| Certificate “Download PDF” | Save for offline; open with REDI's certificate/PDF viewer |
| Admit Card/Certificate Share icons/buttons | Remove them; use the space for a relevant internal action only if useful |
| Receipt PDF download | View/save inside the protected document reader |
| Downloads file tap | Open the appropriate internal viewer after access validation |
| Downloads Manage | Select and remove local copies; never export files |
| External spreadsheet/resource opening | Use a supported internal renderer/preview from the backend or show format unavailable |

Preserve the original colours, typography, spacing, and card language while making these control changes. Do not retain a visible Share button that only opens a warning.

## 7. Private storage and key handling

### 7.1 Android

Store protected downloaded assets in the application's **internal private storage**, using a dedicated non-backed-up location such as `noBackupFilesDir` where suitable. Do not use external app directories, public Downloads, MediaStore, shared Documents, or removable storage for these resources. Internal app storage is isolated from other ordinary apps by Android. [Android app-specific storage](https://developer.android.com/training/data-storage/app-specific)

Use app-level authenticated encryption for PDF payloads and other non-DRM protected files, in addition to OS storage protection. Do not assume that changing a filename/extension or placing an ordinary PDF in a hidden folder encrypts it.

Keep encryption key operations behind native code and Android Keystore. Prefer an appropriately supported hardware-backed key when available; inspect actual support and define a documented device policy if it is unavailable. A Keystore key can remain non-exportable, but compromised app code may still invoke permitted key operations; this is not an absolute defense against a compromised process. [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

Exclude protected files, license material, document caches, and sensitive manifests from backup/transfer. Verify the supported Android backup and data-extraction configuration instead of relying only on `android:allowBackup="false"`, whose device-to-device behavior can vary. Test that restored data cannot recreate a usable protected copy. [Android backup rules](https://developer.android.com/identity/data/autobackup)

Do not export protected file/content providers or grant read URI permissions for these resources. If a native viewer needs a private descriptor, keep it process-local or non-exported and verify that no other app can open it. Do not request broad external-storage permission to make the download feature work.

### 7.2 iOS

Use an app-private location such as an appropriate Application Support subdirectory. Do not expose protected assets through the Files app, document browsing, iTunes/Finder file sharing, or document-interaction export interfaces.

Apply the appropriate iOS Data Protection class to encrypted files and sensitive metadata, and exclude re-downloadable protected assets from backup. Select a protection class compatible with the explicitly supported foreground/background download behavior and document the choice. [Apple file-protection types](https://developer.apple.com/documentation/foundation/fileprotectiontype)

Store non-DRM key material using suitable Keychain protection, a device-only/non-synchronizing policy, and native cryptographic APIs. Do not put raw keys in AsyncStorage, JavaScript constants, `.env`, application assets, or general state persistence. Do not claim arbitrary AES file keys automatically execute inside the Secure Enclave; use supported platform capabilities accurately.

Handle fresh-install/restore detection and account boundaries explicitly. Do not rely on uninstall alone to remove every Keychain item. If protected content is restored without its matching installation/account authorization, reject access and reacquire it through the backend.

### 7.3 Encrypted file format and lifecycle

Use a maintained, reviewed authenticated-encryption implementation and established container format, such as an appropriate AES-GCM-based design. Do not design a new cipher or concatenate unauthenticated encrypted chunks.

- Use cryptographically secure randomness and unique nonces for the chosen key/algorithm.
- Associate encrypted content with its resource ID, version, account, and installation policy so swapping file/manifest metadata does not grant access to another resource.
- For large assets and random access, use a supported authenticated streaming/chunked container. Authenticate chunks before rendering and bind their index/order and expected file identity. Verify that seeks and partial downloads are supported safely.
- Keep per-file keys or wrapped key records separate from encrypted payloads. A secret stored beside its encrypted file defeats the purpose.
- Keep cryptographic operations and sensitive plaintext off the JavaScript bridge where practical. Pass opaque resource/view handles to React Native instead of large base64 plaintext strings or raw keys.
- Use random/opaque storage names. Treat any file title, learner name, document number, thumbnail, first-page preview, or manifest as potentially sensitive metadata and protect it appropriately.
- Write encrypted partial files and atomically mark completed downloads only after integrity checks. A crash or cancellation must not leave an exported or persistent plaintext intermediate.
- Delete files and their associated local key/license references when the learner removes a download. Do not delete a shared key still required for another authorized asset without understanding its ownership.
- Reconcile orphaned partial files, lost keys, missing files, corrupted manifests, and stale download jobs at startup.

Copied encrypted bytes should not become a usable PDF/video simply by renaming the file or moving it into another player. Verify this explicitly; do not infer protection from the absence of a file extension.

## 8. Internal PDF reader

Implement a `SecurePdfViewer` and a native secure-document adapter. The viewer receives an opaque resource/document ID, asks the access service for permission, and renders the document internally.

Required behavior:

1. Resolve the active account, document version, issue/revocation status, and online or valid offline authorization.
2. Load only the associated protected payload.
3. Decrypt using native cryptographic operations and feed a compatible native renderer through protected in-process memory or a suitable private, nonpersistent seekable descriptor.
4. Support page navigation, zoom/pinch, page count, loading, corrupt-file errors, and offline-access-expired states.
5. Close reader handles and release sensitive buffers/caches when leaving, logging out, or losing access. Do not promise perfect zeroization of every OS-managed buffer; audit the chosen implementation and minimize plaintext lifetime.

**Verify the actual renderer's requirements.** Some PDF readers require a seekable local file and create disk caches. Do not assume a generic React Native PDF package can read encrypted bytes or a non-seekable pipe. If the selected library requires a persistent plaintext PDF, replace/extend it with an appropriate native implementation; do not silently decrypt to a normal temporary PDF.

Keep all renderer-generated page thumbnails, preview images, extracted text, search indexes, HTTP cache responses, and crash attachments in scope. Disable disk caching where possible or protect it equivalently. Do not use an online PDF-viewing service, Google Docs viewer, external browser, external document intent, or exportable Quick Look/document menu as a workaround.

Remove reader controls for export, share, print, opening in another app, and copying protected content. Apply these restrictions to hidden context menus and toolbar items as well as the primary buttons.

Use a subtle account/resource watermark where useful to discourage redistribution, without exposing unnecessary personal information. Watermarks and disabled copy buttons are deterrents, not encryption or screenshot prevention.

Official admit-card and certificate IDs, signatures, QR values, and PDF bytes still come from the admin-managed backend. The internal viewer must not regenerate official files or issue credentials itself.

## 9. Protected offline video

For production protected video, integrate a provider-supported DRM playback and offline-license workflow:

| Platform | Required integration direction |
| --- | --- |
| Android | Widevine through a compatible native Media3/ExoPlayer or provider SDK, with encrypted offline media and offline licenses |
| iOS | FairPlay Streaming through a compatible AVFoundation/provider integration, with protected offline HLS and persistent content-key handling |

Media3 supports DRM and offline key-set playback; FairPlay covers encrypted media and protected key exchange on Apple platforms. Verify the selected React Native bridge's actual offline support—basic streaming DRM support alone is insufficient. [Media3 DRM and offline keys](https://developer.android.com/media/media3/exoplayer/drm), [Apple FairPlay Streaming](https://developer.apple.com/streaming/fps/), [Apple persistent-key workflow](https://developer.apple.com/videos/play/wwdc2017/504/)

The backend/provider must supply properly packaged encrypted media, license-service integration, product/content IDs, learner entitlement checks, device/session policy, and allowed offline periods. The mobile developer cannot create production DRM merely by adding a JavaScript package or changing an MP4 filename. FairPlay production credentials also require the appropriate Apple approval/account setup.

The native download/player integration must support:

- Downloading the correct encrypted asset and all required authorized segments/tracks.
- Obtaining and storing an offline license through the provider's supported process.
- Resume, pause, cancel, retries, storage accounting, integrity checks, and content-version changes.
- Internal playback, pause/seek, quality selection when available, and progress callbacks.
- Expired, missing, revoked, renewal-required, and device-not-supported license states.
- Removal/release of local license data through the provider SDK when downloads are removed, with appropriate account-level coordination.
- Restricting casting, external playback, AirPlay, mirroring, and picture-in-picture for this app-only playback policy, to the extent the platform/provider supports them. Do not surface external playback controls.

A hidden MP4 path, expiring signed URL, AES-encrypted HLS without a protected key workflow, or client-side decrypt-then-save-MP4 is not equivalent to DRM.

If real DRM/provider configuration is missing, implement the adapter, development sample flow, and blocked/unavailable production state; report exactly what the backend/provider must supply. Do not publish protected offline video with an undisclosed plaintext fallback. Do not claim the integration was validated using only mock license responses.

## 10. Download authorization and offline access

Each download begins with a backend authorization check. Do not allow a guessed resource ID, edited route parameter, cached purchase flag, or existing local filename to bypass access.

Define mobile-facing contracts for these capabilities and map them to the existing backend. Any example endpoint names in documentation must be labeled proposed until the other developer confirms them.

| Capability | Information needed |
| --- | --- |
| Resource metadata | Stable resource ID, kind, content version, size, MIME type, title, parent course/document |
| Online entitlement | Account access, download permission, restriction reason, applicable expiry |
| Download session | Authorized short-lived delivery parameters, version/integrity metadata, allowed resume behavior |
| Offline authorization | Account/resource/version/device scope, validity period, license identifier or signed policy, renewal requirements |
| Protected video | DRM scheme, content identifier, encrypted playback/download information, license-service contract |
| Protected document | Authorized PDF delivery, encryption/key-envelope approach if supplied server-side, document issue/revocation metadata |
| Invalidation | Resource updated/removed, entitlement changed, document revoked/superseded, session/device deauthorized |

Do not rely on an editable local JSON field such as `expiresAt` as a trusted license. Verify signed offline authorizations with the pinned/rotatable public verification keys defined by the server contract, or use the DRM provider's license system. Never bundle a server signing/private key.

For offline documents, record the last trusted server time and use suitable monotonic-time checks while the process is running. Detect obvious clock rollback. Define a conservative reconnect requirement for cases such as reboot or unreliable time where the required expiry cannot be validated securely. Do not pretend a JavaScript clock makes offline expiration tamper-proof.

**Offline access and instant remote revocation cannot both be guaranteed.** A disconnected device cannot learn a new admin revocation until it reconnects; enforce the previously issued offline authorization window and revalidate at the required time. When authorization expires or cannot be validated, show “Connect to verify access” rather than extending it locally.

Revalidate when opening protected content online, on app foreground according to policy, after account changes, and after relevant backend events. A server-approved access response is required before reacquiring keys/licenses. Short-lived bearer URLs alone do not prevent playback outside the app if leaked; private delivery plus protected key/license handling is required for that stronger objective.

## 11. Logout, account change, and old downloads

On logout, explicitly stop protected readers/players, close their native handles, cancel pending protected downloads, clear account-scoped content caches, and remove that account's locally stored protected files and key/license references. The learner can download again after authenticating and regaining access.

If a provider's remote license-release request requires connectivity, invalidate/remove local playback capability immediately and queue only the permitted remote cleanup reference. Do not leave local access active until the network returns.

Account B must never open Account A's downloaded PDF/video, even if both accounts use the same device or a route points to A's file ID. Include account identity in storage and authorization checks. A current access token expiring temporarily is different from explicit logout; valid offline access can follow the separate documented offline-session policy.

For an existing implementation that already exported documents/media, remove export features and migrate app-owned accessible files to the protected model or remove them and require a fresh protected download. Do not claim the app can retract copies already saved/shared outside its sandbox. Report those legacy limitations rather than scanning/deleting unrelated user files.

## 12. Screenshot, recording, and display controls

Use available supported platform protections for protected viewer/player screens, without private APIs or misleading guarantees.

- **Android:** apply `FLAG_SECURE` to protected windows and ensure it remains active across fullscreen playback, modals, activity changes, and app-switcher snapshots. Test screen capture and non-secure display behavior on supported devices. This is a mitigation with platform limitations, not a universal anti-extraction mechanism. [Android secure windows](https://developer.android.com/security/fraud-prevention/activities)
- **iOS:** use the current supported scene/screen capture-state APIs for the target SDK, pause/cover protected content during active recording/mirroring where detectable, and cover app-switcher snapshots. Follow supported native lifecycle behavior. Apple's capture guidance describes detection and pausing, with FairPlay protection for video and separate audio considerations. [Apple screen-capture guidance](https://developer.apple.com/library/archive/qa/qa1970/_index.html)
- Do not promise universal prevention of ordinary iOS PDF screenshots. A screenshot notification received after capture cannot undo the screenshot. Do not use unsupported secure-text-field/private-view tricks and claim they provide a documented guarantee.
- Protect sensitive thumbnails and the whole protected document preview, not just the embedded PDF/video surface.
- Do not request camera/microphone permissions merely to protect downloads.

Explain these limits in technical delivery documentation. Ordinary product copy should simply say **“Available offline in REDI”** and **“View in app.”** Do not advertise the app as “unhackable” or “100% copy-proof.”

## 13. Shared service boundaries

Keep the implementation maintainable. Add narrow services rather than making every screen manage files and keys:

| Service/module | Responsibility |
| --- | --- |
| Repository composition | Select mock or API dependencies during development; API-only after removal |
| Development-data manifest/cleanup | Identify and remove only mock-owned source and runtime records |
| Legacy-data migration | Purge stored mock namespaces before app hydration after the switch |
| `ContentAccessService` | Resolve online access and validate permitted offline authorization |
| `SecureDownloadService` | Authorize, queue, download, pause/resume/remove, track protected files |
| `ProtectedFileStore` | Native encrypted storage, integrity, protected metadata, safe file lifecycle |
| `SecureDocumentService` | Open/close protected native PDF rendering handles |
| `ProtectedVideoService` | Native DRM/player/download integration and offline-license lifecycle |
| `CaptureProtectionService` | Native viewer/player capture and background-snapshot controls |

Public service calls should take resource/account IDs and return states or opaque handles. Do not expose raw decryption keys or public plaintext file paths to UI components. Native modules must validate their input and restrict access to registered app-owned resources; a generic native “decrypt any filesystem path” API is inappropriate.

Use explicit states such as `authorizing`, `queued`, `downloading`, `paused`, `verifying`, `availableOffline`, `licenseExpired`, `unavailable`, and `failed`. Clear error messages must explain retry, re-login, reconnect, or re-download without revealing private URLs/keys.

## 14. Acceptance tests

Implement and run meaningful verification for the actual integration. Mock tests alone do not prove native storage, backup, capture, PDF-reader, or DRM protection.

| Test | Expected outcome |
| --- | --- |
| Development dataset | All 32 screens and major flows use coherent removable mock records |
| Mock side effects | No production requests, real purchases, real uploads, or real push registration occur |
| Full removal | Source fixtures/assets and runtime demo records disappear; API repositories remain |
| Removal twice | Second cleanup is safe and does not touch real account data |
| Late callback during cleanup | No dummy cache, file, bookmark, or session is recreated |
| Upgrade from a demo build | Cleanup runs before state hydration; no old demo profile/content flashes |
| API returns empty/errors | App shows matching states and never inserts dummy values |
| Source/native asset audit | No demo media, certificate, catalogue dataset, mock session bypass, or re-enable control in production artifacts |
| Download PDF/video | Usable only inside REDI's reader/player under a valid authorization |
| Browse ordinary storage | Protected copies are absent from Downloads, Files, Gallery, shared folders and removable storage |
| Copy ciphertext in an authorized test build | A generic PDF reader/media player cannot use the copied encrypted bytes |
| External intents/menus | No Open With, export, file Share, AirDrop, Print, or clipboard route exposes protected assets |
| Viewer cache audit | No persistent plaintext PDFs, extracted pages/text, thumbnails, media segments, or crash attachments escape the protected store |
| Interrupted download | Partial data remains encrypted; resume verifies resource version/integrity |
| Tampered file/manifest | Integrity or identity failure prevents rendering; a clear re-download state is shown |
| Offline valid license | Previously authorized content opens inside REDI without network access |
| Expired/offline invalid license | App requires connection/revalidation and does not extend access locally |
| Online revocation | Reader/player and local authorization respond to the confirmed backend change |
| Switch accounts/logout | Prior account's files/keys are removed or immediately unusable as specified; no cross-account opening |
| Missing key/restored data | App fails safely and requests a protected re-download; no default/static key fallback |
| Backup/transfer | Protected content and usable key material are not restored as an accessible copy on another installation/device |
| Screenshot/recording | Platform protections are measured on real target devices; actual iOS/Android limitations are documented |
| Admit card/certificate | Document comes from the backend; no mobile issuing logic or export control remains |
| Real video DRM | Provider test content verifies offline license, playback, expiration, renewal, and removal on supported native devices |

Test development-data removal against a disposable development dataset. Preserve unrelated project changes and real backend records. Do not perform destructive tests against a real production account.

## 15. Implementation deliverables

Deliver working code, not only these specifications:

1. Isolated dummy dataset and mock repositories covering the REDI flows.
2. Explicit development mode selection and production API-only dependency composition.
3. The removal command, exact source/runtime ownership manifest, and retained legacy cleanup migration.
4. Native secure file storage and an internal PDF reader with audited cache behavior.
5. A DRM-backed protected video adapter with clearly reported backend/provider integration status.
6. Updated document/download UI with all protected-content export paths removed.
7. Account-scoped access, logout cleanup, offline-license checks, and applicable capture controls.
8. Tests and documentation of results actually obtained.

Update `docs/development-data.md`, `docs/protected-downloads.md`, `docs/backend-handoff.md`, and the screen/QA documentation. Record:

- How to use dummy data now and how the later removal instruction works.
- Every runtime/source location that cleanup owns and the installation migration behavior.
- Exact storage, encryption, renderer, native video/DRM, and license choices.
- Real backend operations and any still-proposed requirements.
- Protected formats supported and formats that remain blocked.
- What was tested on Android/iOS and what remains unverified.
- Honest limits for offline revocation, compromised devices, display capture, old distributed builds, and previously exported files.

Begin by inspecting the existing REDI project. Implement the removable development layer and the protected download/viewing architecture. Keep dummy data enabled for development until I give the future removal instruction.

---

## Exact follow-up instruction to use later

> Remove all dummy data. Execute the complete mock-data cleanup from the REDI development-data prompt, including removable source fixtures/assets and stored demo sessions, records, caches, downloads, and keys. Remove mock-mode paths and use only the real API repositories. Run the retained cleanup migration before hydration on existing installations. Preserve the UI, original design reference, real account data, protected download architecture, and tests. If an API is missing or unavailable, show its proper empty/error state and report the integration gap. Do not restore sample content or delete real backend records. Verify the API-only build and report what was actually removed and tested.
