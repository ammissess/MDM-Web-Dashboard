import React, { useMemo } from "react";
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import type { DeviceResponse } from "../../../types/api";
import { fmtEpoch, onlineStateFromLastSeen } from "../../../utils/format";

type Props = {
  devices: DeviceResponse[];
  loading?: boolean;
  lastUpdatedAt?: number | null;
};

function statusCount(devices: DeviceResponse[], status: string) {
  return devices.filter((item) => String(item.status).toUpperCase() === status).length;
}

export const FleetHealthSummary: React.FC<Props> = ({ devices, loading, lastUpdatedAt }) => {
  const metrics = useMemo(() => {
    const active = statusCount(devices, "ACTIVE");
    const locked = statusCount(devices, "LOCKED");
    const online = devices.filter((item) => onlineStateFromLastSeen(item.lastSeenAtEpochMillis) === "online").length;
    const staleOrOffline = devices.filter((item) => onlineStateFromLastSeen(item.lastSeenAtEpochMillis) === "offline").length;
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
    <Card title="Fleet Health Summary" className="ops-card">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Metrics are calculated from current admin read data. Missing fields are shown as Not available."
          description="Online/stale display is UI-derived from lastSeenAtEpochMillis. Compliance and policy-apply fleet totals are not shown because the list endpoint does not expose those fields for every device."
        />

        <Row gutter={[16, 16]}>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Total devices" value={metrics.total} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Active devices" value={metrics.active} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Locked devices" value={metrics.locked} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Online by lastSeen" value={metrics.online} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Stale/offline by lastSeen" value={metrics.staleOrOffline} loading={loading} />
          </Col>
          <Col xs={12} md={8} xl={4}>
            <Statistic title="Unknown lastSeen" value={metrics.unknownLastSeen} loading={loading} />
          </Col>
        </Row>

        <Space wrap>
          <Tag>compliance fleet total: Not available</Tag>
          <Tag>pending apply fleet total: Not available</Tag>
          <Tag>failed apply fleet total: Not available</Tag>
          <Typography.Text type="secondary">Last updated: {fmtEpoch(lastUpdatedAt)}</Typography.Text>
        </Space>
      </Space>
    </Card>
  );
};
