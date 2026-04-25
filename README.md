# MDM-Web-Dashboard

React TypeScript admin dashboard for an Android Mobile Device Management system.

This dashboard is the web administration layer of the MDM project. It allows administrators to monitor Android devices, manage policy profiles, link devices to profiles, send remote commands, view telemetry/read-model data, and inspect audit history from the backend.

## Project Context

This repository is part of a three-layer Android MDM system:

1. **Android Agent** — managed-device app, kiosk launcher, policy apply, telemetry report, command polling
2. **Ktor Backend** — source of truth for APIs, auth, device/profile data, command lifecycle, telemetry, and audit
3. **Web Dashboard** — this repository, admin UI for device management and monitoring

The backend is the source of truth for API contracts, DTO fields, command types, desired configuration, compliance, and read-model semantics.

The web dashboard only consumes backend admin APIs and must not invent fields, endpoints, command types, or business logic.

## Main Features

- Admin login/logout flow
- MDM operations dashboard
- Device list and device detail pages
- Device status and compliance overview
- Link/unlink device profile
- Profile CRUD management
- Allowed apps editor
- Remote command actions:
  - `lock_screen`
  - `refresh_config`
  - `sync_config`
- Command history/timeline display
- Latest location display
- Recent device events display
- Telemetry summary view
- Usage summary view
- State snapshot display
- Policy-state / applied config display
- Compliance and health summary display
- Safe FCM transport health summary on device detail
- Audit log page
- Auto-refresh support for operational monitoring

## Implemented Against Backend

- ADMIN login / logout
- Dashboard overview from existing list/read endpoints
- Device list auto refresh
- Device detail from `GET /api/admin/devices/{id}`
- Link / unlink device ↔ profile
- Unlock device
- Lock device
- Reset unlock password
- Command create / cancel / timeline
- Latest location / recent events / usage summary
- Telemetry summary read model
- State snapshot / policy-state / compliance / health summary display
- Safe FCM transport health summary on device detail
- Profile CRUD
- Allowed apps update
- Audit page from `GET /api/admin/audit`

## Architecture Overview

```text
Web Dashboard
     |
     | Admin REST APIs
     v
Ktor Backend
     |
     | Device APIs
     v
Android MDM Agent
```

## Dashboard Responsibilities

The dashboard is responsible for:

- Displaying backend admin read models
- Managing devices from the admin side
- Managing policy profiles
- Sending supported remote commands
- Showing command lifecycle status
- Showing latest telemetry, usage, events, location, and audit data
- Presenting compliance/read-model status clearly for demo and operation

The dashboard is not responsible for:

- Owning desired device configuration
- Computing Android applied policy state
- Creating unsupported command types
- Bypassing backend validation
- Treating stale read models as immediate Android failure

## Backend Routes Used

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`

### Devices

- `GET /api/admin/devices`
- `GET /api/admin/devices/{id}`
- `PUT /api/admin/devices/{id}/link`
- `POST /api/admin/devices/{id}/lock`
- `POST /api/admin/devices/{id}/reset-unlock-pass`
- `GET /api/admin/devices/{id}/location/latest`
- `GET /api/admin/devices/{id}/events`
- `GET /api/admin/devices/{id}/telemetry/summary`
- `GET /api/admin/devices/{id}/usage/summary`

### Commands

- `GET /api/admin/devices/{id}/commands`
- `POST /api/admin/devices/{id}/commands`
- `POST /api/admin/devices/{id}/commands/{commandId}/cancel`

### Device Unlock

- `POST /api/device/unlock`

### Profiles

- `GET /api/admin/profiles`
- `POST /api/admin/profiles`
- `GET /api/admin/profiles/{id}`
- `PUT /api/admin/profiles/{id}`
- `PUT /api/admin/profiles/{id}/allowed-apps`
- `DELETE /api/admin/profiles/{id}`

### Audit

- `GET /api/admin/audit`

## Important Contract Notes

- `showWifi` and `showBluetooth` are not used because the current backend contract no longer exposes them.
- Supported command types are exactly: `lock_screen`, `refresh_config`, `sync_config`.
- Usage summary can be empty for a time window due to the current backend read-model semantics. The UI does not treat that as proof of Android failure.
- Device detail only exposes safe FCM transport fields:
  - `hasFcmToken`
  - `fcmTokenUpdatedAtEpochMillis`
  - `lastWakeupAttemptAtEpochMillis`
  - `lastWakeupReason`
  - `lastWakeupResult`
- The UI does not read or display raw FCM tokens or backend secret paths.

## Backend Contract State Model

Desired config values are backend-owned:

- `desiredConfigHash`
- `desiredConfigVersionEpochMillis`

Applied config values are Android-reported and displayed by the dashboard:

- `appliedConfigHash`
- `appliedConfigVersionEpochMillis`
- `policyApplyStatus`
- `policyApplyError`
- `policyApplyErrorCode`
- `policyAppliedAtEpochMillis`

Compliance is interpreted from backend desired state, Android applied state, and policy apply status.

## Tech Stack

- React
- TypeScript
- Refine
- Ant Design
- Vite
- Axios
- Map/location UI support
- Backend-driven admin API integration

## Repository Structure

```text
src/
  pages/
    dashboard/     # MDM operations dashboard
    devices/       # Device list/detail and command actions
    profiles/      # Profile CRUD and allowed apps editor
    audit/         # Audit log page
    login/         # Admin login page

  providers/       # Auth, data provider, axios, storage
  hooks/           # Auto refresh helpers
  types/           # API types aligned with backend contract
  utils/           # Formatting helpers
```

## Configure

Create `.env`:

```env
VITE_API_URL=http://127.0.0.1:8080
```

If the backend host or port is different, update `VITE_API_URL`.

## Install

```powershell
npm install
```

## Run Development Server

```powershell
npm run dev
```

Default local Vite URL:

```text
http://localhost:5173
```

## Build

```powershell
npm run build
```

## Preview Production Build

```powershell
npm run preview
```

## Smoke Test

If available in `package.json`:

```powershell
npm run smoke
```

## Related Repositories

- **MDM-AppAndroid-Mobile** — Android MDM agent for kiosk launcher, policy sync, telemetry, and remote commands.
- **MDM-Backend-Manager** — Ktor backend for Android MDM management, policy sync, commands, telemetry, and audit.

## Project Status

This dashboard is suitable for demonstrating the admin side of a custom Android MDM prototype:

- Device monitoring
- Profile management
- Remote command control
- Telemetry/read-model display
- Audit visibility
- Android/backend/web integration demo

Runtime correctness depends on the backend contract and Android device reporting flow.