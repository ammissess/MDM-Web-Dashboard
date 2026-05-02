import React, { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { DeviceResponse, ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fmtEpoch, isLostContactFromLastSeen, normalizeError, onlineStateFromLastSeen } from "../../utils/format";
import { downloadCsv, formatDateForFileName } from "../../utils/export";
import { LiveStatusBadge } from "./components/LiveStatusBadge";
import { useT } from "../../i18n";

function deviceCsvColumns(t: (key: string) => string) {
  return [
    { key: "id", title: "id" },
    { key: "deviceCode", title: "deviceCode" },
    { key: "status", title: t("common.status") },
    { key: "linkedUserCode", title: t("devices.policyProfile") },
    { key: "lastSeen", title: t("devices.lastSeen") },
    { key: "lastSeenEpochMillis", title: "lastSeenEpochMillis" },
    { key: "batteryLevel", title: t("devices.battery") },
    { key: "isCharging", title: t("devices.chargingCsvColumn") },
    { key: "wifiEnabled", title: "wifiEnabled" },
    { key: "androidVersion", title: "androidVersion" },
    { key: "sdkInt", title: t("devices.sdk") },
    { key: "manufacturer", title: "manufacturer" },
    { key: "model", title: "model" },
    { key: "imei", title: "imei" },
    { key: "serial", title: "serial" },
  ];
}

function toDeviceCsvRows(items: DeviceResponse[]): Record<string, unknown>[] {
  return items.map((item) => ({
    id: item.id,
    deviceCode: item.deviceCode,
    status: item.status,
    linkedUserCode: item.userCode,
    lastSeen: fmtEpoch(item.lastSeenAtEpochMillis),
    lastSeenEpochMillis: item.lastSeenAtEpochMillis,
    batteryLevel: item.batteryLevel,
    isCharging: item.isCharging,
    wifiEnabled: item.wifiEnabled,
    androidVersion: item.androidVersion,
    sdkInt: item.sdkInt,
    manufacturer: item.manufacturer,
    model: item.model,
    imei: item.imei,
    serial: item.serial,
  }));
}

function formatRelative(value: number | null | undefined, t: (key: string) => string) {
  if (!value || Number.isNaN(value)) return t("common.unknown");

  const diff = Date.now() - value;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? t("devices.relativeAgo") : t("devices.relativeFromNow");

  if (abs < 1_000) return diff >= 0 ? t("devices.justNow") : t("devices.inUnderOneSecond");
  if (abs < 60_000) return `${Math.floor(abs / 1_000)}s ${suffix}`;
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ${suffix}`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ${suffix}`;
  return `${Math.floor(abs / 86_400_000)}d ${suffix}`;
}

function deviceStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  const up = String(status ?? "").toUpperCase();
  if (up === "ACTIVE") return t("devices.statusActive");
  if (up === "LOCKED") return t("devices.statusLocked");
  return up || "-";
}

function isValidBatteryLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function chargingLabel(value: boolean | null | undefined, t: (key: string) => string) {
  if (value === true) return t("devices.charging");
  if (value === false) return t("devices.notCharging");
  return t("devices.chargingUnknown");
}

function isSuspectedTestDevice(device: DeviceResponse) {
  const deviceCode = String(device.deviceCode ?? "").toLowerCase();
  const model = String(device.model ?? "").toLowerCase();
  const lostContact = isLostContactFromLastSeen(device.lastSeenAtEpochMillis);

  return (
    deviceCode.includes("test") ||
    deviceCode.startsWith("auto_dev") ||
    deviceCode.includes("ticket") ||
    model.includes("test") ||
    (!device.userCode && lostContact)
  );
}

export const DeviceListPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [profiles, setProfiles] = useState<ProfileResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [hideSuspectedTestDevices, setHideSuspectedTestDevices] = useState(false);
  const [showLostContactOnly, setShowLostContactOnly] = useState(false);
  const [showManageableOnly, setShowManageableOnly] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<DeviceResponse | null>(null);
  const [selectedUserCode, setSelectedUserCode] = useState<string | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<DeviceResponse | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [devicesRes, profilesRes] = await Promise.all([
        http.get<DeviceResponse[]>("/api/admin/devices"),
        http.get<ProfileResponse[]>("/api/admin/profiles"),
      ]);
      setDevices(devicesRes.data ?? []);
      setProfiles(profilesRes.data ?? []);
      setError(null);
    } catch (err) {
      setError(normalizeError(err, t("devices.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useAutoRefresh(load, true, 5_000, [load]);

  const profileByUserCode = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.userCode, profile]));
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return devices.filter((item) => {
      const linkedProfile = item.userCode ? profileByUserCode.get(item.userCode) : null;
      const connectionState = onlineStateFromLastSeen(item.lastSeenAtEpochMillis);
      const statusOk = !statusFilter || String(item.status).toUpperCase() === statusFilter;
      const lostContactOk = !showLostContactOnly || connectionState === "lost_contact";
      const manageableOk = !showManageableOnly || connectionState !== "lost_contact";
      const suspectedTestOk = !hideSuspectedTestDevices || !isSuspectedTestDevice(item);
      const keywordOk =
        !q ||
        item.deviceCode.toLowerCase().includes(q) ||
        String(item.userCode ?? "").toLowerCase().includes(q) ||
        String(linkedProfile?.name ?? "").toLowerCase().includes(q) ||
        String(item.manufacturer ?? "").toLowerCase().includes(q) ||
        String(item.model ?? "").toLowerCase().includes(q);

      return statusOk && lostContactOk && manageableOk && suspectedTestOk && keywordOk;
    });
  }, [devices, hideSuspectedTestDevices, keyword, profileByUserCode, showLostContactOnly, showManageableOnly, statusFilter]);

  const listGuideItemKeys = [
    "devices.listGuide.search",
    "devices.listGuide.filters",
    "devices.listGuide.lostContactActions",
    "devices.listGuide.manageableOnly",
    "devices.listGuide.testFilter",
  ];

  function warnLostContactAction() {
    message.warning(t("devices.lostContactActionBlocked"));
  }

  function closeUnlockModal() {
    setUnlockModalOpen(false);
    setUnlockTarget(null);
    setUnlockPassword("");
  }

  function openUnlockModal(device: DeviceResponse) {
    if (isLostContactFromLastSeen(device.lastSeenAtEpochMillis)) {
      warnLostContactAction();
      return;
    }
    setUnlockTarget(device);
    setUnlockPassword("");
    setUnlockModalOpen(true);
  }

  async function submitUnlock() {
    if (!unlockTarget || !unlockPassword) return;

    setActionBusy(true);
    try {
      const { data } = await http.post("/api/device/unlock", {
        deviceCode: unlockTarget.deviceCode,
        password: unlockPassword,
      });
      message.success(`${t("devices.unlockSuccess")}: ${data.status}`);
      closeUnlockModal();
      await load();
    } catch (err) {
      message.error(normalizeError(err, t("devices.unlockFailed")));
    } finally {
      setActionBusy(false);
    }
  }

  function openLinkModal(device: DeviceResponse) {
    if (isLostContactFromLastSeen(device.lastSeenAtEpochMillis)) {
      warnLostContactAction();
      return;
    }
    setLinkTarget(device);
    setSelectedUserCode(device.userCode ?? null);
    setLinkModalOpen(true);
  }

  async function saveLink() {
    if (!linkTarget) return;
    setActionBusy(true);
    try {
      await http.put(`/api/admin/devices/${linkTarget.id}/link`, {
        userCode: selectedUserCode,
      });
      message.success(t("devices.assignSuccess"));
      setLinkModalOpen(false);
      await load();
    } catch (err) {
      message.error(normalizeError(err, t("devices.assignFailed")));
    } finally {
      setActionBusy(false);
    }
  }

  const profileOptions = profiles.map((profile) => ({
    value: profile.userCode,
    label: `${profile.userCode} — ${profile.name}`,
  }));

  function exportDevicesCsv() {
    downloadCsv(
      `mdm-devices-${formatDateForFileName()}.csv`,
      toDeviceCsvRows(filtered),
      deviceCsvColumns(t),
    );
  }

  return (
    <div className="page-stack">
      <div>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
          {t("devices.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t("devices.description")}
        </Typography.Paragraph>
        <Button
          className="quick-guide-toggle"
          type="default"
          size="small"
          aria-expanded={guideOpen}
          onClick={() => setGuideOpen((value) => !value)}
        >
          {guideOpen ? t("common.hideGuide") : t("common.quickGuide")}
        </Button>
      </div>

      {guideOpen ? (
        <div className="quick-guide-panel">
          <Typography.Title level={5} className="quick-guide-title">
            {t("devices.listGuide.title")}
          </Typography.Title>
          <ul className="quick-guide-list">
            {listGuideItemKeys.map((key) => (
              <li key={key}>
                <Typography.Text>{t(key)}</Typography.Text>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <Alert type="error" message={error} /> : null}

      <Card>
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
            <Space wrap>
              <Input
                placeholder={t("devices.searchPlaceholder")}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 320 }}
              />

              <Select
                allowClear
                placeholder={t("devices.filterStatus")}
                style={{ width: 180 }}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { value: "ACTIVE", label: t("devices.statusActive") },
                  { value: "LOCKED", label: t("devices.statusLocked") },
                ]}
              />
            </Space>

            <Button onClick={exportDevicesCsv} loading={loading} disabled={loading || filtered.length === 0}>
              {t("devices.exportCsv")}
            </Button>
          </Space>

          <Space wrap>
            <Checkbox checked={hideSuspectedTestDevices} onChange={(event) => setHideSuspectedTestDevices(event.target.checked)}>
              {t("devices.hideSuspectedTestDevices")}
            </Checkbox>
            <Checkbox checked={showLostContactOnly} onChange={(event) => setShowLostContactOnly(event.target.checked)}>
              {t("devices.showLostContactOnly")}
            </Checkbox>
            <Checkbox checked={showManageableOnly} onChange={(event) => setShowManageableOnly(event.target.checked)}>
              {t("devices.showManageableOnly")}
            </Checkbox>
          </Space>
          <Typography.Text type="secondary">
            {showManageableOnly ? t("devices.manageableOnlyHelp") : t("devices.uiOnlyFilterNote")}
          </Typography.Text>
        </Space>
      </Card>

      <Card>
        <Table<DeviceResponse>
          dataSource={filtered}
          rowKey="id"
          loading={loading || actionBusy}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        >
          <Table.Column<DeviceResponse>
            title={t("common.device")}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text code>{record.deviceCode}</Typography.Text>
                <Typography.Text type="secondary">
                  {record.manufacturer || "-"} {record.model || "-"}
                </Typography.Text>
                {isSuspectedTestDevice(record) ? <Tag>{t("devices.suspectedTestDevice")}</Tag> : null}
              </Space>
            )}
          />
          <Table.Column<DeviceResponse>
            title={t("common.status")}
            render={(_, record) => {
              const up = String(record.status).toUpperCase();
              return <Tag color={up === "ACTIVE" ? "green" : up === "LOCKED" ? "red" : "default"}>{deviceStatusLabel(record.status, t)}</Tag>;
            }}
          />
          <Table.Column<DeviceResponse>
            title={t("devices.policyProfile")}
            render={(_, record) => (record.userCode ? <Tag color="blue">{record.userCode}</Tag> : <Tag>{t("devices.unlinked")}</Tag>)}
          />
          <Table.Column<DeviceResponse> dataIndex="sdkInt" title={t("devices.sdk")} />
          <Table.Column<DeviceResponse>
            title={t("devices.battery")}
            render={(_, record) => {
              const connectionState = onlineStateFromLastSeen(record.lastSeenAtEpochMillis);
              const hasBattery = isValidBatteryLevel(record.batteryLevel);
              const stale = connectionState === "offline" || connectionState === "lost_contact";

              if (!hasBattery) {
                return <Typography.Text type="secondary">{t("devices.noBatteryData")}</Typography.Text>;
              }

              return (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{record.batteryLevel}%</Typography.Text>
                  <Typography.Text type="secondary">
                    {stale ? `${t("devices.lastReported")}: ` : ""}
                    {chargingLabel(record.isCharging, t)}
                  </Typography.Text>
                  {stale ? <Typography.Text type="secondary">{formatRelative(record.lastSeenAtEpochMillis, t)}</Typography.Text> : null}
                </Space>
              );
            }}
          />
          <Table.Column<DeviceResponse>
            title={t("devices.liveness")}
            render={(_, record) => <LiveStatusBadge lastSeenAtEpochMillis={record.lastSeenAtEpochMillis} />}
          />
          <Table.Column<DeviceResponse>
            title={t("devices.lastSeen")}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{fmtEpoch(record.lastSeenAtEpochMillis)}</Typography.Text>
                <Typography.Text type="secondary">{formatRelative(record.lastSeenAtEpochMillis, t)}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<DeviceResponse>
            title={t("devices.actions")}
            render={(_, record) => {
              const lostContact = isLostContactFromLastSeen(record.lastSeenAtEpochMillis);
              const blockedProps = lostContact
                ? {
                    className: "soft-disabled-action",
                    "aria-disabled": true,
                  }
                : {};

              return (
                <Space wrap>
                  <Link to={`/devices/show/${record.id}`}>
                    <Button size="small">{t("devices.detailsAction")}</Button>
                  </Link>
                  <Tooltip title={lostContact ? t("devices.reconnectBeforeAction") : undefined}>
                    <Button size="small" {...blockedProps} onClick={() => openLinkModal(record)}>
                      {t("devices.assignAction")}
                    </Button>
                  </Tooltip>
                  <Tooltip title={lostContact ? t("devices.reconnectBeforeAction") : undefined}>
                    <Button
                      size="small"
                      type={lostContact ? "default" : "primary"}
                      {...blockedProps}
                      disabled={!lostContact && String(record.status).toUpperCase() !== "LOCKED"}
                      onClick={() => openUnlockModal(record)}
                    >
                      {t("devices.unlockAction")}
                    </Button>
                  </Tooltip>
                </Space>
              );
            }}
          />
        </Table>
      </Card>

      <Modal
        centered
        title={t("devices.unlockModalTitle")}
        open={unlockModalOpen}
        onCancel={closeUnlockModal}
        confirmLoading={actionBusy}
        footer={[
          <Button key="cancel" onClick={closeUnlockModal}>
            {t("common.cancel")}
          </Button>,
          <Button
            key="details"
            onClick={() => {
              if (!unlockTarget) return;
              closeUnlockModal();
              navigate(`/devices/show/${unlockTarget.id}`);
            }}
          >
            {t("devices.openDetailsAction")}
          </Button>,
          <Button key="unlock" type="primary" loading={actionBusy} disabled={!unlockPassword} onClick={() => void submitUnlock()}>
            {t("devices.unlockAction")}
          </Button>,
        ]}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("devices.unlockModalDescription")}
          </Typography.Paragraph>
          {unlockTarget ? <Typography.Text code>{unlockTarget.deviceCode}</Typography.Text> : null}
          <div>
            <Typography.Text strong>{t("devices.unlockPasswordLabel")}</Typography.Text>
            <Input.Password
              autoFocus
              style={{ marginTop: 6 }}
              placeholder={t("devices.unlockPasswordPlaceholder")}
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              onPressEnter={() => void submitUnlock()}
            />
          </div>
          <Alert type="info" showIcon message={t("devices.unlockForgotPasswordHelp")} />
        </Space>
      </Modal>

      <Modal
        centered
        title={t("devices.assignModalTitle")}
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={() => void saveLink()}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        confirmLoading={actionBusy}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("devices.assignModalDescription")}
          </Typography.Paragraph>
          {linkTarget ? <Typography.Text code>{linkTarget.deviceCode}</Typography.Text> : null}

          <Select
            style={{ width: "100%" }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("devices.selectPolicyProfile")}
            value={selectedUserCode ?? undefined}
            options={profileOptions}
            onChange={(value) => setSelectedUserCode(value ?? null)}
          />
        </Space>
      </Modal>
    </div>
  );
};
