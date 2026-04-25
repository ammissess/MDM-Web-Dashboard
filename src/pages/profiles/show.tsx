import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Collapse, Descriptions, Empty, Row, Col, Space, Statistic, Tag, Typography } from "antd";
import type { ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { fmtEpoch, fmtRelativeFromNow, normalizeError } from "../../utils/format";
import { useT } from "../../i18n";

const hardeningItems: Array<{ key: keyof ProfileResponse; label: string }> = [
  { key: "lockPrivateDnsConfig", label: "Lock Private DNS" },
  { key: "lockVpnConfig", label: "Lock VPN" },
  { key: "blockDebuggingFeatures", label: "Block debugging" },
  { key: "disableUsbDataSignaling", label: "Disable USB data" },
  { key: "disallowSafeBoot", label: "Disallow safe boot" },
  { key: "disallowFactoryReset", label: "Disallow factory reset" },
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
      setError(normalizeError(err, "Cannot load profile"));
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        <Empty description={error ?? "Profile not found"} />
      </Card>
    );
  }

  return (
    <div className="page-stack">
      <Card
        className="profile-detail-hero"
        title={profile.name}
        extra={
          <Link to={`/profiles/edit/${profile.id}`}>
            <Button type="primary">Edit</Button>
          </Link>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Statistic title="Allowed apps" value={profile.allowedApps.length} />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Hardening enabled" value={hardeningEnabled} suffix={`/ ${hardeningItems.length}`} />
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">Updated</Typography.Text>
              <Typography.Text>{fmtRelativeFromNow(profile.updatedAtEpochMillis)}</Typography.Text>
            </Space>
          </Col>
        </Row>

        <Descriptions bordered size="small" column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="User Code">
            <Typography.Text code>{profile.userCode}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Profile ID">
            <Typography.Text code>{profile.id}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Description">{profile.description || "-"}</Descriptions.Item>
          <Descriptions.Item label="Updated">{fmtEpoch(profile.updatedAtEpochMillis)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t("device.corePolicy")} className="ops-card">
            <Space wrap>
              <Tag color={profile.kioskMode ? "green" : "default"}>kioskMode={String(profile.kioskMode)}</Tag>
              <Tag color={profile.disableStatusBar ? "red" : "green"}>disableStatusBar={String(profile.disableStatusBar)}</Tag>
              <Tag color={profile.blockUninstall ? "red" : "green"}>blockUninstall={String(profile.blockUninstall)}</Tag>
              <Tag>disableWifi={String(profile.disableWifi)}</Tag>
              <Tag>disableBluetooth={String(profile.disableBluetooth)}</Tag>
              <Tag>disableCamera={String(profile.disableCamera)}</Tag>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={t("device.securityHardening")} className="ops-card">
            <Space wrap>
              {hardeningItems.map((item) => (
                <Tag key={item.key} color={profile[item.key] ? "red" : "default"}>
                  {item.label}={String(profile[item.key])}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title={`${t("device.allowedApps")} (${profile.allowedApps.length})`} className="ops-card">
        {profile.allowedApps.length === 0 ? (
          <Tag>{t("common.empty")}</Tag>
        ) : (
          <Collapse
            ghost
            defaultActiveKey={profile.allowedApps.length <= 24 ? ["apps"] : []}
            items={[
              {
                key: "apps",
                label:
                  profile.allowedApps.length > 12
                    ? `${profile.allowedApps.length} packages`
                    : "Packages",
                children: (
                  <div className="allowed-app-scroll">
                    {profile.allowedApps.map((pkg) => (
                      <Tag key={pkg}>{pkg}</Tag>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Alert
        type="warning"
        showIcon
        message="Do not enable Block debugging / Disable USB data while testing with ADB or emulator. It may disconnect debugging."
      />

      <Alert
        type="info"
        showIcon
        message={t("device.backendOwned")}
        description="When this profile changes, backend recomputes desired config for linked devices and may enqueue refresh_config. Android proof still depends on poll/ack/policy-state."
      />
    </div>
  );
};
