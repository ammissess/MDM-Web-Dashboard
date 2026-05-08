import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Tag, Typography, message } from "antd";
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

type PolicyField = keyof Pick<
  ProfileUpdateRequest,
  | "kioskMode"
  | "disableStatusBar"
  | "blockUninstall"
  | "disableWifi"
  | "disableBluetooth"
  | "disableCamera"
  | "lockPrivateDnsConfig"
  | "lockVpnConfig"
  | "blockDebuggingFeatures"
  | "disableUsbDataSignaling"
  | "disallowSafeBoot"
  | "disallowFactoryReset"
>;

const corePolicyItems: Array<{ field: PolicyField; labelKey: string; descriptionKey: string }> = [
  { field: "kioskMode", labelKey: "profiles.policy.kioskMode", descriptionKey: "profiles.policyDesc.kioskMode" },
  {
    field: "disableStatusBar",
    labelKey: "profiles.policy.disableStatusBar",
    descriptionKey: "profiles.policyDesc.disableStatusBar",
  },
  {
    field: "blockUninstall",
    labelKey: "profiles.policy.blockUninstall",
    descriptionKey: "profiles.policyDesc.blockUninstall",
  },
  { field: "disableWifi", labelKey: "profiles.policy.disableWifi", descriptionKey: "profiles.policyDesc.disableWifi" },
  {
    field: "disableBluetooth",
    labelKey: "profiles.policy.disableBluetooth",
    descriptionKey: "profiles.policyDesc.disableBluetooth",
  },
  {
    field: "disableCamera",
    labelKey: "profiles.policy.disableCamera",
    descriptionKey: "profiles.policyDesc.disableCamera",
  },
];

const hardeningItems: Array<{ field: PolicyField; labelKey: string; descriptionKey: string }> = [
  {
    field: "lockPrivateDnsConfig",
    labelKey: "profiles.policy.lockPrivateDnsConfig",
    descriptionKey: "profiles.policyDesc.lockPrivateDnsConfig",
  },
  { field: "lockVpnConfig", labelKey: "profiles.policy.lockVpnConfig", descriptionKey: "profiles.policyDesc.lockVpnConfig" },
  {
    field: "blockDebuggingFeatures",
    labelKey: "profiles.policy.blockDebuggingFeatures",
    descriptionKey: "profiles.policyDesc.blockDebuggingFeatures",
  },
  {
    field: "disableUsbDataSignaling",
    labelKey: "profiles.policy.disableUsbDataSignaling",
    descriptionKey: "profiles.policyDesc.disableUsbDataSignaling",
  },
  {
    field: "disallowSafeBoot",
    labelKey: "profiles.policy.disallowSafeBoot",
    descriptionKey: "profiles.policyDesc.disallowSafeBoot",
  },
  {
    field: "disallowFactoryReset",
    labelKey: "profiles.policy.disallowFactoryReset",
    descriptionKey: "profiles.policyDesc.disallowFactoryReset",
  },
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
  const [guideOpen, setGuideOpen] = useState(false);
  const guideItems = [
    "profiles.editGuide.updateProfile",
    "profiles.editGuide.importInventory",
    "profiles.editGuide.backendReadback",
    "profiles.editGuide.androidProof",
    "profiles.editGuide.refreshSync",
  ];

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
      setError(normalizeError(err, t("profiles.loadOneFailed")));
    } finally {
      setLoading(false);
    }
  }, [form, id, t]);

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
      const fieldLabels: Record<string, string> = {
        name: t("profiles.nameLabel"),
        description: t("profiles.descriptionLabel"),
        disableWifi: t("profiles.policy.disableWifi"),
        disableBluetooth: t("profiles.policy.disableBluetooth"),
        disableCamera: t("profiles.policy.disableCamera"),
        disableStatusBar: t("profiles.policy.disableStatusBar"),
        kioskMode: t("profiles.policy.kioskMode"),
        blockUninstall: t("profiles.policy.blockUninstall"),
        lockPrivateDnsConfig: t("profiles.policy.lockPrivateDnsConfig"),
        lockVpnConfig: t("profiles.policy.lockVpnConfig"),
        blockDebuggingFeatures: t("profiles.policy.blockDebuggingFeatures"),
        disableUsbDataSignaling: t("profiles.policy.disableUsbDataSignaling"),
        disallowSafeBoot: t("profiles.policy.disallowSafeBoot"),
        disallowFactoryReset: t("profiles.policy.disallowFactoryReset"),
        allowedApps: t("profiles.allowedAppsTitle"),
      };
      const formatMismatchValue = (value: unknown) =>
        typeof value === "boolean" ? (value ? t("profiles.on") : t("profiles.off")) : String(value);
      const mismatch = (field: string, expected: unknown, actual: unknown) =>
        `${fieldLabels[field] ?? field} ${t("profiles.expected")}=${formatMismatchValue(expected)} ${t("profiles.actual")}=${formatMismatchValue(actual)}`;

      if (readback.name !== body.name) mismatches.push(mismatch("name", body.name, readback.name));
      if (readback.description !== body.description) {
        mismatches.push(mismatch("description", body.description, readback.description));
      }
      if (readback.disableWifi !== body.disableWifi) {
        mismatches.push(mismatch("disableWifi", body.disableWifi, readback.disableWifi));
      }
      if (readback.disableBluetooth !== body.disableBluetooth) {
        mismatches.push(mismatch("disableBluetooth", body.disableBluetooth, readback.disableBluetooth));
      }
      if (readback.disableCamera !== body.disableCamera) {
        mismatches.push(mismatch("disableCamera", body.disableCamera, readback.disableCamera));
      }
      if (readback.disableStatusBar !== body.disableStatusBar) {
        mismatches.push(mismatch("disableStatusBar", body.disableStatusBar, readback.disableStatusBar));
      }
      if (readback.kioskMode !== body.kioskMode) {
        mismatches.push(mismatch("kioskMode", body.kioskMode, readback.kioskMode));
      }
      if (readback.blockUninstall !== body.blockUninstall) {
        mismatches.push(mismatch("blockUninstall", body.blockUninstall, readback.blockUninstall));
      }
      if (readback.lockPrivateDnsConfig !== body.lockPrivateDnsConfig) {
        mismatches.push(mismatch("lockPrivateDnsConfig", body.lockPrivateDnsConfig, readback.lockPrivateDnsConfig));
      }
      if (readback.lockVpnConfig !== body.lockVpnConfig) {
        mismatches.push(mismatch("lockVpnConfig", body.lockVpnConfig, readback.lockVpnConfig));
      }
      if (readback.blockDebuggingFeatures !== body.blockDebuggingFeatures) {
        mismatches.push(
          mismatch("blockDebuggingFeatures", body.blockDebuggingFeatures, readback.blockDebuggingFeatures),
        );
      }
      if (readback.disableUsbDataSignaling !== body.disableUsbDataSignaling) {
        mismatches.push(
          mismatch("disableUsbDataSignaling", body.disableUsbDataSignaling, readback.disableUsbDataSignaling),
        );
      }
      if (readback.disallowSafeBoot !== body.disallowSafeBoot) {
        mismatches.push(mismatch("disallowSafeBoot", body.disallowSafeBoot, readback.disallowSafeBoot));
      }
      if (readback.disallowFactoryReset !== body.disallowFactoryReset) {
        mismatches.push(
          mismatch("disallowFactoryReset", body.disallowFactoryReset, readback.disallowFactoryReset),
        );
      }

      const readbackApps = normalizeAllowedApps(readback.allowedApps ?? []);
      if (readbackApps.join("\n") !== normalizedApps.join("\n")) {
        mismatches.push(mismatch("allowedApps", normalizedApps.join(","), readbackApps.join(",")));
      }

      setRecord(readback);
      setAllowedApps(readback.allowedApps ?? []);
      form.setFieldsValue(readback);

      if (mismatches.length > 0) {
        const mismatchMessage = `${t("profiles.savedReadbackMismatch")}: ${mismatches.join(" | ")}`;
        setError(mismatchMessage);
        message.error(mismatchMessage);
        return;
      }

      message.success(t("profiles.savedVerified"));
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "errorFields" in err &&
        Array.isArray((err as { errorFields?: unknown[] }).errorFields)
      ) {
        message.error(t("profiles.validationFailed"));
      } else {
        message.error(normalizeError(err, t("profiles.saveFailed")));
      }
    } finally {
      setSaving(false);
    }
  }

  const renderPolicyOption = (item: { field: PolicyField; labelKey: string; descriptionKey: string }) => (
    <Form.Item key={item.field} name={item.field} valuePropName="checked" className="profile-policy-form-item">
      <Checkbox className="profile-policy-option">
        <span className="profile-policy-option-copy">
          <Typography.Text strong>{t(item.labelKey)}</Typography.Text>
          <Typography.Text type="secondary">{t(item.descriptionKey)}</Typography.Text>
        </span>
      </Checkbox>
    </Form.Item>
  );

  if (loading) {
    return (
      <Card>
        <Alert type="info" message={t("profiles.loadingProfile")} />
      </Card>
    );
  }

  if (!record) {
    return (
      <Card>
        <Alert type="error" message={error ?? t("profiles.profileNotFound")} />
      </Card>
    );
  }

  return (
    <div className="page-stack profile-form-page">
      <Card className="profile-form-hero">
        <div className="profile-form-hero-copy">
          <Typography.Title level={3}>{t("profiles.editTitle")}</Typography.Title>
          <Typography.Paragraph type="secondary">{t("profiles.formSubtitle")}</Typography.Paragraph>
        </div>
        <Space className="profile-form-hero-meta" wrap>
          <Tag>
            {t("profiles.updatedColumn")}: {fmtEpoch(record.updatedAtEpochMillis)}
          </Tag>
          <Button onClick={() => setGuideOpen((value) => !value)}>
            {guideOpen ? t("common.hideGuide") : t("common.quickGuide")}
          </Button>
          <Button onClick={() => navigate(`/profiles/show/${id}`)}>{t("profiles.openDetail")}</Button>
        </Space>
      </Card>

      {guideOpen ? (
        <div className="profile-quick-guide">
          <Typography.Title level={5}>{t("profiles.quickGuideTitle")}</Typography.Title>
          <ol className="profile-quick-guide-content">
            {guideItems.map((key) => (
              <li key={key}>
                <Typography.Text>{t(key)}</Typography.Text>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Alert type="info" showIcon message={t("profiles.formManagementExplanation")} />

      <Form form={form} layout="vertical" className="profile-form">
        <section className="profile-form-section">
          <div className="profile-section-header">
            <div>
              <Typography.Title level={4}>{t("profiles.profileInfoSection")}</Typography.Title>
              <Typography.Paragraph type="secondary" className="profile-helper-text">
                {t("profiles.profileInfoHelp")}
              </Typography.Paragraph>
            </div>
          </div>
          <div className="profile-form-grid">
            <Form.Item name="userCode" label={t("profiles.userCode")}>
              <Input disabled className="profile-readonly-input" />
            </Form.Item>

            <Form.Item name="name" label={t("profiles.nameLabel")} rules={[{ required: true }]}>
              <Input placeholder={t("profiles.profileNamePlaceholder")} />
            </Form.Item>

            <Form.Item name="description" label={t("profiles.descriptionLabel")} className="profile-form-full">
              <Input.TextArea rows={3} placeholder={t("profiles.descriptionPlaceholder")} />
            </Form.Item>
          </div>
        </section>

        <section className="profile-form-section">
          <div className="profile-section-header">
            <div>
              <Typography.Title level={4}>{t("profiles.allowedAppsTitle")}</Typography.Title>
              <Typography.Paragraph type="secondary" className="profile-helper-text">
                {t("profiles.allowedAppsSectionHelp")}
              </Typography.Paragraph>
            </div>
            <Tag color={allowedApps.length > 0 ? "blue" : "default"}>
              {allowedApps.length} {t("profiles.appsCountLabel")}
            </Tag>
          </div>
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
              className="profile-warning-note"
              message={t("profiles.allowedAppsUnsaved")}
            />
          ) : null}
        </section>

        <section className="profile-form-section">
          <div className="profile-section-header">
            <div>
              <Typography.Title level={4}>{t("profiles.corePolicies")}</Typography.Title>
              <Typography.Paragraph type="secondary" className="profile-helper-text">
                {t("profiles.corePoliciesHelp")}
              </Typography.Paragraph>
            </div>
          </div>
          <div className="profile-policy-grid profile-policy-option-grid">{corePolicyItems.map(renderPolicyOption)}</div>
        </section>

        <section className="profile-form-section">
          <div className="profile-section-header">
            <div>
              <Typography.Title level={4}>{t("profiles.securityHardening")}</Typography.Title>
              <Typography.Paragraph type="secondary" className="profile-helper-text">
                {t("profiles.securityHardeningHelp")}
              </Typography.Paragraph>
            </div>
          </div>

          <Alert type="warning" showIcon className="profile-warning-note" message={t("profiles.warningAdb")} />

          <div className="profile-policy-grid profile-policy-option-grid">{hardeningItems.map(renderPolicyOption)}</div>
        </section>

        <div className="profile-form-actions">
          <div>
            <Typography.Text strong>{t("profiles.saveActions")}</Typography.Text>
            <Typography.Paragraph type="secondary" className="profile-helper-text">
              {t("profiles.editActionsHelp")}
            </Typography.Paragraph>
          </div>
          <div className="profile-form-action-buttons">
            <Button onClick={() => navigate("/profiles")}>{t("profiles.back")}</Button>
            <Button type="primary" onClick={() => void saveAllProfileChanges()} loading={saving}>
              {t("profiles.saveAll")}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};
