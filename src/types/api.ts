export type Role = "ADMIN" | "DEVICE";
export type DeviceStatus = "ACTIVE" | "LOCKED" | string;
export type CommandStatus =
  | "PENDING"
  | "SENT"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | string;
export type CommandType = "lock_screen" | "refresh_config" | "sync_config" | string;

export interface LoginRequest {
  username: string;
  password: string;
  deviceCode?: string;
}

export interface LoginResponse {
  token: string;
  expiresAtEpochMillis: number;
  role: Role | string;
}

export interface ApiError {
  error?: string;
  status?: string;
  message?: string;
  code?: string;
}

export interface HealthSummary {
  isOnline: boolean;
  telemetryFreshness: string;
}

export interface ComplianceSummary {
  isCompliant: boolean;
}

export interface DeviceResponse {
  id: string;
  deviceCode: string;
  userCode?: string | null;
  androidVersion: string;
  sdkInt: number;
  manufacturer: string;
  model: string;
  imei: string;
  serial: string;
  batteryLevel: number;
  isCharging: boolean;
  wifiEnabled: boolean;
  status: DeviceStatus;
  lastSeenAtEpochMillis: number;
}

export interface DeviceDetailResponse extends DeviceResponse {
  networkType?: string | null;
  foregroundPackage?: string | null;
  agentVersion?: string | null;
  agentBuildCode?: number | null;
  ipAddress?: string | null;
  currentLauncherPackage?: string | null;
  uptimeMs?: number | null;
  abi?: string | null;
  buildFingerprint?: string | null;
  isDeviceOwner: boolean;
  isLauncherDefault: boolean;
  isKioskRunning: boolean;
  storageFreeBytes: number;
  storageTotalBytes: number;
  ramFreeMb: number;
  ramTotalMb: number;
  lastBootAtEpochMillis?: number | null;
  lastTelemetryAtEpochMillis?: number | null;
  lastPollAtEpochMillis?: number | null;
  lastCommandAckAtEpochMillis?: number | null;
  hasFcmToken: boolean;
  fcmTokenUpdatedAtEpochMillis?: number | null;
  lastWakeupAttemptAtEpochMillis?: number | null;
  lastWakeupReason?: string | null;
  lastWakeupResult?: string | null;
  desiredConfigVersionEpochMillis?: number | null;
  desiredConfigHash?: string | null;
  appliedConfigVersionEpochMillis?: number | null;
  appliedConfigHash?: string | null;
  policyApplyStatus: string;
  policyApplyError?: string | null;
  policyApplyErrorCode?: string | null;
  lastPolicyAppliedAtEpochMillis?: number | null;
  healthSummary?: HealthSummary | null;
  complianceSummary?: ComplianceSummary | null;
}

export interface DeviceLinkRequest {
  userCode?: string | null;
}

export interface UnlockRequest {
  deviceCode: string;
  password: string;
}

export interface UnlockResponse {
  status: string;
  message: string;
}

export interface ProfileResponse {
  id: string;
  userCode: string;
  name: string;
  description: string;
  allowedApps: string[];
  disableWifi: boolean;
  disableBluetooth: boolean;
  disableCamera: boolean;
  disableStatusBar: boolean;
  kioskMode: boolean;
  blockUninstall: boolean;
  lockPrivateDnsConfig: boolean;
  lockVpnConfig: boolean;
  blockDebuggingFeatures: boolean;
  disableUsbDataSignaling: boolean;
  disallowSafeBoot: boolean;
  disallowFactoryReset: boolean;
  updatedAtEpochMillis: number;
}

export interface ProfileCreateRequest {
  userCode: string;
  name: string;
  description: string;
  allowedApps: string[];
  disableWifi: boolean;
  disableBluetooth: boolean;
  disableCamera: boolean;
  disableStatusBar: boolean;
  kioskMode: boolean;
  blockUninstall: boolean;
  lockPrivateDnsConfig: boolean;
  lockVpnConfig: boolean;
  blockDebuggingFeatures: boolean;
  disableUsbDataSignaling: boolean;
  disallowSafeBoot: boolean;
  disallowFactoryReset: boolean;
}

export interface ProfileUpdateRequest {
  name?: string;
  description?: string;
  disableWifi?: boolean;
  disableBluetooth?: boolean;
  disableCamera?: boolean;
  disableStatusBar?: boolean;
  kioskMode?: boolean;
  blockUninstall?: boolean;
  lockPrivateDnsConfig?: boolean;
  lockVpnConfig?: boolean;
  blockDebuggingFeatures?: boolean;
  disableUsbDataSignaling?: boolean;
  disallowSafeBoot?: boolean;
  disallowFactoryReset?: boolean;
}

export interface CommandView {
  id: string;
  deviceId: string;
  type: CommandType;
  payload: string;
  status: CommandStatus;
  createdByUserId?: string | null;
  createdAtEpochMillis: number;
  expiresAtEpochMillis?: number | null;
  leasedAtEpochMillis?: number | null;
  leaseToken?: string | null;
  leaseExpiresAtEpochMillis?: number | null;
  ackedAtEpochMillis?: number | null;
  cancelledAtEpochMillis?: number | null;
  cancelledByUserId?: string | null;
  cancelReason?: string | null;
  error?: string | null;
  errorCode?: string | null;
  output?: string | null;
}

export interface CommandListResponse {
  items: CommandView[];
  total: number;
}

export interface CreateCommandRequest {
  type: CommandType;
  payload: string;
  ttlSeconds?: number;
}

export interface CancelCommandRequest {
  reason: string;
  errorCode?: string | null;
}

export interface CancelCommandResponse {
  ok: boolean;
  status: string;
  cancelledAtEpochMillis: number;
}

export interface UiActionLog {
  id: string;
  scope: "DEVICE" | "PROFILE" | "SYSTEM" | "COMMAND";
  action: string;
  target: string;
  status: "SUCCESS" | "FAILED" | "INFO";
  message: string;
  atEpochMillis: number;
}

export interface AuditLogItem {
  id: string;
  actorType: string;
  actorUserId?: string | null;
  actorDeviceCode?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payloadJson?: string | null;
  createdAtEpochMillis: number;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminLatestLocationResponse {
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  updatedAtEpochMillis: number;
}

export interface AdminDeviceEventView {
  id: string;
  deviceId: string;
  type: string;
  category: string;
  severity: string;
  payload: string;
  errorCode?: string | null;
  message?: string | null;
  createdAtEpochMillis: number;
}

export interface AdminUsageSummaryItem {
  packageName: string;
  totalDurationMs: number;
  sessions: number;
}

export interface AdminUsageSummaryResponse {
  deviceId: string;
  fromEpochMillis?: number | null;
  toEpochMillis?: number | null;
  items: AdminUsageSummaryItem[];
}

export interface AdminDeviceAppView {
  packageName: string;
  appName?: string | null;
  versionName?: string | null;
  versionCode?: number | null;
  isSystemApp?: boolean | null;
  hasLauncherActivity?: boolean | null;
  installed: boolean;
  disabled?: boolean | null;
  hidden?: boolean | null;
  suspended?: boolean | null;
  lastSeenAtEpochMillis: number;
}

export interface AdminDeviceAppsResponse {
  deviceId: string;
  items: AdminDeviceAppView[];
  total: number;
}

export interface AggregateCountItem {
  key: string;
  count: number;
}

export interface AdminTelemetrySummaryResponse {
  deviceId: string;
  eventCountByType: AggregateCountItem[];
  eventCountByCategory: AggregateCountItem[];
  eventCountBySeverity: AggregateCountItem[];
  policyApplyFailed24h: number;
  policyApplyFailed7d: number;
  generatedAtEpochMillis: number;
}