import React from "react";
import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Tooltip, Typography, message } from "antd";
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
  actionsBlocked?: boolean;
  blockedReason?: string;
  onBlockedAction?: () => void;
};

const commandOptions = [
  { value: "lock_screen", label: "lock_screen" },
  { value: "refresh_config", label: "refresh_config" },
  { value: "sync_config", label: "sync_config" },
];

function validateJsonObject(raw: string, t: (key: string) => string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return Promise.reject(new Error(t("quick.payloadRequired")));
    }
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error(t("quick.payloadInvalid")));
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
  actionsBlocked,
  blockedReason,
  onBlockedAction,
}) => {
  const t = useT();
  const [unlockForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const options = profiles.map((profile) => ({
    value: profile.userCode,
    label: `${profile.userCode} — ${profile.name}`,
  }));
  const blockedAriaProps = actionsBlocked
    ? {
        "aria-disabled": true,
      }
    : {};
  const secondaryActionClass = actionsBlocked ? "soft-disabled-action" : "device-action-secondary";
  const dangerActionClass = actionsBlocked ? "soft-disabled-action" : "device-action-danger";

  const runAction = (action: () => Promise<void> | void) => {
    if (actionsBlocked) {
      onBlockedAction?.();
      return;
    }
    void action();
  };

  const submitForm = (form: ReturnType<typeof Form.useForm>[0]) => {
    if (actionsBlocked) {
      onBlockedAction?.();
      return;
    }
    void form.submit();
  };

  return (
    <div className="device-action-center">
      <Card size="small" className="device-action-group" title={t("quick.profileLink")}>
        <div className="device-profile-action-row">
          <Select
            className="device-profile-select"
            placeholder={t("devices.selectPolicyProfile")}
            allowClear
            showSearch
            optionFilterProp="label"
            value={selectedUserCode ?? undefined}
            options={options}
            onChange={(value) => onSelectedUserCodeChange(value ?? null)}
          />
          <div className="device-profile-button-group">
            <Tooltip title={actionsBlocked ? blockedReason : undefined}>
              <Button className={secondaryActionClass} {...blockedAriaProps} onClick={() => runAction(onUnlink)} loading={actionBusy}>
                {t("common.unlinkProfile")}
              </Button>
            </Tooltip>
            <Tooltip title={actionsBlocked ? blockedReason : undefined}>
              <Button
                type={actionsBlocked ? "default" : "primary"}
                {...blockedAriaProps}
                onClick={() => runAction(onLink)}
                loading={actionBusy}
                disabled={!actionsBlocked && !selectedUserCode}
              >
                {t("devices.assignAction")}
              </Button>
            </Tooltip>
          </div>
        </div>
      </Card>

      <Card size="small" className="device-action-group" title={t("quick.backendStatus")}>
        <Collapse
          size="small"
          className="device-action-collapsible-note"
          items={[
            {
              key: "backend-status-flow",
              label: t("quick.backendStatusFlow"),
              children: <Alert type="warning" showIcon message={t("quick.backendStatusFlow")} description={t("quick.backendStatusDesc")} />,
            },
          ]}
        />

        <Form
          form={unlockForm}
          layout="vertical"
          onFinish={(values) => {
            if (actionsBlocked) {
              onBlockedAction?.();
              return;
            }
            void onUnlock(String(values.password ?? ""));
          }}
          className="device-state-form"
        >
            <Form.Item
              name="password"
              rules={[{ required: true, message: t("quick.enterPassword") }]}
            >
              <Input.Password placeholder={t("devices.unlockPasswordPlaceholder")} />
            </Form.Item>
        </Form>

        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(values) => {
            if (actionsBlocked) {
              onBlockedAction?.();
              return;
            }
            if (String(values.newPassword ?? "") !== String(values.confirmNewPassword ?? "")) {
              message.warning(t("quick.confirmPasswordMismatch"));
              return;
            }
            void onResetUnlockPass(String(values.newPassword ?? ""));
          }}
          className="device-state-form"
        >
          <div className="device-state-password-grid">
            <Form.Item
              name="newPassword"
              rules={[{ required: true, message: t("quick.enterNewUnlockPassword") }]}
            >
              <Input.Password placeholder={t("quick.newUnlockPasswordPlaceholder")} />
            </Form.Item>
            <Form.Item
              name="confirmNewPassword"
              rules={[{ required: true, message: t("quick.enterConfirmNewUnlockPassword") }]}
            >
              <Input.Password placeholder={t("quick.confirmNewUnlockPasswordPlaceholder")} />
            </Form.Item>
          </div>
        </Form>

        <div className="device-state-button-row">
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button
              type={actionsBlocked ? "default" : "primary"}
              {...blockedAriaProps}
              loading={actionBusy}
              onClick={() => submitForm(unlockForm)}
            >
              {t("quick.unlock")}
            </Button>
          </Tooltip>
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button
              className={secondaryActionClass}
              {...blockedAriaProps}
              loading={actionBusy}
              onClick={() => submitForm(resetForm)}
            >
              {t("quick.resetUnlock")}
            </Button>
          </Tooltip>
        </div>

        <Space style={{ marginTop: 12 }}>
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button danger={!actionsBlocked} className={dangerActionClass} {...blockedAriaProps} onClick={() => runAction(onLock)} loading={actionBusy}>
              {t("quick.setLocked")}
            </Button>
          </Tooltip>
        </Space>
      </Card>

      <Card size="small" className="device-action-group" title={t("quick.commandDelivery")}>
        <Collapse
          size="small"
          className="device-action-collapsible-note device-action-guide"
          items={[
            {
              key: "quick-command-guide",
              label: t("quick.quickCommandGuide"),
              children: (
                <Alert
                  type="info"
                  showIcon
                  message={t("quick.quickCommandGuide")}
                  description={
                    <Space direction="vertical" size={4}>
                      <Typography.Text>{t("quick.quickCommandLockHelp")}</Typography.Text>
                      <Typography.Text>{t("quick.quickCommandRefreshHelp")}</Typography.Text>
                      <Typography.Text>{t("quick.quickCommandSyncHelp")}</Typography.Text>
                    </Space>
                  }
                />
              ),
            },
            {
              key: "command-lifecycle",
              label: t("quick.commandLifecycleSummary"),
              children: <Alert type="warning" showIcon message={t("quick.commandLifecycleSummary")} description={t("quick.commandDesc")} />,
            },
          ]}
        />

        <div className="device-action-quick-grid">
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button className={secondaryActionClass} {...blockedAriaProps} loading={actionBusy} onClick={() => runAction(() => onCreateCommand({ type: "lock_screen", payload: "{}", ttlSeconds: 600 }))}>
              {t("quick.sendLockScreen")}
            </Button>
          </Tooltip>
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button className={secondaryActionClass} {...blockedAriaProps} loading={actionBusy} onClick={() => runAction(() => onCreateCommand({ type: "refresh_config", payload: "{}", ttlSeconds: 600 }))}>
              {t("quick.sendRefresh")}
            </Button>
          </Tooltip>
          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button className={secondaryActionClass} {...blockedAriaProps} loading={actionBusy} onClick={() => runAction(() => onCreateCommand({ type: "sync_config", payload: "{}", ttlSeconds: 600 }))}>
              {t("quick.sendSync")}
            </Button>
          </Tooltip>
        </div>

        <Typography.Text className="device-action-subheading">{t("quick.advancedCommand")}</Typography.Text>
        <Form
          layout="vertical"
          initialValues={{ type: "refresh_config", payload: "{}", ttlSeconds: 600 }}
          onFinish={(values) => {
            if (actionsBlocked) {
              onBlockedAction?.();
              return;
            }
            void onCreateCommand({
              type: String(values.type ?? "refresh_config"),
              payload: String(values.payload ?? "{}"),
              ttlSeconds: Number(values.ttlSeconds ?? 600),
            });
          }}
          style={{ marginTop: 8 }}
        >
          <Form.Item name="type" label={t("quick.commandType")} rules={[{ required: true }]}>
            <Select options={commandOptions} />
          </Form.Item>

          <Form.Item
            name="payload"
            label={t("quick.payloadString")}
            rules={[{ required: true, message: t("quick.payloadRequired") }, { validator: (_, value) => validateJsonObject(String(value ?? "{}"), t) }]}
          >
            <Input.TextArea rows={4} placeholder='{}' />
          </Form.Item>

          <Form.Item name="ttlSeconds" label={t("quick.ttlSeconds")} rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={1} max={86_400} />
          </Form.Item>

          <Tooltip title={actionsBlocked ? blockedReason : undefined}>
            <Button
              type={actionsBlocked ? "default" : "primary"}
              {...blockedAriaProps}
              htmlType={actionsBlocked ? "button" : "submit"}
              loading={actionBusy}
              onClick={actionsBlocked ? onBlockedAction : undefined}
            >
              {t("quick.sendCommand")}
            </Button>
          </Tooltip>
        </Form>
      </Card>
    </div>
  );
};
