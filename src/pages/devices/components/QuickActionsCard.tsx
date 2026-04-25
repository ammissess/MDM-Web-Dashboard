import React from "react";
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import type { CreateCommandRequest, ProfileResponse } from "../../../types/api";
import { useT } from "../../../i18n";

type Props = {
  profiles: ProfileResponse[];
  selectedUserCode: string | null;
  onSelectedUserCodeChange: (value: string | null) => void;
  onLink: () => Promise<void> | void;
  onUnlink: () => Promise<void> | void;
  onUnlock: (password: string) => Promise<void> | void;
  onLock: () => Promise<void> | void;
  onResetUnlockPass: (newPassword: string) => Promise<void> | void;
  onCreateCommand: (request: CreateCommandRequest) => Promise<void> | void;
  actionBusy?: boolean;
};

const commandOptions = [
  { value: "lock_screen", label: "lock_screen" },
  { value: "refresh_config", label: "refresh_config" },
  { value: "sync_config", label: "sync_config" },
];

function validateJsonObject(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return Promise.reject(new Error("Payload must be a JSON object string"));
    }
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error("Payload must be valid JSON"));
  }
}

export const QuickActionsCard: React.FC<Props> = ({
  profiles,
  selectedUserCode,
  onSelectedUserCodeChange,
  onLink,
  onUnlink,
  onUnlock,
  onLock,
  onResetUnlockPass,
  onCreateCommand,
  actionBusy,
}) => {
  const t = useT();
  const options = profiles.map((profile) => ({
    value: profile.userCode,
    label: `${profile.userCode} — ${profile.name}`,
  }));

  return (
    <div className="quick-actions-grid">
      <Card size="small" className="action-section-card" title={t("quick.profileLink")}>
        <Space.Compact style={{ width: "100%" }}>
          <Select
            style={{ width: "100%" }}
            placeholder="Select profile userCode"
            allowClear
            showSearch
            optionFilterProp="label"
            value={selectedUserCode ?? undefined}
            options={options}
            onChange={(value) => onSelectedUserCodeChange(value ?? null)}
          />
          <Button type="primary" onClick={() => void onLink()} loading={actionBusy} disabled={!selectedUserCode}>
            {t("common.link")}
          </Button>
        </Space.Compact>

        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => void onUnlink()} loading={actionBusy}>
            {t("common.unlinkProfile")}
          </Button>
        </Space>
      </Card>

      <Card size="small" className="action-section-card" title={t("quick.backendStatus")}>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Backend status flow"
          description={t("quick.backendStatusDesc")}
        />

        <Form layout="vertical" onFinish={(values) => void onUnlock(String(values.password ?? ""))}>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item
              name="password"
              rules={[{ required: true, message: "Enter password" }]}
              style={{ width: "100%", marginBottom: 0 }}
            >
              <Input.Password placeholder="unlock password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={actionBusy}>
              {t("quick.unlock")}
            </Button>
          </Space.Compact>
        </Form>

        <Form
          layout="vertical"
          onFinish={(values) => void onResetUnlockPass(String(values.newPassword ?? ""))}
          style={{ marginTop: 12 }}
        >
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item
              name="newPassword"
              rules={[{ required: true, message: "Enter new unlock password" }]}
              style={{ width: "100%", marginBottom: 0 }}
            >
              <Input.Password placeholder="new unlock password" />
            </Form.Item>
            <Button htmlType="submit" loading={actionBusy}>
              {t("quick.resetUnlock")}
            </Button>
          </Space.Compact>
        </Form>

        <Space style={{ marginTop: 12 }}>
          <Button danger onClick={() => void onLock()} loading={actionBusy}>
            {t("quick.setLocked")}
          </Button>
        </Space>
      </Card>

      <Card size="small" className="action-section-card action-section-card-wide" title={t("quick.commandDelivery")}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Command lifecycle: admin create → device poll → lease/leaseToken → device ack → final status"
          description={t("quick.commandDesc")}
        />

        <Space wrap style={{ marginBottom: 12 }}>
          <Button loading={actionBusy} onClick={() => void onCreateCommand({ type: "lock_screen", payload: "{}", ttlSeconds: 600 })}>
            {t("quick.sendLockScreen")}
          </Button>
          <Button loading={actionBusy} onClick={() => void onCreateCommand({ type: "refresh_config", payload: "{}", ttlSeconds: 600 })}>
            {t("quick.sendRefresh")}
          </Button>
          <Button loading={actionBusy} onClick={() => void onCreateCommand({ type: "sync_config", payload: "{}", ttlSeconds: 600 })}>
            {t("quick.sendSync")}
          </Button>
        </Space>

        <Typography.Text type="secondary">Advanced command payload</Typography.Text>
        <Form
          layout="vertical"
          initialValues={{ type: "refresh_config", payload: "{}", ttlSeconds: 600 }}
          onFinish={(values) =>
            void onCreateCommand({
              type: String(values.type ?? "refresh_config"),
              payload: String(values.payload ?? "{}"),
              ttlSeconds: Number(values.ttlSeconds ?? 600),
            })
          }
          style={{ marginTop: 8 }}
        >
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={commandOptions} />
          </Form.Item>

          <Form.Item
            name="payload"
            label="Payload string"
            rules={[{ required: true, message: "Payload must be a JSON object string" }, { validator: (_, value) => validateJsonObject(String(value ?? "{}")) }]}
          >
            <Input.TextArea rows={4} placeholder='{}' />
          </Form.Item>

          <Form.Item name="ttlSeconds" label="TTL seconds" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={1} max={86_400} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={actionBusy}>
            {t("quick.sendCommand")}
          </Button>
        </Form>
      </Card>
    </div>
  );
};
