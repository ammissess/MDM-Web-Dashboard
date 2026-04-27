import React, { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
  Tabs,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type {
  AdminDeviceAppsResponse,
  AdminDeviceAppView,
  AdminDeviceEventView,
  AdminLatestLocationResponse,
  AdminTelemetrySummaryResponse,
  AdminUsageSummaryResponse,
  CommandListResponse,
  CommandView,
  CreateCommandRequest,
  DeviceDetailResponse,
  ProfileResponse,
  UiActionLog,
} from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import {
  fmtBytes,
  fmtDurationMs,
  fmtEpoch,
  fmtRelativeFromNow,
  isLostContactFromLastSeen,
  normalizeError,
  onlineStateFromLastSeen,
  policyStatusColor,
  telemetryFreshnessColor,
  tryFormatJsonString,
} from "../../utils/format";
import { downloadJson, formatDateForFileName } from "../../utils/export";
import { LiveStatusBadge } from "./components/LiveStatusBadge";
import { CommandTimeline } from "./components/CommandTimeline";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { DeviceLocationStaticMap } from "./components/DeviceLocationStaticMap";
import { DeviceManagementReport } from "./components/DeviceManagementReport";
import { ComplianceTimeline } from "./components/ComplianceTimeline";
import { useT } from "../../i18n";

function makeUiLog(entry: Omit<UiActionLog, "id" | "atEpochMillis">): UiActionLog {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    atEpochMillis: Date.now(),
    ...entry,
  };
}

function aggregateTags(items: { key: string; count: number }[], t: (key: string) => string) {
  if (!items.length) return <Tag>{t("common.empty")}</Tag>;
  return items.map((item) => (
    <Tag key={`${item.key}-${item.count}`}>
      {item.key}: {item.count}
    </Tag>
  ));
}

function shortHash(value?: string | null) {
  if (!value) return "-";
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function wakeupResultColor(value?: string | null) {
  const up = String(value ?? "").toUpperCase();
  if (!up) return "default";
  if (up.startsWith("DELIVERED")) return "green";
  if (up.startsWith("NOT_DELIVERED")) return "orange";
  if (up.startsWith("FAILED")) return "red";
  if (up.startsWith("SKIPPED")) return "default";
  return "blue";
}

function wakeupReasonDisplay(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return "-";
  if (value === "refresh_config_enqueued:pending_command") {
    return t("device.wakeupReason.refreshConfigQueuedPending");
  }
  return value;
}

function wakeupResultDisplay(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return "-";
  if (value === "skipped_no_token") {
    return t("device.wakeupResult.skippedNoToken");
  }
  return value;
}

const hardeningItems: Array<{ key: keyof ProfileResponse; label: string }> = [
  { key: "lockPrivateDnsConfig", label: "Lock Private DNS" },
  { key: "lockVpnConfig", label: "Lock VPN" },
  { key: "blockDebuggingFeatures", label: "Block debugging" },
  { key: "disableUsbDataSignaling", label: "Disable USB data" },
  { key: "disallowSafeBoot", label: "Disallow safe boot" },
  { key: "disallowFactoryReset", label: "Disallow factory reset" },
];

function sanitizeFileNamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "device";
}

function maskToken(value: string) {
  if (value.length <= 8) return "[masked]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskCommandLeaseToken(command: CommandView) {
  return {
    ...command,
    leaseToken: command.leaseToken ? maskToken(command.leaseToken) : command.leaseToken,
  };
}

function isValidBatteryLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function chargingLabel(value: boolean | null | undefined, t: (key: string) => string) {
  if (value === true) return t("devices.charging");
  if (value === false) return t("devices.notCharging");
  return t("devices.chargingUnknown");
}

function fmtStableTime(value: number | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export const DeviceShowPage: React.FC = () => {
  const t = useT();
  const params = useParams<{ id: string }>();
  const deviceId = String(params.id ?? "");

  const [device, setDevice] = useState<DeviceDetailResponse | null>(null);
  const [profiles, setProfiles] = useState<ProfileResponse[]>([]);
  const [selectedUserCode, setSelectedUserCode] = useState<string | null>(null);
  const [linkDirty, setLinkDirty] = useState(false);

  const [commands, setCommands] = useState<CommandView[]>([]);
  const [latestLocation, setLatestLocation] = useState<AdminLatestLocationResponse | null>(null);
  const [events, setEvents] = useState<AdminDeviceEventView[]>([]);
  const [usageSummary, setUsageSummary] = useState<AdminUsageSummaryResponse | null>(null);
  const [telemetrySummary, setTelemetrySummary] = useState<AdminTelemetrySummaryResponse | null>(null);
  const [deviceApps, setDeviceApps] = useState<AdminDeviceAppView[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [coreRefreshing, setCoreRefreshing] = useState(false);
  const [commandsRefreshing, setCommandsRefreshing] = useState(false);
  const [telemetryRefreshing, setTelemetryRefreshing] = useState(false);
  const [inventoryRefreshing, setInventoryRefreshing] = useState(false);
  const [coreRefreshError, setCoreRefreshError] = useState<string | null>(null);
  const [commandsRefreshError, setCommandsRefreshError] = useState<string | null>(null);
  const [telemetryRefreshError, setTelemetryRefreshError] = useState<string | null>(null);
  const [inventoryRefreshError, setInventoryRefreshError] = useState<string | null>(null);
  const [coreLastUpdatedAt, setCoreLastUpdatedAt] = useState<number | null>(null);
  const [commandsLastUpdatedAt, setCommandsLastUpdatedAt] = useState<number | null>(null);
  const [telemetryLastUpdatedAt, setTelemetryLastUpdatedAt] = useState<number | null>(null);
  const [inventoryLastUpdatedAt, setInventoryLastUpdatedAt] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [commandMessage, setCommandMessage] = useState<string>("");
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<UiActionLog[]>([]);

  type RefreshMode = "initial" | "background";

  const linkedProfile = useMemo(
    () => profiles.find((profile) => profile.userCode === device?.userCode) ?? null,
    [profiles, device?.userCode],
  );
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.createdAtEpochMillis ?? 0) - (a.createdAtEpochMillis ?? 0)),
    [events],
  );
  const deviceLostContact = isLostContactFromLastSeen(device?.lastSeenAtEpochMillis);
  const [guideOpen, setGuideOpen] = useState(false);
  const detailGuideItemKeys = [
    "device.detailGuide.identity",
    "device.detailGuide.profile",
    "device.detailGuide.commands",
    "device.detailGuide.lostContact",
    "device.detailGuide.lastReported",
  ];

  const pushLog = useCallback((entry: Omit<UiActionLog, "id" | "atEpochMillis">) => {
    setActionLogs((prev) => [makeUiLog(entry), ...prev].slice(0, 20));
  }, []);

  function warnLostContactAction() {
    message.warning(t("devices.lostContactActionBlocked"));
  }

  const loadCore = useCallback(async (mode: RefreshMode = "background") => {
    if (mode === "background") {
      setCoreRefreshing(true);
    }
    try {
      const [deviceRes, profilesRes] = await Promise.all([
        http.get<DeviceDetailResponse>(`/api/admin/devices/${deviceId}`),
        http.get<ProfileResponse[]>("/api/admin/profiles"),
      ]);

      const deviceData = deviceRes.data;
      setDevice(deviceData);
      setProfiles(profilesRes.data ?? []);
      if (!linkDirty) {
        setSelectedUserCode(deviceData.userCode ?? null);
      }
      setError(null);
      setCoreRefreshError(null);
      setCoreLastUpdatedAt(Date.now());
    } catch (err) {
      const msg = normalizeError(err, t("device.loadFailed"));
      setError(msg);
      setCoreRefreshError(msg);
      // Keep the previous snapshot during background refresh failures to avoid UI flicker.
    } finally {
      if (mode === "background") {
        setCoreRefreshing(false);
      }
    }
  }, [deviceId, linkDirty, t]);

  const loadCommands = useCallback(async (mode: RefreshMode = "background") => {
    if (!deviceId) return;
    if (mode === "background") {
      setCommandsRefreshing(true);
    }
    try {
      const { data } = await http.get<CommandListResponse>(`/api/admin/devices/${deviceId}/commands`, {
        params: { limit: 20, offset: 0 },
      });
      setCommands(data.items ?? []);
      setCommandMessage((data.items ?? []).length === 0 ? t("command.emptyRows") : "");
      setCommandsRefreshError(null);
      setCommandsLastUpdatedAt(Date.now());
    } catch (err) {
      // Keep the previous command timeline during background refresh failures.
      const msg = normalizeError(err, t("command.loadFailed"));
      setCommandMessage(msg);
      setCommandsRefreshError(msg);
    } finally {
      if (mode === "background") {
        setCommandsRefreshing(false);
      }
    }
  }, [deviceId, t]);

  const loadTelemetry = useCallback(async (mode: RefreshMode = "background") => {
    if (!deviceId) return;
    if (mode === "background") {
      setTelemetryRefreshing(true);
    }
    try {
      const [locationRes, eventsRes, usageRes, telemetryRes] = await Promise.allSettled([
        http.get<AdminLatestLocationResponse>(`/api/admin/devices/${deviceId}/location/latest`),
        http.get<AdminDeviceEventView[]>(`/api/admin/devices/${deviceId}/events`, { params: { limit: 8 } }),
        http.get<AdminUsageSummaryResponse>(`/api/admin/devices/${deviceId}/usage/summary`),
        http.get<AdminTelemetrySummaryResponse>(`/api/admin/devices/${deviceId}/telemetry/summary`),
      ]);

      if (locationRes.status === "fulfilled") setLatestLocation(locationRes.value.data);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value.data ?? []);
      if (usageRes.status === "fulfilled") setUsageSummary(usageRes.value.data);
      if (telemetryRes.status === "fulfilled") setTelemetrySummary(telemetryRes.value.data);

      const failed = [locationRes, eventsRes, usageRes, telemetryRes].some((result) => result.status === "rejected");
      if (failed) {
        setTelemetryRefreshError(t("device.telemetryPartialRefreshFailed"));
      } else {
        setTelemetryRefreshError(null);
      }
      setTelemetryLastUpdatedAt(Date.now());
    } catch (err) {
      setTelemetryRefreshError(normalizeError(err, t("device.telemetryLoadFailed")));
    } finally {
      if (mode === "background") {
        setTelemetryRefreshing(false);
      }
    }
  }, [deviceId, t]);

  const loadInventory = useCallback(async (mode: RefreshMode = "background") => {
    if (!deviceId) return;
    if (mode === "background") {
      setInventoryRefreshing(true);
    }
    try {
      const { data } = await http.get<AdminDeviceAppsResponse>(`/api/admin/devices/${deviceId}/apps`);
      setDeviceApps(data.items ?? []);
      setInventoryTotal(Number(data.total ?? (data.items ?? []).length));
      setInventoryError(null);
      setInventoryRefreshError(null);
      setInventoryLastUpdatedAt(Date.now());
    } catch (err) {
      // Keep old inventory rows visible and surface the read-model error separately.
      const msg = normalizeError(err, t("device.appInventoryLoadFailed"));
      setInventoryError(msg);
      setInventoryRefreshError(msg);
    } finally {
      if (mode === "background") {
        setInventoryRefreshing(false);
      }
    }
  }, [deviceId, t]);

  React.useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      await Promise.all([
        loadCore("initial"),
        loadCommands("initial"),
        loadTelemetry("initial"),
        loadInventory("initial"),
      ]);
      if (mounted) {
        setInitialLoading(false);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadCommands, loadCore, loadInventory, loadTelemetry]);

  useAutoRefresh(() => loadCore("background"), true, 5_000, [loadCore]);
  useAutoRefresh(() => loadCommands("background"), true, 5_000, [loadCommands]);
  useAutoRefresh(() => loadTelemetry("background"), true, 10_000, [loadTelemetry]);
  useAutoRefresh(() => loadInventory("background"), true, 15_000, [loadInventory]);

  async function updateLink(userCode: string | null) {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setActionBusy(true);
    try {
      await http.put(`/api/admin/devices/${device.id}/link`, { userCode });
      pushLog({
        scope: "DEVICE",
        action: userCode ? "LINK_PROFILE" : "UNLINK_PROFILE",
        target: device.deviceCode,
        status: "SUCCESS",
        message: userCode ? `${t("devices.assignSuccess")}: ${userCode}` : t("devices.unlinked"),
      });
      message.success(userCode ? `${t("devices.assignSuccess")}: ${userCode}` : t("devices.unlinked"));
      setSelectedUserCode(userCode);
      setLinkDirty(false);
      await loadCore("background");
      await loadCommands("background");
      window.setTimeout(() => {
        void loadCore("background");
        void loadCommands("background");
      }, 1200);
    } catch (err) {
      const msg = normalizeError(err, t("devices.assignFailed"));
      pushLog({
        scope: "DEVICE",
        action: userCode ? "LINK_PROFILE" : "UNLINK_PROFILE",
        target: device.deviceCode,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function unlockDevice(password: string) {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setActionBusy(true);
    try {
      const { data } = await http.post("/api/device/unlock", {
        deviceCode: device.deviceCode,
        password,
      });
      pushLog({
        scope: "DEVICE",
        action: "UNLOCK_DEVICE",
        target: device.deviceCode,
        status: "SUCCESS",
        message: `${data.status} — ${data.message}`,
      });
      message.success(`${t("devices.unlockSuccess")}: ${data.status}`);
      await loadCore("background");
    } catch (err) {
      const msg = normalizeError(err, t("devices.unlockFailed"));
      pushLog({
        scope: "DEVICE",
        action: "UNLOCK_DEVICE",
        target: device.deviceCode,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function lockDevice() {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setActionBusy(true);
    try {
      await http.post(`/api/admin/devices/${device.id}/lock`);
      pushLog({
        scope: "DEVICE",
        action: "LOCK_DEVICE",
        target: device.deviceCode,
        status: "SUCCESS",
        message: t("device.backendStatusLockedLog"),
      });
      message.success(t("device.backendStatusLocked"));
      await loadCore("background");
    } catch (err) {
      const msg = normalizeError(err, t("device.lockFailed"));
      pushLog({
        scope: "DEVICE",
        action: "LOCK_DEVICE",
        target: device.deviceCode,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function resetUnlockPass(newPassword: string) {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setActionBusy(true);
    try {
      await http.post(`/api/admin/devices/${device.id}/reset-unlock-pass`, { newPassword });
      pushLog({
        scope: "DEVICE",
        action: "RESET_UNLOCK_PASS",
        target: device.deviceCode,
        status: "SUCCESS",
        message: t("device.unlockPasswordReset"),
      });
      message.success(t("device.unlockPasswordReset"));
    } catch (err) {
      const msg = normalizeError(err, t("device.resetUnlockFailed"));
      pushLog({
        scope: "DEVICE",
        action: "RESET_UNLOCK_PASS",
        target: device.deviceCode,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function createCommand(values: CreateCommandRequest) {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setActionBusy(true);
    try {
      const { data } = await http.post<CommandView>(`/api/admin/devices/${device.id}/commands`, values);
      pushLog({
        scope: "COMMAND",
        action: "CREATE_COMMAND",
        target: device.deviceCode,
        status: "SUCCESS",
        message: `${data.type} ${t("device.queuedViaCommands")}`,
      });
      message.success(`${t("device.commandQueued")}: ${data.type}`);
      await loadCommands("background");
      window.setTimeout(() => {
        void loadCore("background");
        void loadCommands("background");
      }, 1200);
    } catch (err) {
      const msg = normalizeError(err, t("device.createCommandFailed"));
      pushLog({
        scope: "COMMAND",
        action: "CREATE_COMMAND",
        target: device.deviceCode,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function cancelCommand(command: CommandView) {
    if (!device) return;
    if (deviceLostContact) {
      warnLostContactAction();
      return;
    }
    setCancelBusyId(command.id);
    try {
      await http.post(`/api/admin/devices/${device.id}/commands/${command.id}/cancel`, {
        reason: t("device.cancelledFromDashboard"),
      });
      pushLog({
        scope: "COMMAND",
        action: "CANCEL_COMMAND",
        target: command.id,
        status: "SUCCESS",
        message: `${command.type} ${t("device.cancelled")}`,
      });
      message.success(`${t("device.commandCancelled")}: ${command.type}`);
      await loadCommands("background");
    } catch (err) {
      const msg = normalizeError(err, t("device.cancelCommandFailed"));
      pushLog({
        scope: "COMMAND",
        action: "CANCEL_COMMAND",
        target: command.id,
        status: "FAILED",
        message: msg,
      });
      message.error(msg);
    } finally {
      setCancelBusyId(null);
    }
  }

  function exportDeviceReportJson() {
    if (!device) return;

    const report = {
      exportedAt: new Date().toISOString(),
      source: "web-dashboard-client-side",
      scope: "device-management-report",
      device,
      linkedProfile,
      latestLocation,
      recentEvents: events,
      telemetrySummary,
      usageSummary,
      commands: commands.map(maskCommandLeaseToken),
      notes: {
        desiredState: "Backend-owned",
        appliedState: "Android-reported",
        compliance: "Displayed from desired/applied config and policy apply status when available",
      },
    };

    const deviceName = sanitizeFileNamePart(device.deviceCode || device.id);
    downloadJson(`mdm-device-${deviceName}-${formatDateForFileName()}.json`, report);
  }

  if (initialLoading && !device) {
    return (
      <Card>
        <Alert type="info" message={t("device.loading")} />
      </Card>
    );
  }

  if (!device) {
    return (
      <Card>
        <Empty description={error ?? t("device.notFound")} />
      </Card>
    );
  }

  const statusUp = String(device.status).toUpperCase();
  const policyStatusUp = String(device.policyApplyStatus).toUpperCase();
  const desiredAppliedInSync = device.complianceSummary?.isCompliant === true;
  const buildRefreshExtra = (refreshing: boolean, failed: string | null, updatedAt: number | null) => (
    <Space size={8} className="action-center-refresh-extra">
      {refreshing ? <Tag>{t("common.updating")}</Tag> : null}
      {failed ? <Tag color="warning">{t("device.lastRefreshFailed")}</Tag> : null}
      <Typography.Text className="action-center-time-meta" title={updatedAt ? fmtEpoch(updatedAt) : undefined}>
        {updatedAt ? t("device.recentlyUpdated") : t("common.notAvailable")}
      </Typography.Text>
    </Space>
  );
  const buildStableRefreshMeta = (failed: string | null, updatedAt: number | null) => (
    <Space size={8} className="stable-refresh-meta-wrap">
      {failed ? <Tag color="warning">{t("device.lastRefreshFailed")}</Tag> : null}
      <Typography.Text className="stable-refresh-meta" title={updatedAt ? fmtEpoch(updatedAt) : undefined}>
        {updatedAt ? `${t("device.recentlyUpdated")} · ${fmtStableTime(updatedAt)}` : t("common.notAvailable")}
      </Typography.Text>
    </Space>
  );

  return (
    <div className="page-stack device-detail-page">
      {deviceLostContact ? (
        <Alert
          type="warning"
          showIcon
          message={t("devices.lostContactAlertTitle")}
          description={t("devices.lostContactAlertDescription")}
        />
      ) : null}

      {error ? <Alert type="warning" message={error} description={t("device.previousSnapshotKept")} /> : null}

      <Card
        className="device-detail-hero"
        extra={
          <Button size="small" aria-expanded={guideOpen} onClick={() => setGuideOpen((value) => !value)}>
            {guideOpen ? t("common.hideGuide") : t("common.quickGuide")}
          </Button>
        }
      >
        <div className="device-hero-top">
          <div>
            <Typography.Text type="secondary">{t("device.heroLabel")}</Typography.Text>
            <Typography.Title level={3} style={{ margin: "2px 0 0" }}>
              {device.deviceCode}
            </Typography.Title>
            <Typography.Text>
              {[device.manufacturer, device.model].filter(Boolean).join(" ")} · {device.androidVersion || "-"} / SDK {device.sdkInt}
            </Typography.Text>
          </div>
          <Space wrap>
            <Tag color={statusUp === "ACTIVE" ? "green" : statusUp === "LOCKED" ? "red" : "default"}>{statusUp}</Tag>
            <LiveStatusBadge isOnline={device.healthSummary?.isOnline} lastSeenAtEpochMillis={device.lastSeenAtEpochMillis} />
            <Tag color={device.userCode ? "blue" : "default"}>
              {device.userCode ? `${t("common.profile")}: ${device.userCode}` : t("devices.unlinked")}
            </Tag>
          </Space>
        </div>

        <div className="device-hero-metrics">
          <div className="device-hero-metric">
            <Typography.Text type="secondary">{t("devices.battery")}</Typography.Text>
            <Typography.Text strong>
              {isValidBatteryLevel(device.batteryLevel) ? `${device.batteryLevel}%` : t("devices.noBatteryData")}
            </Typography.Text>
            <Typography.Text type="secondary">{chargingLabel(device.isCharging, t)}</Typography.Text>
          </div>
          <div className="device-hero-metric">
            <Typography.Text type="secondary">{t("devices.lastSeen")}</Typography.Text>
            <Typography.Text strong>{fmtRelativeFromNow(device.lastSeenAtEpochMillis)}</Typography.Text>
            <Typography.Text type="secondary">{fmtEpoch(device.lastSeenAtEpochMillis)}</Typography.Text>
          </div>
          <div className="device-hero-metric">
            <Typography.Text type="secondary">{t("device.telemetryFreshness")}</Typography.Text>
            <Tag color={telemetryFreshnessColor(device.healthSummary?.telemetryFreshness)}>
              {device.healthSummary?.telemetryFreshness ?? t("common.unknown")}
            </Tag>
            <Typography.Text type="secondary">{fmtEpoch(device.lastTelemetryAtEpochMillis)}</Typography.Text>
          </div>
          <div className="device-hero-metric">
            <Typography.Text type="secondary">{t("device.desiredApplied")}</Typography.Text>
            <Tag color={desiredAppliedInSync ? "green" : "orange"}>
              {desiredAppliedInSync ? t("dashboard.desiredAppliedMatch") : t("dashboard.desiredAppliedMismatch")}
            </Tag>
            <Typography.Text type="secondary">
              {shortHash(device.desiredConfigHash)} / {shortHash(device.appliedConfigHash)}
            </Typography.Text>
          </div>
          <div className="device-hero-metric">
            <Typography.Text type="secondary">policyApplyStatus</Typography.Text>
            <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp || t("common.unknown")}</Tag>
            <Typography.Text type="secondary">{fmtEpoch(device.lastPolicyAppliedAtEpochMillis)}</Typography.Text>
          </div>
          <div className="device-hero-metric">
            <Typography.Text type="secondary">{t("device.fcmWakeupStatus")}</Typography.Text>
            <Space wrap>
              <Tag color={device.hasFcmToken ? "blue" : "default"}>FCM={String(device.hasFcmToken)}</Tag>
              {device.lastWakeupResult ? <Tag color={wakeupResultColor(device.lastWakeupResult)}>{device.lastWakeupResult}</Tag> : null}
            </Space>
            <Typography.Text type="secondary">{fmtRelativeFromNow(device.lastWakeupAttemptAtEpochMillis)}</Typography.Text>
          </div>
        </div>

        {guideOpen ? (
          <div className="quick-guide-panel">
            <Typography.Title level={5} className="quick-guide-title">
              {t("device.detailGuide.title")}
            </Typography.Title>
            <ul className="quick-guide-list">
              {detailGuideItemKeys.map((key) => (
                <li key={key}>
                  <Typography.Text>{t(key)}</Typography.Text>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Row gutter={[16, 16]} className="device-detail-main-grid">
        <Col xs={24} xl={16} className="device-detail-content-column">
          <section className="device-section-surface">
            <div className="device-section-header">
              <Typography.Title level={4}>{t("device.operationalSnapshot")}</Typography.Title>
            </div>
            <div className="device-section-body">
            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Card title={t("report.deviceIdentity")} className="device-section-card">
                  <Descriptions bordered size="small" column={1} className="device-compact-descriptions">
                    <Descriptions.Item label={t("report.deviceCode")}><Typography.Text code>{device.deviceCode}</Typography.Text></Descriptions.Item>
                    <Descriptions.Item label={t("devices.policyProfile")}>
                      {device.userCode ? <Tag color="blue">{device.userCode}</Tag> : <Tag>{t("devices.unlinked")}</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("device.manufacturer")}>{device.manufacturer || "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.model")}>{device.model || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Android / SDK">{device.androidVersion || "-"} / {device.sdkInt}</Descriptions.Item>
                    <Descriptions.Item label={t("common.status")}>
                      <Space wrap>
                        <Tag color={statusUp === "ACTIVE" ? "green" : statusUp === "LOCKED" ? "red" : "default"}>{statusUp}</Tag>
                        <LiveStatusBadge isOnline={device.healthSummary?.isOnline} lastSeenAtEpochMillis={device.lastSeenAtEpochMillis} />
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("devices.battery")}>
                      {isValidBatteryLevel(device.batteryLevel) ? `${device.batteryLevel}% · ${chargingLabel(device.isCharging, t)}` : t("devices.noBatteryData")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("devices.lastSeen")}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{fmtEpoch(device.lastSeenAtEpochMillis)}</Typography.Text>
                        <Typography.Text type="secondary">{fmtRelativeFromNow(device.lastSeenAtEpochMillis)}</Typography.Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("device.lastTelemetry")}>{fmtEpoch(device.lastTelemetryAtEpochMillis)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.lastPoll")}>{fmtEpoch(device.lastPollAtEpochMillis)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.lastCommandAck")}>{fmtEpoch(device.lastCommandAckAtEpochMillis)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card title={t("device.stateSnapshot")} className="device-section-card">
                  <Descriptions bordered size="small" column={1} className="device-compact-descriptions">
                    <Descriptions.Item label={t("device.networkType")}>{device.networkType ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.wifiEnabled")}>{String(device.wifiEnabled)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.foregroundPackage")}>{device.foregroundPackage ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.launcherPackage")}>{device.currentLauncherPackage ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.agentVersionBuild")}>{device.agentVersion ?? "-"} / {device.agentBuildCode ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.ipAddress")}>{device.ipAddress ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.deviceOwner")}>{String(device.isDeviceOwner)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.launcherDefault")}>{String(device.isLauncherDefault)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.kioskRunning")}>{String(device.isKioskRunning)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.storageFreeTotal")}>{fmtBytes(device.storageFreeBytes)} / {fmtBytes(device.storageTotalBytes)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.ramFreeTotal")}>{device.ramFreeMb} MB / {device.ramTotalMb} MB</Descriptions.Item>
                    <Descriptions.Item label={t("device.uptime")}>{fmtDurationMs(device.uptimeMs)}</Descriptions.Item>
                    <Descriptions.Item label={t("device.lastBoot")}>{fmtEpoch(device.lastBootAtEpochMillis)}</Descriptions.Item>
                    <Descriptions.Item label="ABI">{device.abi ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("device.buildFingerprint")}>{device.buildFingerprint ?? "-"}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card title={t("device.desiredApplied")} className="device-section-card">
                  <Descriptions bordered size="small" column={1} className="device-compact-descriptions">
                    <Descriptions.Item label={t("device.summary")}>
                      <Space wrap>
                        <Tag color={desiredAppliedInSync ? "green" : "orange"}>
                          {desiredAppliedInSync ? t("dashboard.desiredAppliedMatch") : t("dashboard.desiredAppliedMismatch")}
                        </Tag>
                        <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp}</Tag>
                        <Tag color={device.complianceSummary?.isCompliant ? "green" : "default"}>
                          isCompliant={String(device.complianceSummary?.isCompliant ?? false)}
                        </Tag>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("report.desiredVersion")}>{device.desiredConfigVersionEpochMillis ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("report.desiredConfigHash")}>{device.desiredConfigHash ? <Typography.Text code>{shortHash(device.desiredConfigHash)}</Typography.Text> : "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("report.appliedVersion")}>{device.appliedConfigVersionEpochMillis ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("report.appliedConfigHash")}>{device.appliedConfigHash ? <Typography.Text code>{shortHash(device.appliedConfigHash)}</Typography.Text> : "-"}</Descriptions.Item>
                    <Descriptions.Item label={t("report.policyAppliedAt")}>{fmtEpoch(device.lastPolicyAppliedAtEpochMillis)}</Descriptions.Item>
                    <Descriptions.Item label={t("report.policyApplyError")}>
                      {device.policyApplyError || device.policyApplyErrorCode ? (
                        <Typography.Text type="danger">
                          {device.policyApplyError ?? "-"}{device.policyApplyErrorCode ? ` [${device.policyApplyErrorCode}]` : ""}
                        </Typography.Text>
                      ) : "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card title={t("report.complianceSummary")} className="device-section-card">
                  <Space direction="vertical" size={8}>
                    <Space wrap>
                      <Tag color={device.complianceSummary?.isCompliant ? "green" : "orange"}>
                        {device.complianceSummary?.isCompliant === true ? t("report.compliant") : t("common.pending")}
                      </Tag>
                      <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp || t("common.unknown")}</Tag>
                      {device.healthSummary?.isOnline != null ? (
                        <Tag color={device.healthSummary.isOnline ? "green" : "red"}>online={String(device.healthSummary.isOnline)}</Tag>
                      ) : null}
                      {device.healthSummary?.telemetryFreshness ? (
                        <Tag color={telemetryFreshnessColor(device.healthSummary.telemetryFreshness)}>
                          telemetry={device.healthSummary.telemetryFreshness}
                        </Tag>
                      ) : null}
                    </Space>
                    <Typography.Text type="secondary">{t("report.uiDerivedSourceOfTruth")}</Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>
            </div>
          </section>

          <Card title={t("device.policyProfileSection")} className="linked-profile-card device-section-card device-section-surface">
            {linkedProfile ? (
              <div className="page-stack">
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={10}>
                    <div className="profile-panel">
                      <Typography.Text type="secondary">{t("device.profileIdentity")}</Typography.Text>
                      <Typography.Title level={5} style={{ marginTop: 6, marginBottom: 4 }}>{linkedProfile.name}</Typography.Title>
                      <Space wrap>
                        <Tag color="blue">{linkedProfile.userCode}</Tag>
                        <Typography.Text code>{linkedProfile.id}</Typography.Text>
                      </Space>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
                        {t("common.updated")} {fmtRelativeFromNow(linkedProfile.updatedAtEpochMillis)} · {fmtEpoch(linkedProfile.updatedAtEpochMillis)}
                      </Typography.Paragraph>
                    </div>
                  </Col>
                  <Col xs={24} lg={14}>
                    <div className="profile-panel">
                      <Typography.Text type="secondary">{t("device.desiredApplied")}</Typography.Text>
                      <div className="profile-sync-row">
                        <Space wrap>
                          <Tag color={desiredAppliedInSync ? "green" : "orange"}>
                            {desiredAppliedInSync ? t("dashboard.desiredAppliedMatch") : t("dashboard.desiredAppliedMismatch")}
                          </Tag>
                          <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp}</Tag>
                          <Tag color={device.hasFcmToken ? "blue" : "default"}>FCM={String(device.hasFcmToken)}</Tag>
                          {device.lastWakeupResult ? <Tag color={wakeupResultColor(device.lastWakeupResult)}>{device.lastWakeupResult}</Tag> : null}
                        </Space>
                        <Typography.Text type="secondary">desired {shortHash(device.desiredConfigHash)} / applied {shortHash(device.appliedConfigHash)}</Typography.Text>
                        <Typography.Text type="secondary">poll {fmtRelativeFromNow(device.lastPollAtEpochMillis)} · ack {fmtRelativeFromNow(device.lastCommandAckAtEpochMillis)}</Typography.Text>
                      </div>
                    </div>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={12}>
                    <div className="profile-panel">
                      <Typography.Text strong>{t("device.corePolicy")}</Typography.Text>
                      <div className="tag-wrap" style={{ marginTop: 8 }}>
                        <Tag color={linkedProfile.kioskMode ? "green" : "default"}>kioskMode={String(linkedProfile.kioskMode)}</Tag>
                        <Tag color={linkedProfile.disableStatusBar ? "red" : "green"}>disableStatusBar={String(linkedProfile.disableStatusBar)}</Tag>
                        <Tag color={linkedProfile.blockUninstall ? "red" : "green"}>blockUninstall={String(linkedProfile.blockUninstall)}</Tag>
                        <Tag>disableWifi={String(linkedProfile.disableWifi)}</Tag>
                        <Tag>disableBluetooth={String(linkedProfile.disableBluetooth)}</Tag>
                        <Tag>disableCamera={String(linkedProfile.disableCamera)}</Tag>
                      </div>
                    </div>
                  </Col>
                  <Col xs={24} lg={12}>
                    <div className="profile-panel">
                      <Typography.Text strong>{t("device.securityHardening")}</Typography.Text>
                      <div className="tag-wrap" style={{ marginTop: 8 }}>
                        {hardeningItems.map((item) => (
                          <Tag key={item.key} color={linkedProfile[item.key] ? "red" : "default"}>
                            {t(`profile.hardening.${item.key}`)}={String(linkedProfile[item.key])}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </Col>
                </Row>

                <div className="profile-panel">
                  <Typography.Text strong>{t("device.allowedApps")} ({linkedProfile.allowedApps.length})</Typography.Text>
                  {linkedProfile.allowedApps.length === 0 ? (
                    <div style={{ marginTop: 8 }}><Tag>{t("common.empty")}</Tag></div>
                  ) : (
                    <Collapse
                      ghost
                      size="small"
                      items={[{
                        key: "apps",
                        label: (
                          <Space wrap>
                            {linkedProfile.allowedApps.slice(0, 8).map((pkg) => <Tag key={pkg}>{pkg}</Tag>)}
                            {linkedProfile.allowedApps.length > 8 ? <Tag>+{linkedProfile.allowedApps.length - 8}</Tag> : null}
                          </Space>
                        ),
                        children: (
                          <div className="allowed-app-scroll">
                            {linkedProfile.allowedApps.map((pkg) => <Tag key={pkg}>{pkg}</Tag>)}
                          </div>
                        ),
                      }]}
                    />
                  )}
                </div>
                <Alert type="info" showIcon message={t("device.backendOwned")} />
              </div>
            ) : (
              <Alert type="warning" showIcon message={t("device.noProfile")} />
            )}
          </Card>

          <Card
            title={t("device.dataSection")}
            className="stable-refresh-card device-section-card device-section-surface device-read-model-tabs"
            extra={buildRefreshExtra(telemetryRefreshing || inventoryRefreshing, telemetryRefreshError || inventoryRefreshError, telemetryLastUpdatedAt ?? inventoryLastUpdatedAt)}
          >
            <Tabs
              items={[
                {
                  key: "location",
                  label: t("device.location"),
                  children: <DeviceLocationStaticMap location={latestLocation} />,
                },
                {
                  key: "usage",
                  label: t("device.usageSummary"),
                  children: (
                    <div className="page-stack">
                      <Alert type="info" showIcon message={t("device.emptyUsageValid")} />
                      <div className="card-section-scroll">
                        {usageSummary?.items?.length ? (
                          <Table size="small" dataSource={usageSummary.items} rowKey={(item) => item.packageName} pagination={false}>
                            <Table.Column title={t("device.package")} dataIndex="packageName" />
                            <Table.Column title={t("device.duration")} render={(_, record) => fmtDurationMs(record.totalDurationMs)} />
                            <Table.Column title={t("device.sessions")} dataIndex="sessions" />
                          </Table>
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("device.noUsageSummaryRows")} />
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "events",
                  label: t("device.events"),
                  children: (
                    <div className="card-section-scroll">
                      {sortedEvents.length ? (
                        <List
                          dataSource={sortedEvents}
                          renderItem={(event) => (
                            <List.Item>
                              <div className="log-item">
                                <div className="command-item-top">
                                  <Space wrap>
                                    <Typography.Text strong>{event.type}</Typography.Text>
                                    <Tag>{event.category}</Tag>
                                    <Tag>{event.severity}</Tag>
                                    {event.errorCode ? <Tag color="red">{event.errorCode}</Tag> : null}
                                  </Space>
                                  <Typography.Text type="secondary">{fmtEpoch(event.createdAtEpochMillis)}</Typography.Text>
                                </div>
                                {event.message ? <Typography.Paragraph style={{ marginBottom: 8 }}>{event.message}</Typography.Paragraph> : null}
                                <pre className="json-box compact">{tryFormatJsonString(event.payload)}</pre>
                              </div>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("device.noDeviceEvents")} />
                      )}
                    </div>
                  ),
                },
                {
                  key: "telemetry",
                  label: t("device.telemetryEndpoint"),
                  children: (
                    <div className="card-section-scroll">
                      {telemetrySummary ? (
                        <div className="page-stack">
                          <div>
                            <Typography.Text strong>{t("device.byType")}</Typography.Text>
                            <div className="tag-wrap" style={{ marginTop: 8 }}>{aggregateTags(telemetrySummary.eventCountByType, t)}</div>
                          </div>
                          <div>
                            <Typography.Text strong>{t("device.byCategory")}</Typography.Text>
                            <div className="tag-wrap" style={{ marginTop: 8 }}>{aggregateTags(telemetrySummary.eventCountByCategory, t)}</div>
                          </div>
                          <div>
                            <Typography.Text strong>{t("device.bySeverity")}</Typography.Text>
                            <div className="tag-wrap" style={{ marginTop: 8 }}>{aggregateTags(telemetrySummary.eventCountBySeverity, t)}</div>
                          </div>
                          <Space wrap>
                            <Tag>policyApplyFailed24h={telemetrySummary.policyApplyFailed24h}</Tag>
                            <Tag>policyApplyFailed7d={telemetrySummary.policyApplyFailed7d}</Tag>
                            <Tag>generatedAt={fmtEpoch(telemetrySummary.generatedAtEpochMillis)}</Tag>
                          </Space>
                        </div>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("device.noTelemetrySummaryData")} />
                      )}
                    </div>
                  ),
                },
                {
                  key: "apps",
                  label: t("device.appInventory"),
                  children: (
                    <div className="page-stack">
                      {inventoryError ? <Alert type="error" showIcon message={inventoryError} /> : null}
                      {deviceApps.length > 0 ? (
                        <>
                          <Alert type="info" showIcon message={`${t("device.appInventoryReadModel")} GET /api/admin/devices/${device.id}/apps - ${inventoryTotal} ${t("report.rows")}`} />
                          <Table size="small" dataSource={deviceApps} rowKey={(item) => item.packageName} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 860 }}>
                            <Table.Column
                              title={t("device.app")}
                              render={(_, record: AdminDeviceAppView) => (
                                <Space direction="vertical" size={0}>
                                  <Typography.Text strong>{record.appName || "-"}</Typography.Text>
                                  <Typography.Text code>{record.packageName}</Typography.Text>
                                </Space>
                              )}
                            />
                            <Table.Column
                              title={t("device.version")}
                              render={(_, record: AdminDeviceAppView) => [record.versionName, record.versionCode != null ? `(${record.versionCode})` : null].filter(Boolean).join(" ") || "-"}
                            />
                            <Table.Column
                              title={t("device.state")}
                              render={(_, record: AdminDeviceAppView) => (
                                <Space wrap>
                                  <Tag color={record.installed ? "green" : "default"}>installed={String(record.installed)}</Tag>
                                  {record.hasLauncherActivity != null ? <Tag color={record.hasLauncherActivity ? "blue" : "default"}>launcher={String(record.hasLauncherActivity)}</Tag> : null}
                                  {record.hidden != null ? <Tag color={record.hidden ? "orange" : "default"}>hidden={String(record.hidden)}</Tag> : null}
                                  {record.disabled != null ? <Tag color={record.disabled ? "red" : "default"}>disabled={String(record.disabled)}</Tag> : null}
                                  {record.suspended != null ? <Tag color={record.suspended ? "volcano" : "default"}>suspended={String(record.suspended)}</Tag> : null}
                                </Space>
                              )}
                            />
                            <Table.Column
                              title={t("devices.lastSeen")}
                              render={(_, record: AdminDeviceAppView) => (
                                <Space direction="vertical" size={0}>
                                  <Typography.Text>{fmtEpoch(record.lastSeenAtEpochMillis)}</Typography.Text>
                                  <Typography.Text type="secondary">{fmtRelativeFromNow(record.lastSeenAtEpochMillis)}</Typography.Text>
                                </Space>
                              )}
                            />
                          </Table>
                        </>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("device.noAppInventoryRows")} />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          <section className="device-section-surface device-timeline-surface">
            <div className="device-section-header">
              <Typography.Title level={4}>{t("device.lifecycleEvidence")}</Typography.Title>
            </div>
            <div className="device-section-body">
            <ComplianceTimeline device={device} commands={commands} />
            <Card title={t("device.commandLifecycle")} className="stable-refresh-card device-section-card" extra={buildStableRefreshMeta(commandsRefreshError, commandsLastUpdatedAt)}>
              <Alert type="info" style={{ marginBottom: 16 }} message={commandMessage || t("command.timelineReflectsBackend")} />
              <CommandTimeline
                commands={commands}
                loading={initialLoading && commands.length === 0}
                emptyText={commandMessage || t("command.noCommandData")}
                onCancelCommand={cancelCommand}
                cancelBusyId={cancelBusyId}
                actionsBlocked={deviceLostContact}
                blockedReason={t("devices.reconnectBeforeAction")}
                onBlockedAction={warnLostContactAction}
              />
            </Card>

            <Card title={t("device.actionLog")} className="device-section-card">
              {actionLogs.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("device.noActionsYet")} />
              ) : (
                <div className="scroll-panel">
                  {actionLogs.map((log) => (
                    <div key={log.id} className="log-item">
                      <div className="command-item-top">
                        <Typography.Text strong>{log.action}</Typography.Text>
                        <Tag color={log.status === "SUCCESS" ? "green" : log.status === "FAILED" ? "red" : "blue"}>{log.status}</Tag>
                      </div>
                      <Typography.Text>{log.target}</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {fmtEpoch(log.atEpochMillis)} - {log.message}
                      </Typography.Paragraph>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            </div>
          </section>

          <section className="device-section-surface device-report-surface">
            <div className="device-section-header">
              <Typography.Title level={4}>{t("device.reportExport")}</Typography.Title>
            </div>
            <div className="device-section-body">
            <DeviceManagementReport
              device={device}
              linkedProfile={linkedProfile}
              latestLocation={latestLocation}
              events={events}
              usageSummary={usageSummary}
              telemetrySummary={telemetrySummary}
              onExportJson={exportDeviceReportJson}
              exportDisabled={!device}
            />
            </div>
          </section>
        </Col>

        <Col xs={24} xl={8} className="device-detail-control-column">
          <div className="device-sticky-control">
            <Card title={t("device.controlCenter")} className="device-section-card device-control-rail">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Card size="small" title={t("device.controlConnectivity")} className="stable-refresh-card device-action-group" extra={buildStableRefreshMeta(coreRefreshError, coreLastUpdatedAt)}>
                  <Descriptions bordered size="small" column={1} className="device-compact-descriptions">
                    <Descriptions.Item label={t("device.hasFcmToken")}><Tag color={device.hasFcmToken ? "blue" : "default"}>{String(device.hasFcmToken)}</Tag></Descriptions.Item>
                    <Descriptions.Item label={t("device.tokenUpdated")}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{fmtEpoch(device.fcmTokenUpdatedAtEpochMillis)}</Typography.Text>
                        <Typography.Text className="device-action-time-meta" title={fmtEpoch(device.fcmTokenUpdatedAtEpochMillis)}>{device.fcmTokenUpdatedAtEpochMillis ? t("device.recentlyUpdated") : t("common.notAvailable")}</Typography.Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("device.lastWakeupAttempt")}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{fmtEpoch(device.lastWakeupAttemptAtEpochMillis)}</Typography.Text>
                        <Typography.Text className="device-action-time-meta" title={fmtEpoch(device.lastWakeupAttemptAtEpochMillis)}>{device.lastWakeupAttemptAtEpochMillis ? t("device.recentlyUpdated") : t("common.notAvailable")}</Typography.Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("device.lastWakeupReason")}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{wakeupReasonDisplay(device.lastWakeupReason, t)}</Typography.Text>
                        {device.lastWakeupReason && wakeupReasonDisplay(device.lastWakeupReason, t) !== device.lastWakeupReason ? (
                          <Typography.Text type="secondary" code>{device.lastWakeupReason}</Typography.Text>
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t("device.lastWakeupResult")}>
                      {device.lastWakeupResult ? (
                        <Space direction="vertical" size={0}>
                          <Tag color={wakeupResultColor(device.lastWakeupResult)}>{wakeupResultDisplay(device.lastWakeupResult, t)}</Tag>
                          {wakeupResultDisplay(device.lastWakeupResult, t) !== device.lastWakeupResult ? (
                            <Typography.Text type="secondary" code>{device.lastWakeupResult}</Typography.Text>
                          ) : null}
                        </Space>
                      ) : "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <QuickActionsCard
                  profiles={profiles}
                  selectedUserCode={selectedUserCode}
                  onSelectedUserCodeChange={(value) => {
                    setSelectedUserCode(value);
                    setLinkDirty(true);
                  }}
                  onLink={() => updateLink(selectedUserCode)}
                  onUnlink={() => updateLink(null)}
                  onUnlock={unlockDevice}
                  onLock={lockDevice}
                  onResetUnlockPass={resetUnlockPass}
                  onCreateCommand={createCommand}
                  actionBusy={actionBusy}
                  actionsBlocked={deviceLostContact}
                  blockedReason={t("devices.reconnectBeforeAction")}
                  onBlockedAction={warnLostContactAction}
                />
              </Space>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};
