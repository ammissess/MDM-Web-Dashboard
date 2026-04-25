import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Form, Input, Typography, message } from "antd";
import type { ProfileCreateRequest } from "../../types/api";
import { http } from "../../providers/axios";
import { normalizeError } from "../../utils/format";
import { AllowedAppsEditor } from "./components/AllowedAppsEditor";

const hardeningItems: Array<{ field: keyof ProfileCreateRequest; label: string }> = [
  { field: "lockPrivateDnsConfig", label: "Lock Private DNS settings" },
  { field: "lockVpnConfig", label: "Lock VPN settings" },
  { field: "blockDebuggingFeatures", label: "Block debugging features / ADB" },
  { field: "disableUsbDataSignaling", label: "Disable USB data signaling when supported" },
  { field: "disallowSafeBoot", label: "Disallow safe boot" },
  { field: "disallowFactoryReset", label: "Disallow factory reset from UI" },
];

const initialValues: ProfileCreateRequest = {
  userCode: "",
  name: "Profile",
  description: "",
  allowedApps: [],
  disableWifi: false,
  disableBluetooth: false,
  disableCamera: false,
  disableStatusBar: true,
  kioskMode: true,
  blockUninstall: true,
  lockPrivateDnsConfig: false,
  lockVpnConfig: false,
  blockDebuggingFeatures: false,
  disableUsbDataSignaling: false,
  disallowSafeBoot: false,
  disallowFactoryReset: false,
};

export const ProfileCreatePage: React.FC = () => {
  const [form] = Form.useForm<ProfileCreateRequest>();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: ProfileCreateRequest) {
    setSaving(true);
    setError(null);
    try {
      const { data } = await http.post("/api/admin/profiles", values);
      message.success("Profile created");
      navigate(`/profiles/show/${data.id}`);
    } catch (err) {
      setError(normalizeError(err, "Create profile failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Create Profile">
      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onFinish}>
        <Form.Item name="userCode" label="User Code" rules={[{ required: true }]}>
          <Input placeholder="TEST123" />
        </Form.Item>

        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item name="allowedApps" label="Allowed Apps">
          <AllowedAppsEditor />
        </Form.Item>

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

        <Button type="primary" htmlType="submit" loading={saving}>
          Create Profile
        </Button>
      </Form>
    </Card>
  );
};