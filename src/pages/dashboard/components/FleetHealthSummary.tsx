import React, { useMemo } from "react";
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import type { DeviceResponse } from "../../../types/api";
import { fmtEpoch, onlineStateFromLastSeen } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  devices: DeviceResponse[];
  loading?: boolean;
  lastUpdatedAt?: number | null;
};

function statusCount(devices: DeviceResponse[], status: string) {
  return devices.filter((item) => String(item.status).toUpperCase() === status).length;
}

export const FleetHealthSummary: React.FC<Props> = ({ devices, loading, lastUpdatedAt }) => {
  const t = useT();
  const metrics = useMemo(() => {
    const active = statusCount(devices, "ACTIVE");
    const locked = statusCount(devices, "LOCKED");
    const online = devices.filter((item) => onlineStateFromLastSeen(item.lastSeenAtEpochMillis) === "online").length;
    const staleOrOffline = devices.filter((item) => {
      const state = onlineStateFromLastSeen(item.lastSeenAtEpochMillis);
      return state === "offline" || state === "lost_contact";
    }).length;
    const unknownLastSeen = devices.filter((item) => onlineStateFromLastSeen(item.lastSeenAtEpochMillis) === "unknown").length;

    return {
      total: devices.length,
      active,
      locked,
      online,
      staleOrOffline,
      unknownLastSeen,
    };
  }, [devices]);

  return (
    <Card title={t("dashboard.fleetTitle")} className="ops-card">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message={t("dashboard.fleetInfoMessage")}
          description={t("dashboard.fleetInfoDescription")}
        />

        <Row gutter={[16, 16]}>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.totalDevices")} value={metrics.total} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.activeDevices")} value={metrics.active} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.lockedDevices")} value={metrics.locked} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.onlineByLastSeen")} value={metrics.online} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.staleOfflineByLastSeen")} value={metrics.staleOrOffline} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title={t("dashboard.unknownLastSeen")} value={metrics.unknownLastSeen} loading={loading} />
          </Col>
        </Row>

        <div className="fleet-availability">
          <div className="fleet-availability-header">
            <Typography.Text strong>{t("dashboard.fleetMetricAvailability")}</Typography.Text>
            <Typography.Text type="secondary">
              {t("common.lastUpdated")}: {fmtEpoch(lastUpdatedAt)}
            </Typography.Text>
          </div>

          <div className="fleet-availability-grid">
            <div className="fleet-availability-item">
              <Typography.Text type="secondary">{t("dashboard.complianceTotal")}</Typography.Text>
              <Tag>{t("common.notAvailable")}</Tag>
            </div>
            <div className="fleet-availability-item">
              <Typography.Text type="secondary">{t("dashboard.pendingApplyTotal")}</Typography.Text>
              <Tag>{t("common.notAvailable")}</Tag>
            </div>
            <div className="fleet-availability-item">
              <Typography.Text type="secondary">{t("dashboard.failedApplyTotal")}</Typography.Text>
              <Tag>{t("common.notAvailable")}</Tag>
            </div>
          </div>
        </div>
      </Space>
    </Card>
  );
};
