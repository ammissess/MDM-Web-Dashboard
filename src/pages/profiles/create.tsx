import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Form, Input, Tag, Typography, message } from "antd";
import type { ProfileCreateRequest } from "../../types/api";
import { http } from "../../providers/axios";
import { normalizeError } from "../../utils/format";
import { AllowedAppsEditor } from "./components/AllowedAppsEditor";
import { useT } from "../../i18n";

type PolicyField = keyof Pick<
  ProfileCreateRequest,
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

function makeInitialValues(defaultName: string): ProfileCreateRequest {
  return {
    userCode: "",
    name: defaultName,
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
}

export const ProfileCreatePage: React.FC = () => {
  const t = useT();
  const [form] = Form.useForm<ProfileCreateRequest>();
  const navigate = useNavigate();
  const initialValues = useMemo(() => makeInitialValues(t("profiles.defaultName")), [t]);
  const watchedAllowedApps = Form.useWatch("allowedApps", form) ?? [];
  const [guideOpen, setGuideOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guideItems = [
    "profiles.createGuide.codeName",
    "profiles.createGuide.allowedApps",
    "profiles.createGuide.corePolicies",
    "profiles.createGuide.hardening",
    "profiles.createGuide.assignDevices",
  ];

  async function onFinish(values: ProfileCreateRequest) {
    setSaving(true);
    setError(null);
    try {
      const { data } = await http.post("/api/admin/profiles", values);
      message.success(t("profiles.created"));
      navigate(`/profiles/show/${data.id}`);
    } catch (err) {
      setError(normalizeError(err, t("profiles.createFailed")));
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

  return (
    <div className="page-stack profile-form-page">
      <Card className="profile-form-hero">
        <div className="profile-form-hero-copy">
          <Typography.Title level={3}>{t("profiles.createTitle")}</Typography.Title>
          <Typography.Paragraph type="secondary">{t("profiles.formSubtitle")}</Typography.Paragraph>
        </div>
        <Button className="profile-quick-guide-toggle" onClick={() => setGuideOpen((value) => !value)}>
          {guideOpen ? t("common.hideGuide") : t("common.quickGuide")}
        </Button>
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

      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onFinish} className="profile-form">
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
            <Form.Item name="userCode" label={t("profiles.userCode")} rules={[{ required: true }]}>
              <Input placeholder={t("profiles.profileCodePlaceholder")} />
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
            <Tag color={watchedAllowedApps.length > 0 ? "blue" : "default"}>
              {watchedAllowedApps.length} {t("profiles.appsCountLabel")}
            </Tag>
          </div>
          <Form.Item name="allowedApps" className="profile-form-field">
            <AllowedAppsEditor />
          </Form.Item>
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
              {t("profiles.createActionsHelp")}
            </Typography.Paragraph>
          </div>
          <div className="profile-form-action-buttons">
            <Button onClick={() => navigate("/profiles")}>{t("profiles.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t("profiles.create")}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};
