import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { DeviceResponse, ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fmtEpoch, fmtRelativeFromNow, normalizeError } from "../../utils/format";
import { downloadCsv, formatDateForFileName } from "../../utils/export";
import { LiveStatusBadge } from "./components/LiveStatusBadge";

const deviceCsvColumns = [
  { key: "id", title: "id" },
  { key: "deviceCode", title: "deviceCode" },
  { key: "status", title: "status" },
  { key: "linkedUserCode", title: "linkedUserCode" },
  { key: "lastSeen", title: "lastSeen" },
  { key: "lastSeenEpochMillis", title: "lastSeenEpochMillis" },
  { key: "batteryLevel", title: "batteryLevel" },
  { key: "isCharging", title: "isCharging" },
  { key: "wifiEnabled", title: "wifiEnabled" },
  { key: "androidVersion", title: "androidVersion" },
  { key: "sdkInt", title: "sdkInt" },
  { key: "manufacturer", title: "manufacturer" },
  { key: "model", title: "model" },
  { key: "imei", title: "imei" },
  { key: "serial", title: "serial" },
];

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

export const DeviceListPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [profiles, setProfiles] = useState<ProfileResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<DeviceResponse | null>(null);
  const [selectedUserCode, setSelectedUserCode] = useState<string | null>(null);
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
      setError(normalizeError(err, "Cannot load devices"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  useAutoRefresh(load, true, 5_000, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return devices.filter((item) => {
      const statusOk = !statusFilter || String(item.status).toUpperCase() === statusFilter;
      const keywordOk =
        !q ||
        item.deviceCode.toLowerCase().includes(q) ||
        String(item.userCode ?? "").toLowerCase().includes(q) ||
        String(item.manufacturer ?? "").toLowerCase().includes(q) ||
        String(item.model ?? "").toLowerCase().includes(q);

      return statusOk && keywordOk;
    });
  }, [devices, keyword, statusFilter]);

  async function handleUnlock(device: DeviceResponse) {
    Modal.confirm({
      title: `Unlock ${device.deviceCode}`,
      content: "This calls POST /api/device/unlock with the password you enter.",
      okText: "Continue",
      async onOk() {
        let password = "";
        await new Promise<void>((resolve, reject) => {
          let inputValue = "";
          const ref = Modal.confirm({
            title: `Enter unlock password for ${device.deviceCode}`,
            icon: null,
            content: (
              <Input.Password
                autoFocus
                placeholder="unlock password"
                onChange={(e) => {
                  inputValue = e.target.value;
                }}
                onPressEnter={() => {
                  password = inputValue;
                  ref.destroy();
                  resolve();
                }}
              />
            ),
            onOk() {
              password = inputValue;
              resolve();
            },
            onCancel() {
              reject(new Error("Cancelled"));
            },
          });
        }).catch(() => undefined);

        if (!password) return;

        setActionBusy(true);
        try {
          const { data } = await http.post("/api/device/unlock", {
            deviceCode: device.deviceCode,
            password,
          });
          message.success(`Unlock success: ${data.status}`);
          await load();
        } catch (err) {
          message.error(normalizeError(err, "Unlock failed"));
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  function openLinkModal(device: DeviceResponse) {
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
      message.success("Device link updated");
      setLinkModalOpen(false);
      await load();
    } catch (err) {
      message.error(normalizeError(err, "Update link failed"));
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
      deviceCsvColumns,
    );
  }

  return (
    <div className="page-stack">
      <div>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
          Devices
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          GET /api/admin/devices currently provides status, identity, battery and lastSeen. Timing fields such as
          lastPoll or lastCommandAck are only available on the detail endpoint.
        </Typography.Paragraph>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <Card>
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Input
              placeholder="Search deviceCode, userCode, model..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 320 }}
            />

            <Select
              allowClear
              placeholder="Filter status"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "LOCKED", label: "LOCKED" },
              ]}
            />
          </Space>

          <Button onClick={exportDevicesCsv} loading={loading} disabled={loading || filtered.length === 0}>
            Export Devices CSV
          </Button>
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
            title="Device"
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text code>{record.deviceCode}</Typography.Text>
                <Typography.Text type="secondary">
                  {record.manufacturer || "-"} {record.model || "-"}
                </Typography.Text>
              </Space>
            )}
          />
          <Table.Column<DeviceResponse>
            title="Status"
            render={(_, record) => {
              const up = String(record.status).toUpperCase();
              return <Tag color={up === "ACTIVE" ? "green" : up === "LOCKED" ? "red" : "default"}>{up}</Tag>;
            }}
          />
          <Table.Column<DeviceResponse>
            title="Linked userCode"
            render={(_, record) => (record.userCode ? <Tag color="blue">{record.userCode}</Tag> : <Tag>unlinked</Tag>)}
          />
          <Table.Column<DeviceResponse> dataIndex="sdkInt" title="SDK" />
          <Table.Column<DeviceResponse>
            title="Battery"
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{record.batteryLevel >= 0 ? `${record.batteryLevel}%` : "-"}</Typography.Text>
                <Typography.Text type="secondary">{record.isCharging ? "charging" : "not charging"}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<DeviceResponse>
            title="Liveness"
            render={(_, record) => <LiveStatusBadge lastSeenAtEpochMillis={record.lastSeenAtEpochMillis} />}
          />
          <Table.Column<DeviceResponse>
            title="Last seen"
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{fmtEpoch(record.lastSeenAtEpochMillis)}</Typography.Text>
                <Typography.Text type="secondary">{fmtRelativeFromNow(record.lastSeenAtEpochMillis)}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<DeviceResponse>
            title="Actions"
            render={(_, record) => (
              <Space wrap>
                <Link to={`/devices/show/${record.id}`}>
                  <Button size="small">Open</Button>
                </Link>
                <Button size="small" onClick={() => openLinkModal(record)}>
                  Link
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={String(record.status).toUpperCase() !== "LOCKED"}
                  onClick={() => void handleUnlock(record)}
                >
                  Unlock
                </Button>
              </Space>
            )}
          />
        </Table>
      </Card>

      <Modal
        title={linkTarget ? `Link device ${linkTarget.deviceCode}` : "Link device"}
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={() => void saveLink()}
        okText="Save"
        confirmLoading={actionBusy}
      >
        <Typography.Paragraph type="secondary">
          Choose a profile by <code>userCode</code>. Desired config is backend-owned; Android applies it on the next
          config refresh/sync cycle.
        </Typography.Paragraph>

        <Select
          style={{ width: "100%" }}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Select profile"
          value={selectedUserCode ?? undefined}
          options={profileOptions}
          onChange={(value) => setSelectedUserCode(value ?? null)}
        />
      </Modal>
    </div>
  );
};
