# Protected Downloads — API Side

Companion to the mobile prompt `REDI_Dummy_Data_API_and_Protected_Downloads_Prompt.md` (sections 5–10).

## Product rule enforced by API

- Content authority is admin/backend (courses, resources, documents).
- Mobile receives **authorization**, not export rights.
- Revocation clears open download sessions and offline grants for that learner/resource.

## Models

| Model | Role |
|---|---|
| `MediaAsset` | Storage key, checksum, encryption/packaging, DRM fields |
| `Resource` | Learner-facing downloadable unit (pdf/video/…) |
| `Entitlement` | Access grant with download/preview flags |
| `IssuedDocument` | Admit card / certificate lifecycle |
| `DownloadSession` | Short-lived delivery token |
| `OfflineGrant` | HMAC-signed offline authorization |

## Access decision order

1. Explicit resource entitlement  
2. Preview / lesson preview  
3. Course free mode or active enrollment / course entitlement  
4. Issued document status for document-backed resources  

Denied responses never fall back to sample content.

## Honest limits

- Offline revocation cannot reach a disconnected device until reconnect / grant expiry.
- Delivery endpoint currently returns **metadata**, not streamed ciphertext (wire storage next).
- DRM production readiness requires a configured license provider; the API reports `provider_configuration_required` when missing.
- HMAC offline grants are integrity/policy tokens for app validation; they are not DRM.
