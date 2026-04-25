import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography, message } from "antd";
import type { DeviceResponse, ProfileResponse, ProfileUpdateRequest } from "../../types/api";
import { http } from "../../providers/axios";
import { fmtEpoch, normalizeError } from "../../utils/format";
import { AllowedAppsEditor } from "./components/AllowedAppsEditor";
import { useT } from "../../i18n";

function normalizeAllowedApps(items: string[]): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).sort();
}

const hardeningItems: Array<{ field: keyof ProfileUpdateRequest; label: string }> = [
  { field: "lockPrivateDnsConfig", label: "Lock Private DNS settings" },
  { field: "lockVpnConfig", label: "Lock VPN settings" },
  { field: "blockDebuggingFeatures", label: "Block debugging features / ADB" },
  { field: "disableUsbDataSignaling", label: "Disable USB data signaling when supported" },
  { field: "disallowSafeBoot", label: "Disallow safe boot" },
  { field: "disallowFactoryReset", label: "Disallow factory reset from UI" },
];

export const ProfileEditPage: React.FC = () => {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  const navigate = useNavigate();
  const [form] = Form.useForm<ProfileResponse>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ProfileResponse | null>(null);
  const [inventorySources, setInventorySources] = useState<DeviceResponse[]>([]);

  const load = useCallback(async () => {
    try {
      const [profileRes, devicesRes] = await Promise.allSettled([
        http.get<ProfileResponse>(`/api/admin/profiles/${id}`),
        http.get<DeviceResponse[]>("/api/admin/devices"),
      ]);

      if (profileRes.status === "rejected") {
        throw profileRes.reason;
      }

      const { data } = profileRes.value;
      setRecord(data);
      setAllowedApps(data.allowedApps ?? []);
      form.setFieldsValue(data);

      if (devicesRes.status === "fulfilled") {
        setInventorySources(
          [...(devicesRes.value.data ?? [])].sort((a, b) => b.lastSeenAtEpochMillis - a.lastSeenAtEpochMillis),
        );
      } else {
        setInventorySources([]);
      }

      setError(null);
    } catch (err) {
      setError(normalizeError(err, "Cannot load profile"));
    } finally {
      setLoading(false);
    }
  }, [form, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasUnsavedAllowedApps =
    normalizeAllowedApps(allowedApps).join("\n") !== normalizeAllowedApps(record?.allowedApps ?? []).join("\n");

  async function saveAllProfileChanges() {
    setSaving(true);
    setError(null);
    try {
      const values = await form.validateFields();
      const normalizedApps = normalizeAllowedApps(allowedApps);

    const body: ProfileUpdateRequest = {
      name: values.name,
      description: values.description,
      disableWifi: values.disableWifi,
      disableBluetooth: values.disableBluetooth,
      disableCamera: values.disableCamera,
      disableStatusBar: values.disableStatusBar,
      kioskMode: values.kioskMode,
      blockUninstall: values.blockUninstall,
      lockPrivateDnsConfig: values.lockPrivateDnsConfig,
      lockVpnConfig: values.lockVpnConfig,
      blockDebuggingFeatures: values.blockDebuggingFeatures,
      disableUsbDataSignaling: values.disableUsbDataSignaling,
      disallowSafeBoot: values.disallowSafeBoot,
      disallowFactoryReset: values.disallowFactoryReset,
    };

      await http.put(`/api/admin/profiles/${id}`, body);
      await http.put(`/api/admin/profiles/${id}/allowed-apps`, normalizedApps);

      const { data: readback } = await http.get<ProfileResponse>(`/api/admin/profiles/${id}`);
      const mismatches: string[] = [];

      if (readback.name !== body.name) mismatches.push(`name expected=${body.name} actual=${readback.name}`);
      if (readback.description !== body.description) {
        mismatches.push(`description expected=${body.description} actual=${readback.description}`);
      }
      if (readback.disableWifi !== body.disableWifi) {
        mismatches.push(`disableWifi expected=${String(body.disableWifi)} actual=${String(readback.disableWifi)}`);
      }
      if (readback.disableBluetooth !== body.disableBluetooth) {
        mismatches.push(
          `disableBluetooth expected=${String(body.disableBluetooth)} actual=${String(readback.disableBluetooth)}`,
        );
      }
      if (readback.disableCamera !== body.disableCamera) {
        mismatches.push(`disableCamera expected=${String(body.disableCamera)} actual=${String(readback.disableCamera)}`);
      }
      if (readback.disableStatusBar !== body.disableStatusBar) {
        mismatches.push(
          `disableStatusBar expected=${String(body.disableStatusBar)} actual=${String(readback.disableStatusBar)}`,
        );
      }
      if (readback.kioskMode !== body.kioskMode) {
        mismatches.push(`kioskMode expected=${String(body.kioskMode)} actual=${String(readback.kioskMode)}`);
      }
      if (readback.blockUninstall !== body.blockUninstall) {
        mismatches.push(`blockUninstall expected=${String(body.blockUninstall)} actual=${String(readback.blockUninstall)}`);
      }
      if (readback.lockPrivateDnsConfig !== body.lockPrivateDnsConfig) {
        mismatches.push(
          `lockPrivateDnsConfig expected=${String(body.lockPrivateDnsConfig)} actual=${String(readback.lockPrivateDnsConfig)}`,
        );
      }
      if (readback.lockVpnConfig !== body.lockVpnConfig) {
        mismatches.push(`lockVpnConfig expected=${String(body.lockVpnConfig)} actual=${String(readback.lockVpnConfig)}`);
      }
      if (readback.blockDebuggingFeatures !== body.blockDebuggingFeatures) {
        mismatches.push(
          `blockDebuggingFeatures expected=${String(body.blockDebuggingFeatures)} actual=${String(readback.blockDebuggingFeatures)}`,
        );
      }
      if (readback.disableUsbDataSignaling !== body.disableUsbDataSignaling) {
        mismatches.push(
          `disableUsbDataSignaling expected=${String(body.disableUsbDataSignaling)} actual=${String(readback.disableUsbDataSignaling)}`,
        );
      }
      if (readback.disallowSafeBoot !== body.disallowSafeBoot) {
        mismatches.push(`disallowSafeBoot expected=${String(body.disallowSafeBoot)} actual=${String(readback.disallowSafeBoot)}`);
      }
      if (readback.disallowFactoryReset !== body.disallowFactoryReset) {
        mismatches.push(
          `disallowFactoryReset expected=${String(body.disallowFactoryReset)} actual=${String(readback.disallowFactoryReset)}`,
        );
      }

      const readbackApps = normalizeAllowedApps(readback.allowedApps ?? []);
      if (readbackApps.join("\n") !== normalizedApps.join("\n")) {
        mismatches.push(`allowedApps expected=${normalizedApps.join(",")} actual=${readbackApps.join(",")}`);
      }

      setRecord(readback);
      setAllowedApps(readback.allowedApps ?? []);
      form.setFieldsValue(readback);

      if (mismatches.length > 0) {
        const mismatchMessage = `Saved but readback mismatch: ${mismatches.join(" | ")}`;
        setError(mismatchMessage);
        message.error(mismatchMessage);
        return;
      }

      message.success("Profile changes saved and readback verified.");
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "errorFields" in err &&
        Array.isArray((err as { errorFields?: unknown[] }).errorFields)
      ) {
        message.error("Please fix validation errors before saving.");
      } else {
        message.error(normalizeError(err, "Save all profile changes failed"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <Alert type="info" message="Loading profile..." />
      </Card>
    );
  }

  if (!record) {
    return (
      <Card>
        <Alert type="error" message={error ?? "Profile not found"} />
      </Card>
    );
  }

  return (
    <Card
      title="Edit Profile"
      extra={
        <Space>
          <Typography.Text type="secondary">Updated: {fmtEpoch(record.updatedAtEpochMillis)}</Typography.Text>
          <Button onClick={() => navigate(`/profiles/show/${id}`)}>Open detail</Button>
        </Space>
      }
    >
      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t("device.backendOwned")}
        description="After Save all profile changes, this page verifies backend readback first. Android application is proven only when the device later polls/acks and reports policy-state."
      />

      <Form form={form} layout="vertical">
        <Form.Item name="userCode" label="User Code">
          <Input disabled />
        </Form.Item>

        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Typography.Title level={5}>Allowed Apps</Typography.Title>
        <AllowedAppsEditor
          value={allowedApps}
          onChange={setAllowedApps}
          inventorySources={inventorySources}
          linkedUserCode={record.userCode}
        />
        {hasUnsavedAllowedApps ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12, marginBottom: 24 }}
            message="Allowed apps changed but not saved yet. Click Save all profile changes to persist them."
          />
        ) : (
          <div style={{ marginBottom: 24 }} />
        )}

        <Typography.Title level={5}>Policy flags</Typography.Title>

        <Form.Item name="kioskMode" valuePropName="checked">
          <Checkbox>Kiosk mode</Checkbox>
        </Form.Item>
        <Form.Item name="disableStatusBar" valuePropName="checked">
          <Checkbox>Disable status bar</Checkbox>
        </Form.Item>
        <Form.Item name="blockUninstall" valuePropName="checked">
          <Checkbox>Block uninstall</Checkbox>
        </Form.Item>
        <Form.Item name="disableWifi" valuePropName="checked">
          <Checkbox>Disable WiFi settings</Checkbox>
        </Form.Item>
        <Form.Item name="disableBluetooth" valuePropName="checked">
          <Checkbox>Disable Bluetooth</Checkbox>
        </Form.Item>
        <Form.Item name="disableCamera" valuePropName="checked">
          <Checkbox>Disable Camera</Checkbox>
        </Form.Item>

        <Typography.Title level={5}>Security hardening</Typography.Title>

        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Do not enable Block debugging / Disable USB data while testing with ADB or emulator. It may disconnect debugging."
        />

        {hardeningItems.map((item) => (
          <Form.Item key={item.field} name={item.field} valuePropName="checked">
            <Checkbox>{item.label}</Checkbox>
          </Form.Item>
        ))}

        <Space>
          <Button type="primary" onClick={() => void saveAllProfileChanges()} loading={saving}>
            Save all profile changes
          </Button>
          <Button onClick={() => navigate("/profiles")}>Back</Button>
        </Space>
      </Form>
    </Card>
  );
};