import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Descriptions, Empty, Tag, Typography } from "antd";
import type { ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { fmtEpoch, normalizeError } from "../../utils/format";
import { useT } from "../../i18n";

type BooleanPolicyKey =
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
  | "disallowFactoryReset";

const corePolicyItems: Array<{ key: BooleanPolicyKey; labelKey: string; positiveWhenEnabled?: boolean }> = [
  { key: "kioskMode", labelKey: "profiles.policy.kioskMode", positiveWhenEnabled: true },
  { key: "disableStatusBar", labelKey: "profiles.policy.disableStatusBar" },
  { key: "blockUninstall", labelKey: "profiles.policy.blockUninstall" },
  { key: "disableWifi", labelKey: "profiles.policy.disableWifi" },
  { key: "disableBluetooth", labelKey: "profiles.policy.disableBluetooth" },
  { key: "disableCamera", labelKey: "profiles.policy.disableCamera" },
];

const hardeningItems: Array<{ key: BooleanPolicyKey; labelKey: string }> = [
  { key: "lockPrivateDnsConfig", labelKey: "profiles.policy.lockPrivateDnsConfig" },
  { key: "lockVpnConfig", labelKey: "profiles.policy.lockVpnConfig" },
  { key: "blockDebuggingFeatures", labelKey: "profiles.policy.blockDebuggingFeatures" },
  { key: "disableUsbDataSignaling", labelKey: "profiles.policy.disableUsbDataSignaling" },
  { key: "disallowSafeBoot", labelKey: "profiles.policy.disallowSafeBoot" },
  { key: "disallowFactoryReset", labelKey: "profiles.policy.disallowFactoryReset" },
];

export const ProfileShowPage: React.FC = () => {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await http.get<ProfileResponse>(`/api/admin/profiles/${id}`);
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(normalizeError(err, t("profiles.loadOneFailed")));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const hardeningEnabled = useMemo(
    () => hardeningItems.filter((item) => Boolean(profile?.[item.key])).length,
    [profile],
  );

  if (loading) {
    return (
      <Card>
        <Alert type="info" message={t("common.loading")} />
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <Empty description={error ?? t("profiles.profileNotFound")} />
      </Card>
    );
  }

  const renderPolicyTag = (item: { key: BooleanPolicyKey; labelKey: string; positiveWhenEnabled?: boolean }) => {
    const enabled = Boolean(profile[item.key]);
    const color = enabled ? (item.positiveWhenEnabled ? "green" : "orange") : "default";

    return (
      <div className="profile-policy-tag" key={item.key}>
        <Typography.Text>{t(item.labelKey)}</Typography.Text>
        <Tag color={color}>{enabled ? t("profiles.on") : t("profiles.off")}</Tag>
      </div>
    );
  };

  return (
    <div className="page-stack profile-detail-page">
      <Card className="profile-detail-hero">
        <div className="profile-detail-hero-top">
          <div className="profile-hero-copy">
            <Typography.Text type="secondary">{t("profiles.profileName")}</Typography.Text>
            <Typography.Title level={3} style={{ margin: "2px 0 0" }}>
              {profile.name || t("common.notAvailable")}
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="profile-detail-description">
              {t("profiles.detailDescription")}
            </Typography.Paragraph>
            <div className="profile-hero-code-row">
              <Tag>{profile.userCode}</Tag>
              <Tag>{profile.id}</Tag>
            </div>
          </div>
          <Link to={`/profiles/edit/${profile.id}`}>
            <Button type="primary">{t("profiles.editProfile")}</Button>
          </Link>
        </div>

        <div className="profile-hero-metrics">
          <div className="profile-hero-metric">
            <Typography.Text type="secondary">{t("profiles.profileCode")}</Typography.Text>
            <Typography.Text code>{profile.userCode}</Typography.Text>
          </div>
          <div className="profile-hero-metric">
            <Typography.Text type="secondary">{t("profiles.profileId")}</Typography.Text>
            <Typography.Text code className="profile-hero-metric-code">
              {profile.id}
            </Typography.Text>
          </div>
          <div className="profile-hero-metric">
            <Typography.Text type="secondary">{t("profiles.allowedAppsMetric")}</Typography.Text>
            <Typography.Text strong>{profile.allowedApps.length}</Typography.Text>
          </div>
          <div className="profile-hero-metric">
            <Typography.Text type="secondary">{t("profiles.hardeningEnabled")}</Typography.Text>
            <Typography.Text strong>
              {hardeningEnabled} / {hardeningItems.length}
            </Typography.Text>
          </div>
          <div className="profile-hero-metric">
            <Typography.Text type="secondary">{t("profiles.lastUpdated")}</Typography.Text>
            <Typography.Text>{fmtEpoch(profile.updatedAtEpochMillis)}</Typography.Text>
          </div>
        </div>
      </Card>

      <section className="profile-section-surface">
        <div className="profile-section-header">
          <Typography.Title level={4}>{t("profiles.basicInfo")}</Typography.Title>
        </div>
        <Descriptions bordered size="small" column={1} className="profile-compact-descriptions">
          <Descriptions.Item label={t("profiles.userCode")}>
            <Typography.Text code>{profile.userCode}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t("profiles.profileId")}>
            <Typography.Text code>{profile.id}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t("profiles.descriptionLabel")}>
            {profile.description || t("common.notAvailable")}
          </Descriptions.Item>
          <Descriptions.Item label={t("profiles.updatedColumn")}>{fmtEpoch(profile.updatedAtEpochMillis)}</Descriptions.Item>
        </Descriptions>
      </section>

      <section className="profile-section-surface">
        <div className="profile-section-header">
          <Typography.Title level={4}>{t("profiles.policyOverview")}</Typography.Title>
        </div>
        <div className="profile-policy-grid">
          <div className="profile-policy-panel">
            <Typography.Title level={5}>{t("profiles.corePolicies")}</Typography.Title>
            <div className="profile-policy-tags">{corePolicyItems.map(renderPolicyTag)}</div>
          </div>
          <div className="profile-policy-panel">
            <Typography.Title level={5}>{t("profiles.securityHardening")}</Typography.Title>
            <div className="profile-policy-tags">{hardeningItems.map(renderPolicyTag)}</div>
          </div>
        </div>
      </section>

      <section className="profile-section-surface">
        <div className="profile-section-header">
          <Typography.Title level={4}>{t("profiles.operationalNotes")}</Typography.Title>
        </div>
        <div className="profile-operational-notes">
          <Alert
            type="warning"
            showIcon
            className="profile-operational-note profile-note-warning"
            message={t("profiles.operationalHardeningTitle")}
            description={t("profiles.operationalHardeningContent")}
          />
          <Alert
            type="info"
            showIcon
            className="profile-operational-note profile-note-info"
            message={t("profiles.operationalApplyTitle")}
            description={t("profiles.operationalApplyContent")}
          />
        </div>
      </section>

      <section className="profile-section-surface">
        <div className="profile-section-header">
          <Typography.Title level={4}>{t("profiles.allowedAppsTitle")}</Typography.Title>
          <Tag color={profile.allowedApps.length > 0 ? "blue" : "default"}>{profile.allowedApps.length}</Tag>
        </div>
        {profile.allowedApps.length > 0 ? (
          <div className="profile-app-tags">
            {profile.allowedApps.map((pkg) => (
              <Tag key={pkg}>{pkg}</Tag>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("profiles.noAllowedApps")} />
        )}
      </section>
    </div>
  );
};
