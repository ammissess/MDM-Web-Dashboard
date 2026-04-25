# MDM Web Final — Contract Audit

This package was rebuilt from the uploaded current web dashboard and checked against the uploaded Ktor backend and Android agent Repomix files.

## Backend source of truth used

Checked backend contract files:

- `src/main/kotlin/com/example/mdmbackend/routes/AuthRoutes.kt`
- `src/main/kotlin/com/example/mdmbackend/routes/AdminRoutes.kt`
- `src/main/kotlin/com/example/mdmbackend/routes/DeviceRoutes.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/AuthDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/AdminDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/DeviceDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/ProfileDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/CommandDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/dto/ConfigDtos.kt`
- `src/main/kotlin/com/example/mdmbackend/model/CommandType.kt`
- `src/main/kotlin/com/example/mdmbackend/model/CommandStatus.kt`
- `src/main/kotlin/com/example/mdmbackend/model/DeviceStatus.kt`
- `src/main/kotlin/com/example/mdmbackend/service/ProfileService.kt`
- `src/main/kotlin/com/example/mdmbackend/service/AdminDeviceService.kt`
- `src/main/kotlin/com/example/mdmbackend/service/DeviceCommandService.kt`
- `src/main/kotlin/com/example/mdmbackend/service/FcmWakeupService.kt`

Checked Android runtime reference files:

- `app/src/main/java/com/example/mdmapplication/data/remote/MdmApi.kt`
- `app/src/main/java/com/example/mdmapplication/data/remote/MdmDtos.kt`
- `app/src/main/java/com/example/mdmapplication/device/DevicePolicyHelper.kt`
- `app/src/main/java/com/example/mdmapplication/ui/launcher/LauncherViewModel.kt`
- `app/src/main/java/com/example/mdmapplication/device/FirebaseWakeupMessagingService.kt`

## Endpoint audit

| Web flow | Endpoint | Backend contract status | Notes |
|---|---|---|---|
| Admin login | `POST /api/auth/login` | Exists | Uses admin username/password and stores bearer token. |
| Device list | `GET /api/admin/devices` | Exists | Returns `DeviceResponse[]`. |
| Device detail | `GET /api/admin/devices/{id}` | Exists | Returns `DeviceDetailResponse` with desired/applied/policy/wakeup fields. |
| Link/unlink profile | `PUT /api/admin/devices/{id}/link` | Exists | Body uses `{ userCode }`. |
| Set backend locked status | `POST /api/admin/devices/{id}/lock` | Exists | UI explicitly labels this as backend status flow, not command delivery. |
| Reset unlock password | `POST /api/admin/devices/{id}/reset-unlock-pass` | Exists | Uses `{ newPassword }`. |
| Unlock by password | `POST /api/device/unlock` | Exists | Uses `{ deviceCode, password }`. |
| Create command | `POST /api/admin/devices/{id}/commands` | Exists | Body uses `{ type, payload, ttlSeconds }`. |
| Cancel command | `POST /api/admin/devices/{id}/commands/{commandId}/cancel` | Exists | Body uses `{ reason, errorCode? }`. |
| Command timeline | `GET /api/admin/devices/{id}/commands` | Exists | Newest-first sorting is also enforced in UI. |
| Latest location | `GET /api/admin/devices/{id}/location/latest` | Exists | UI handles valid/null/404/0,0/token-missing states. |
| Device events | `GET /api/admin/devices/{id}/events` | Exists | Used as activity feed/read-model. |
| Usage summary | `GET /api/admin/devices/{id}/usage/summary` | Exists | Treated as admin read model. |
| Telemetry summary | `GET /api/admin/devices/{id}/telemetry/summary` | Exists | Treated as admin read model. |
| App inventory | `GET /api/admin/devices/{id}/apps` | Exists | Used for device inventory and allowedApps picker. |
| Profile list/detail/create/update | `/api/admin/profiles...` | Exists | Uses backend DTO fields only. |
| Profile allowed apps | `PUT /api/admin/profiles/{id}/allowed-apps` | Exists | Body is `string[]`. |
| Audit list | `GET /api/admin/audit` | Exists | Used on dashboard and audit page. |

## Command contract

Only these command types are used in UI and quick actions:

- `lock_screen`
- `refresh_config`
- `sync_config`

The UI does not add new command types.

## Desired/applied/compliance semantics

- Desired config is backend-owned.
- Android only applies policy and reports applied state/policy-state.
- Compliance is represented by desired/applied hash/version and `policyApplyStatus`.
- The UI does not claim Android updated instantly after profile edit. It shows the pipeline: backend desired recompute → refresh_config/wakeup/poll/ack → Android policy-state.

## Legacy fields removed/not used

The final web package does not reintroduce old legacy fields like `showWifi` or `showBluetooth`.

## Important runtime distinction

`POST /api/admin/devices/{id}/lock` and command `lock_screen` are intentionally shown as separate controls:

- `/lock` sets backend/device status.
- `lock_screen` goes through command delivery lifecycle and appears in command timeline.
