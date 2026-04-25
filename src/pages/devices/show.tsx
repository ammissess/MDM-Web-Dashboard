import React, { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
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
  normalizeError,
  policyStatusColor,
  telemetryFreshnessColor,
  tryFormatJsonString,
} from "../../utils/format";
import { LiveStatusBadge } from "./components/LiveStatusBadge";
import { CommandTimeline } from "./components/CommandTimeline";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { DeviceLocationStaticMap } from "./components/DeviceLocationStaticMap";
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

function aggregateTags(items: { key: string; count: number }[]) {
  if (!items.length) return <Tag>empty</Tag>;
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

const hardeningItems: Array<{ key: keyof ProfileResponse; label: string }> = [
  { key: "lockPrivateDnsConfig", label: "Lock Private DNS" },
  { key: "lockVpnConfig", label: "Lock VPN" },
  { key: "blockDebuggingFeatures", label: "Block debugging" },
  { key: "disableUsbDataSignaling", label: "Disable USB data" },
  { key: "disallowSafeBoot", label: "Disallow safe boot" },
  { key: "disallowFactoryReset", label: "Disallow factory reset" },
];

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

  const pushLog = useCallback((entry: Omit<UiActionLog, "id" | "atEpochMillis">) => {
    setActionLogs((prev) => [makeUiLog(entry), ...prev].slice(0, 20));
  }, []);

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
      const msg = normalizeError(err, "Cannot load device detail");
      setError(msg);
      setCoreRefreshError(msg);
      // Keep the previous snapshot during background refresh failures to avoid UI flicker.
    } finally {
      if (mode === "background") {
        setCoreRefreshing(false);
      }
    }
  }, [deviceId, linkDirty]);

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
      setCommandMessage((data.items ?? []).length === 0 ? "No command rows for this device yet." : "");
      setCommandsRefreshError(null);
      setCommandsLastUpdatedAt(Date.now());
    } catch (err) {
      // Keep the previous command timeline during background refresh failures.
      const msg = normalizeError(err, "Cannot load command list");
      setCommandMessage(msg);
      setCommandsRefreshError(msg);
    } finally {
      if (mode === "background") {
        setCommandsRefreshing(false);
      }
    }
  }, [deviceId]);

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
        setTelemetryRefreshError("Last refresh failed for some telemetry sections");
      } else {
        setTelemetryRefreshError(null);
      }
      setTelemetryLastUpdatedAt(Date.now());
    } catch (err) {
      setTelemetryRefreshError(normalizeError(err, "Cannot load telemetry/read model"));
    } finally {
      if (mode === "background") {
        setTelemetryRefreshing(false);
      }
    }
  }, [deviceId]);

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
      const msg = normalizeError(err, "Cannot load app inventory");
      setInventoryError(msg);
      setInventoryRefreshError(msg);
    } finally {
      if (mode === "background") {
        setInventoryRefreshing(false);
      }
    }
  }, [deviceId]);

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
    setActionBusy(true);
    try {
      await http.put(`/api/admin/devices/${device.id}/link`, { userCode });
      pushLog({
        scope: "DEVICE",
        action: userCode ? "LINK_PROFILE" : "UNLINK_PROFILE",
        target: device.deviceCode,
        status: "SUCCESS",
        message: userCode ? `Linked to ${userCode}` : "Profile unlinked",
      });
      message.success(userCode ? `Linked to ${userCode}` : "Profile unlinked");
      setSelectedUserCode(userCode);
      setLinkDirty(false);
      await loadCore("background");
      await loadCommands("background");
      window.setTimeout(() => {
        void loadCore("background");
        void loadCommands("background");
      }, 1200);
    } catch (err) {
      const msg = normalizeError(err, "Link update failed");
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
      message.success(`Unlock success: ${data.status}`);
      await loadCore("background");
    } catch (err) {
      const msg = normalizeError(err, "Unlock failed");
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
    setActionBusy(true);
    try {
      await http.post(`/api/admin/devices/${device.id}/lock`);
      pushLog({
        scope: "DEVICE",
        action: "LOCK_DEVICE",
        target: device.deviceCode,
        status: "SUCCESS",
        message: "Backend status set to LOCKED via /lock",
      });
      message.success("Backend status set to LOCKED");
      await loadCore("background");
    } catch (err) {
      const msg = normalizeError(err, "Lock failed");
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
    setActionBusy(true);
    try {
      await http.post(`/api/admin/devices/${device.id}/reset-unlock-pass`, { newPassword });
      pushLog({
        scope: "DEVICE",
        action: "RESET_UNLOCK_PASS",
        target: device.deviceCode,
        status: "SUCCESS",
        message: "Unlock password reset",
      });
      message.success("Unlock password reset");
    } catch (err) {
      const msg = normalizeError(err, "Reset unlock pass failed");
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
    setActionBusy(true);
    try {
      const { data } = await http.post<CommandView>(`/api/admin/devices/${device.id}/commands`, values);
      pushLog({
        scope: "COMMAND",
        action: "CREATE_COMMAND",
        target: device.deviceCode,
        status: "SUCCESS",
        message: `${data.type} queued via /commands`,
      });
      message.success(`Command queued via /commands: ${data.type}`);
      await loadCommands("background");
      window.setTimeout(() => {
        void loadCore("background");
        void loadCommands("background");
      }, 1200);
    } catch (err) {
      const msg = normalizeError(err, "Create command failed");
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
    setCancelBusyId(command.id);
    try {
      await http.post(`/api/admin/devices/${device.id}/commands/${command.id}/cancel`, {
        reason: "Cancelled from dashboard",
      });
      pushLog({
        scope: "COMMAND",
        action: "CANCEL_COMMAND",
        target: command.id,
        status: "SUCCESS",
        message: `${command.type} cancelled`,
      });
      message.success(`Command cancelled: ${command.type}`);
      await loadCommands("background");
    } catch (err) {
      const msg = normalizeError(err, "Cancel command failed");
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

  if (initialLoading && !device) {
    return (
      <Card>
        <Alert type="info" message="Loading device..." />
      </Card>
    );
  }

  if (!device) {
    return (
      <Card>
        <Empty description={error ?? "Device not found"} />
      </Card>
    );
  }

  const statusUp = String(device.status).toUpperCase();
  const policyStatusUp = String(device.policyApplyStatus).toUpperCase();
  const desiredAppliedInSync = device.complianceSummary?.isCompliant === true;
  const buildRefreshExtra = (refreshing: boolean, failed: string | null, updatedAt: number | null) => (
    <Space size={8}>
      {refreshing ? <Tag color="processing">Updating...</Tag> : null}
      {failed ? <Tag color="warning">Last refresh failed</Tag> : null}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {fmtRelativeFromNow(updatedAt)}
      </Typography.Text>
    </Space>
  );

  return (
    <div className="page-stack">
      {error ? <Alert type="warning" message={error} description="Previous snapshot is kept on screen while refresh retries." /> : null}

      <Row gutter={[16, 16]} className="device-detail-grid">
        <Col xs={24} xl={14} className="device-detail-left">
          <Card
            title={
              <Space>
                <Typography.Text strong>{device.deviceCode}</Typography.Text>
                <Tag color={statusUp === "ACTIVE" ? "green" : statusUp === "LOCKED" ? "red" : "default"}>{statusUp}</Tag>
              </Space>
            }
          >
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Device Code">
                <Typography.Text code>{device.deviceCode}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Linked userCode">
                {device.userCode ? <Tag color="blue">{device.userCode}</Tag> : <Tag>unlinked</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Manufacturer">{device.manufacturer || "-"}</Descriptions.Item>
              <Descriptions.Item label="Model">{device.model || "-"}</Descriptions.Item>
              <Descriptions.Item label="Android / SDK">
                {device.androidVersion || "-"} / {device.sdkInt}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Space wrap>
                  <Tag color={statusUp === "ACTIVE" ? "green" : statusUp === "LOCKED" ? "red" : "default"}>{statusUp}</Tag>
                  <LiveStatusBadge
                    isOnline={device.healthSummary?.isOnline}
                    lastSeenAtEpochMillis={device.lastSeenAtEpochMillis}
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Battery / charging">
                {device.batteryLevel >= 0 ? `${device.batteryLevel}%` : "-"} / {device.isCharging ? "charging" : "not charging"}
              </Descriptions.Item>
              <Descriptions.Item label="Last seen">
                <Space direction="vertical" size={0}>
                  <Typography.Text>{fmtEpoch(device.lastSeenAtEpochMillis)}</Typography.Text>
                  <Typography.Text type="secondary">{fmtRelativeFromNow(device.lastSeenAtEpochMillis)}</Typography.Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Last telemetry">{fmtEpoch(device.lastTelemetryAtEpochMillis)}</Descriptions.Item>
              <Descriptions.Item label="Last poll">{fmtEpoch(device.lastPollAtEpochMillis)}</Descriptions.Item>
              <Descriptions.Item label="Last command ack">{fmtEpoch(device.lastCommandAckAtEpochMillis)}</Descriptions.Item>
              <Descriptions.Item label="Telemetry freshness">
                <Tag color={telemetryFreshnessColor(device.healthSummary?.telemetryFreshness)}>
                  {device.healthSummary?.telemetryFreshness ?? "UNKNOWN"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="State snapshot" style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Network type">{device.networkType ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="WiFi enabled">{String(device.wifiEnabled)}</Descriptions.Item>
              <Descriptions.Item label="Foreground package">{device.foregroundPackage ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Launcher package">{device.currentLauncherPackage ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Agent version / build">
                {device.agentVersion ?? "-"} / {device.agentBuildCode ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="IP address">{device.ipAddress ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Device owner">{String(device.isDeviceOwner)}</Descriptions.Item>
              <Descriptions.Item label="Launcher default">{String(device.isLauncherDefault)}</Descriptions.Item>
              <Descriptions.Item label="Kiosk running">{String(device.isKioskRunning)}</Descriptions.Item>
              <Descriptions.Item label="Storage free / total">
                {fmtBytes(device.storageFreeBytes)} / {fmtBytes(device.storageTotalBytes)}
              </Descriptions.Item>
              <Descriptions.Item label="RAM free / total">
                {device.ramFreeMb} MB / {device.ramTotalMb} MB
              </Descriptions.Item>
              <Descriptions.Item label="Uptime">{fmtDurationMs(device.uptimeMs)}</Descriptions.Item>
              <Descriptions.Item label="Last boot">{fmtEpoch(device.lastBootAtEpochMillis)}</Descriptions.Item>
              <Descriptions.Item label="ABI">{device.abi ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Build fingerprint">{device.buildFingerprint ?? "-"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Desired vs applied" style={{ marginTop: 16 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Summary">
                <Space wrap>
                  <Tag color={desiredAppliedInSync ? "green" : "orange"}>
                    {desiredAppliedInSync ? "desired = applied" : "desired != applied"}
                  </Tag>
                  <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp}</Tag>
                  <Tag color={device.complianceSummary?.isCompliant ? "green" : "default"}>
                    isCompliant={String(device.complianceSummary?.isCompliant ?? false)}
                  </Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Desired config version">
                {device.desiredConfigVersionEpochMillis ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Desired config hash">
                {device.desiredConfigHash ? <Typography.Text code>{shortHash(device.desiredConfigHash)}</Typography.Text> : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Applied config version">
                {device.appliedConfigVersionEpochMillis ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Applied config hash">
                {device.appliedConfigHash ? <Typography.Text code>{shortHash(device.appliedConfigHash)}</Typography.Text> : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Last policy applied">
                {fmtEpoch(device.lastPolicyAppliedAtEpochMillis)}
              </Descriptions.Item>
              <Descriptions.Item label="Policy error">
                {device.policyApplyError || device.policyApplyErrorCode ? (
                  <Typography.Text type="danger">
                    {device.policyApplyError ?? "-"}
                    {device.policyApplyErrorCode ? ` [${device.policyApplyErrorCode}]` : ""}
                  </Typography.Text>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t("device.currentProfile")} style={{ marginTop: 16 }} className="linked-profile-card">
            {linkedProfile ? (
              <div className="page-stack">
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={10}>
                    <Card size="small" className="profile-subcard">
                      <Typography.Text type="secondary">{t("device.profileIdentity")}</Typography.Text>
                      <Typography.Title level={5} style={{ marginTop: 6, marginBottom: 4 }}>
                        {linkedProfile.name}
                      </Typography.Title>
                      <Space wrap>
                        <Tag color="blue">{linkedProfile.userCode}</Tag>
                        <Typography.Text code>{linkedProfile.id}</Typography.Text>
                      </Space>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
                        Updated {fmtRelativeFromNow(linkedProfile.updatedAtEpochMillis)} · {fmtEpoch(linkedProfile.updatedAtEpochMillis)}
                      </Typography.Paragraph>
                    </Card>
                  </Col>

                  <Col xs={24} lg={14}>
                    <Card size="small" className="profile-subcard">
                      <Typography.Text type="secondary">{t("device.desiredApplied")}</Typography.Text>
                      <div className="profile-sync-row">
                        <Space wrap>
                          <Tag color={desiredAppliedInSync ? "green" : "orange"}>
                            {desiredAppliedInSync ? "desired=applied" : "desired!=applied"}
                          </Tag>
                          <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatusUp}</Tag>
                          <Tag color={device.hasFcmToken ? "blue" : "default"}>FCM={String(device.hasFcmToken)}</Tag>
                          {device.lastWakeupResult ? <Tag color={wakeupResultColor(device.lastWakeupResult)}>{device.lastWakeupResult}</Tag> : null}
                        </Space>
                        <Typography.Text type="secondary">
                          desired {shortHash(device.desiredConfigHash)} / applied {shortHash(device.appliedConfigHash)}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          poll {fmtRelativeFromNow(device.lastPollAtEpochMillis)} · ack {fmtRelativeFromNow(device.lastCommandAckAtEpochMillis)}
                        </Typography.Text>
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={12}>
                    <Card size="small" title={t("device.corePolicy")} className="profile-subcard">
                      <Space wrap>
                        <Tag color={linkedProfile.kioskMode ? "green" : "default"}>kioskMode={String(linkedProfile.kioskMode)}</Tag>
                        <Tag color={linkedProfile.disableStatusBar ? "red" : "green"}>disableStatusBar={String(linkedProfile.disableStatusBar)}</Tag>
                        <Tag color={linkedProfile.blockUninstall ? "red" : "green"}>blockUninstall={String(linkedProfile.blockUninstall)}</Tag>
                        <Tag>disableWifi={String(linkedProfile.disableWifi)}</Tag>
                        <Tag>disableBluetooth={String(linkedProfile.disableBluetooth)}</Tag>
                        <Tag>disableCamera={String(linkedProfile.disableCamera)}</Tag>
                      </Space>
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card size="small" title={t("device.securityHardening")} className="profile-subcard">
                      <Space wrap>
                        {hardeningItems.map((item) => (
                          <Tag key={item.key} color={linkedProfile[item.key] ? "red" : "default"}>
                            {item.label}={String(linkedProfile[item.key])}
                          </Tag>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title={`${t("device.allowedApps")} (${linkedProfile.allowedApps.length})`} className="profile-subcard">
                  {linkedProfile.allowedApps.length === 0 ? (
                    <Tag>{t("common.empty")}</Tag>
                  ) : (
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: "apps",
                          label: (
                            <Space wrap>
                              {linkedProfile.allowedApps.slice(0, 8).map((pkg) => (
                                <Tag key={pkg}>{pkg}</Tag>
                              ))}
                              {linkedProfile.allowedApps.length > 8 ? <Tag>+{linkedProfile.allowedApps.length - 8}</Tag> : null}
                            </Space>
                          ),
                          children: (
                            <div className="allowed-app-scroll">
                              {linkedProfile.allowedApps.map((pkg) => (
                                <Tag key={pkg}>{pkg}</Tag>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </Card>

                <Alert type="info" showIcon message={t("device.backendOwned")} />
              </div>
            ) : (
              <Alert type="warning" showIcon message={t("device.noProfile")} />
            )}
          </Card>

          <Card
            title={t("device.appInventory")}
            style={{ marginTop: 16 }}
            className="stable-refresh-card"
            extra={buildRefreshExtra(inventoryRefreshing, inventoryRefreshError, inventoryLastUpdatedAt)}
          >
            {inventoryError ? <Alert type="error" showIcon message={inventoryError} style={{ marginBottom: 12 }} /> : null}

            {deviceApps.length > 0 ? (
              <div className="page-stack">
                <Alert
                  type="info"
                  showIcon
                  message={`Read model from GET /api/admin/devices/${device.id}/apps - ${inventoryTotal} rows`}
                />

                <Table
                  size="small"
                  dataSource={deviceApps}
                  rowKey={(item) => item.packageName}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 860 }}
                >
                  <Table.Column
                    title="App"
                    render={(_, record: AdminDeviceAppView) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>{record.appName || "-"}</Typography.Text>
                        <Typography.Text code>{record.packageName}</Typography.Text>
                      </Space>
                    )}
                  />
                  <Table.Column
                    title="Version"
                    render={(_, record: AdminDeviceAppView) =>
                      [record.versionName, record.versionCode != null ? `(${record.versionCode})` : null]
                        .filter(Boolean)
                        .join(" ") || "-"
                    }
                  />
                  <Table.Column
                    title="State"
                    render={(_, record: AdminDeviceAppView) => (
                      <Space wrap>
                        <Tag color={record.installed ? "green" : "default"}>installed={String(record.installed)}</Tag>
                        {record.hasLauncherActivity != null ? (
                          <Tag color={record.hasLauncherActivity ? "blue" : "default"}>
                            launcher={String(record.hasLauncherActivity)}
                          </Tag>
                        ) : null}
                        {record.hidden != null ? (
                          <Tag color={record.hidden ? "orange" : "default"}>hidden={String(record.hidden)}</Tag>
                        ) : null}
                        {record.disabled != null ? (
                          <Tag color={record.disabled ? "red" : "default"}>disabled={String(record.disabled)}</Tag>
                        ) : null}
                        {record.suspended != null ? (
                          <Tag color={record.suspended ? "volcano" : "default"}>suspended={String(record.suspended)}</Tag>
                        ) : null}
                      </Space>
                    )}
                  />
                  <Table.Column
                    title="Last seen"
                    render={(_, record: AdminDeviceAppView) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{fmtEpoch(record.lastSeenAtEpochMillis)}</Typography.Text>
                        <Typography.Text type="secondary">{fmtRelativeFromNow(record.lastSeenAtEpochMillis)}</Typography.Text>
                      </Space>
                    )}
                  />
                </Table>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No app inventory rows" />
            )}
          </Card>

          <Card
            title={t("device.commandLifecycle")}
            style={{ marginTop: 16 }}
            className="stable-refresh-card"
            extra={buildRefreshExtra(commandsRefreshing, commandsRefreshError, commandsLastUpdatedAt)}
          >
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message={commandMessage || "Timeline reflects create → SENT → SUCCESS/FAILED/CANCELLED/EXPIRED from the backend read model."}
            />
            <CommandTimeline
              commands={commands}
              loading={initialLoading && commands.length === 0}
              emptyText={commandMessage || "No command data"}
              onCancelCommand={cancelCommand}
              cancelBusyId={cancelBusyId}
            />
          </Card>

        </Col>

        <Col xs={24} xl={10} className="device-detail-right">
          <Card title="FCM transport health" className="stable-refresh-card" extra={buildRefreshExtra(coreRefreshing, coreRefreshError, coreLastUpdatedAt)}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Has FCM token">
                <Tag color={device.hasFcmToken ? "blue" : "default"}>{String(device.hasFcmToken)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Token updated">
                <Space direction="vertical" size={0}>
                  <Typography.Text>{fmtEpoch(device.fcmTokenUpdatedAtEpochMillis)}</Typography.Text>
                  <Typography.Text type="secondary">{fmtRelativeFromNow(device.fcmTokenUpdatedAtEpochMillis)}</Typography.Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Last wake-up attempt">
                <Space direction="vertical" size={0}>
                  <Typography.Text>{fmtEpoch(device.lastWakeupAttemptAtEpochMillis)}</Typography.Text>
                  <Typography.Text type="secondary">{fmtRelativeFromNow(device.lastWakeupAttemptAtEpochMillis)}</Typography.Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Last wake-up reason">{device.lastWakeupReason ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Last wake-up result">
                {device.lastWakeupResult ? (
                  <Tag color={wakeupResultColor(device.lastWakeupResult)}>{device.lastWakeupResult}</Tag>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t("device.statusCommandActions")} style={{ marginTop: 16 }}>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Backend status lock and lock_screen command are separate flows."
              description="Set status LOCKED calls /lock. Sending lock_screen goes through /commands and appears in the command lifecycle."
            />
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
            />
          </Card>

          <Card
            title="Telemetry / read model"
            style={{ marginTop: 16 }}
            className="stable-refresh-card"
            extra={buildRefreshExtra(telemetryRefreshing, telemetryRefreshError, telemetryLastUpdatedAt)}
          >
            <Row gutter={[12, 12]}>
              <Col span={24}>
                <Card size="small" title={t("device.location")}>
                  <DeviceLocationStaticMap location={latestLocation} />
                </Card>
              </Col>

              <Col span={24}>
                <Card size="small" title="Usage summary">
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Empty time-window usage summary can be valid from backend read model."
                  />
                  <div className="card-section-scroll">
                    {usageSummary?.items?.length ? (
                      <Table
                        size="small"
                        dataSource={usageSummary.items}
                        rowKey={(item) => item.packageName}
                        pagination={false}
                      >
                        <Table.Column title="Package" dataIndex="packageName" />
                        <Table.Column title="Duration" render={(_, record) => fmtDurationMs(record.totalDurationMs)} />
                        <Table.Column title="Sessions" dataIndex="sessions" />
                      </Table>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No usage summary rows in current read model" />
                    )}
                  </div>
                </Card>
              </Col>

              <Col span={24}>
                <Card size="small" title={t("device.events")}>
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
                              {event.message ? (
                                <Typography.Paragraph style={{ marginBottom: 8 }}>{event.message}</Typography.Paragraph>
                              ) : null}
                              <pre className="json-box compact">{tryFormatJsonString(event.payload)}</pre>
                            </div>
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No device events" />
                    )}
                  </div>
                </Card>
              </Col>

              <Col span={24}>
                <Card size="small" title="Telemetry summary endpoint">
                  <div className="card-section-scroll">
                    {telemetrySummary ? (
                      <div className="page-stack">
                        <div>
                          <Typography.Text strong>By type</Typography.Text>
                          <div className="tag-wrap" style={{ marginTop: 8 }}>
                            {aggregateTags(telemetrySummary.eventCountByType)}
                          </div>
                        </div>
                        <div>
                          <Typography.Text strong>By category</Typography.Text>
                          <div className="tag-wrap" style={{ marginTop: 8 }}>
                            {aggregateTags(telemetrySummary.eventCountByCategory)}
                          </div>
                        </div>
                        <div>
                          <Typography.Text strong>By severity</Typography.Text>
                          <div className="tag-wrap" style={{ marginTop: 8 }}>
                            {aggregateTags(telemetrySummary.eventCountBySeverity)}
                          </div>
                        </div>
                        <Space wrap>
                          <Tag>policyApplyFailed24h={telemetrySummary.policyApplyFailed24h}</Tag>
                          <Tag>policyApplyFailed7d={telemetrySummary.policyApplyFailed7d}</Tag>
                          <Tag>generatedAt={fmtEpoch(telemetrySummary.generatedAtEpochMillis)}</Tag>
                        </Space>
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No telemetry summary data" />
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          <Card title="Action log" style={{ marginTop: 16 }}>
            {actionLogs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No actions yet" />
            ) : (
              <div className="page-stack">
                {actionLogs.map((log) => (
                  <div key={log.id} className="log-item">
                    <div className="command-item-top">
                      <Typography.Text strong>{log.action}</Typography.Text>
                      <Tag color={log.status === "SUCCESS" ? "green" : log.status === "FAILED" ? "red" : "blue"}>
                        {log.status}
                      </Tag>
                    </div>
                    <Typography.Text>{log.target}</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {fmtEpoch(log.atEpochMillis)} — {log.message}
                    </Typography.Paragraph>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

