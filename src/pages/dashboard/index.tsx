import React, { useCallback, useMemo, useState } from "react";
import { Alert, Badge, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { AxiosResponse } from "axios";
import type { AuditLogItem, AuditLogListResponse, DeviceDetailResponse, DeviceResponse, ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fmtEpoch, fmtRelativeFromNow, normalizeError, policyStatusColor } from "../../utils/format";
import { LiveStatusBadge } from "../devices/components/LiveStatusBadge";
import { useT } from "../../i18n";

function shortHash(value?: string | null) {
  if (!value) return "-";
  return value.length <= 14 ? value : `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function wakeupResultColor(value?: string | null) {
  const up = String(value ?? "").toUpperCase();
  if (!up) return "default";
  if (up.startsWith("DELIVERED")) return "green";
  if (up.startsWith("NOT_DELIVERED")) return "orange";
  if (up.startsWith("FAILED")) return "red";
  if (up.startsWith("SKIPPED")) return "default";
  return "blue";
}

function hasWakeupIssue(value?: string | null) {
  const up = String(value ?? "").toUpperCase();
  return up.startsWith("FAILED") || up.startsWith("NOT_DELIVERED") || up.startsWith("SKIPPED_NO_TOKEN");
}

function isRecentlyPolled(value?: number | null) {
  if (!value) return false;
  return Date.now() - value <= 10 * 60 * 1000;
}

function isInSync(device: DeviceDetailResponse) {
  if (device.complianceSummary?.isCompliant === true) return true;
  if (!device.desiredConfigHash && !device.appliedConfigHash) return false;
  return Boolean(device.desiredConfigHash && device.desiredConfigHash === device.appliedConfigHash);
}

function compactDeviceName(device: DeviceResponse | DeviceDetailResponse) {
  return `${device.manufacturer || "-"} ${device.model || ""}`.trim();
}

export const DashboardPage: React.FC = () => {
  const t = useT();
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [profiles, setProfiles] = useState<ProfileResponse[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditLogItem[]>([]);
  const [recentDetails, setRecentDetails] = useState<DeviceDetailResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "background" = "background") => {
    if (mode === "background") {
      setBackgroundRefreshing(true);
    }

    try {
      const [devicesRes, profilesRes, auditRes] = await Promise.all([
        http.get<DeviceResponse[]>("/api/admin/devices"),
        http.get<ProfileResponse[]>("/api/admin/profiles"),
        http.get<AuditLogListResponse>("/api/admin/audit", { params: { limit: 8, offset: 0 } }),
      ]);

      const deviceItems = devicesRes.data ?? [];
      const detailTargets = [...deviceItems]
        .sort((a, b) => b.lastSeenAtEpochMillis - a.lastSeenAtEpochMillis)
        .slice(0, 6);

      const detailResults = await Promise.allSettled(
        detailTargets.map((item) => http.get<DeviceDetailResponse>(`/api/admin/devices/${item.id}`)),
      );

      setDevices(deviceItems);
      setProfiles(profilesRes.data ?? []);
      setRecentAudit(auditRes.data?.items ?? []);
      setRecentDetails(
        detailResults
          .filter((result): result is PromiseFulfilledResult<AxiosResponse<DeviceDetailResponse>> => result.status === "fulfilled")
          .map((result) => result.value.data),
      );
      setLastUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(normalizeError(err, "Cannot load dashboard"));
    } finally {
      setInitialLoading(false);
      setBackgroundRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load("initial");
  }, [load]);

  useAutoRefresh(() => load("background"), true, 5_000, [load]);

  const metrics = useMemo(() => {
    const active = devices.filter((item) => String(item.status).toUpperCase() === "ACTIVE").length;
    const locked = devices.filter((item) => String(item.status).toUpperCase() === "LOCKED").length;
    const recentlyPolled = recentDetails.filter((item) => isRecentlyPolled(item.lastPollAtEpochMillis)).length;
    const outOfSync = recentDetails.filter((item) => !isInSync(item)).length;
    const nonCompliant = recentDetails.filter((item) => item.complianceSummary?.isCompliant === false).length;
    const wakeupIssues = recentDetails.filter((item) => hasWakeupIssue(item.lastWakeupResult)).length;

    return { active, locked, recentlyPolled, outOfSync, nonCompliant, wakeupIssues };
  }, [devices, recentDetails]);

  const recentDevices = useMemo(() => {
    const attentionIds = new Set(
      recentDetails
        .filter(
          (item) =>
            !isInSync(item) ||
            item.complianceSummary?.isCompliant === false ||
            hasWakeupIssue(item.lastWakeupResult) ||
            String(item.status).toUpperCase() === "LOCKED",
        )
        .map((item) => item.id),
    );

    return [...devices]
      .sort((a, b) => {
        const attentionDelta = Number(attentionIds.has(b.id)) - Number(attentionIds.has(a.id));
        if (attentionDelta !== 0) return attentionDelta;
        return b.lastSeenAtEpochMillis - a.lastSeenAtEpochMillis;
      })
      .slice(0, 8);
  }, [devices, recentDetails]);

  const deliveryRows = useMemo(
    () =>
      [...recentDetails]
        .sort((a, b) => (b.lastWakeupAttemptAtEpochMillis ?? 0) - (a.lastWakeupAttemptAtEpochMillis ?? 0))
        .slice(0, 6),
    [recentDetails],
  );

  return (
    <div className="page-stack operations-dashboard">
      <div className="operations-hero">
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
            {t("dashboard.title")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("dashboard.subtitle")}
          </Typography.Paragraph>
        </div>

        <Space direction="vertical" size={2} align="end">
          <Badge status={backgroundRefreshing ? "processing" : "success"} text={backgroundRefreshing ? t("common.updating") : t("common.updated")} />
          <Typography.Text type="secondary">
            {t("common.lastUpdated")}: {fmtEpoch(lastUpdatedAt)}
          </Typography.Text>
        </Space>
      </div>

      {error ? (
        <Alert
          type="warning"
          showIcon
          message={error}
          description="Previous dashboard data is kept on screen while the next refresh retries."
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.devices")} value={devices.length} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.active")} value={metrics.active} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.locked")} value={metrics.locked} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.profiles")} value={profiles.length} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.recentlyPolled")} value={metrics.recentlyPolled} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.outOfSync")} value={metrics.outOfSync} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.nonCompliant")} value={metrics.nonCompliant} loading={initialLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="metric-card">
            <Statistic title={t("dashboard.wakeupIssues")} value={metrics.wakeupIssues} loading={initialLoading} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-equal-row">
        <Col xs={24} xl={15} className="dashboard-equal-col">
          <Card title={t("dashboard.recentDevices")} className="ops-card dashboard-equal-card">
            <div className="dashboard-scroll-card-body">
              <Table<DeviceResponse>
                dataSource={recentDevices}
                rowKey="id"
                pagination={false}
                loading={initialLoading && devices.length === 0}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("dashboard.noDevices")} /> }}
                size="small"
                scroll={{ y: 360 }}
              >
              <Table.Column<DeviceResponse>
                title={t("common.device")}
                render={(_, record) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text code>{record.deviceCode}</Typography.Text>
                    <Typography.Text type="secondary">{compactDeviceName(record)}</Typography.Text>
                  </Space>
                )}
              />
              <Table.Column<DeviceResponse>
                title={t("common.status")}
                render={(_, record) => {
                  const up = String(record.status).toUpperCase();
                  return <Tag color={up === "ACTIVE" ? "green" : up === "LOCKED" ? "red" : "default"}>{up}</Tag>;
                }}
              />
              <Table.Column<DeviceResponse>
                title="Liveness"
                render={(_, record) => <LiveStatusBadge lastSeenAtEpochMillis={record.lastSeenAtEpochMillis} />}
              />
              <Table.Column<DeviceResponse>
                title="Last seen"
                render={(_, record) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{fmtEpoch(record.lastSeenAtEpochMillis)}</Typography.Text>
                    <Typography.Text type="secondary">{fmtRelativeFromNow(record.lastSeenAtEpochMillis)}</Typography.Text>
                  </Space>
                )}
              />
              </Table>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={9} className="dashboard-equal-col">
          <Card title={t("dashboard.audit")} className="ops-card dashboard-equal-card">
            <div className="dashboard-scroll-card-body">
              {recentAudit.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("dashboard.noAudit")} />
              ) : (
                <div className="scroll-panel feed-panel">
                  {recentAudit.map((item) => (
                    <div key={item.id} className="feed-item">
                      <div className="command-item-top">
                        <Typography.Text strong>{item.action}</Typography.Text>
                        <Tag>{item.actorType}</Tag>
                      </div>
                      <Typography.Text type="secondary">
                        {item.targetType ?? "-"}: {item.targetId ?? "-"}
                      </Typography.Text>
                      <Typography.Text type="secondary">{fmtEpoch(item.createdAtEpochMillis)}</Typography.Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title={t("dashboard.complianceOverview")} className="ops-card">
            {recentDetails.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No device detail snapshots" />
            ) : (
              <div className="scroll-panel">
                {recentDetails.map((item) => {
                  const inSync = isInSync(item);
                  return (
                    <div className="ops-snapshot-row" key={item.id}>
                      <Space direction="vertical" size={2}>
                        <Space wrap>
                          <Typography.Text strong>{item.deviceCode}</Typography.Text>
                          <Tag color={String(item.status).toUpperCase() === "ACTIVE" ? "green" : "red"}>
                            {String(item.status).toUpperCase()}
                          </Tag>
                        </Space>
                        <Typography.Text type="secondary">
                          desired {shortHash(item.desiredConfigHash)} / applied {shortHash(item.appliedConfigHash)}
                        </Typography.Text>
                      </Space>

                      <Space wrap>
                        <Tag color={inSync ? "green" : "orange"}>{inSync ? "desired=applied" : "desired!=applied"}</Tag>
                        <Tag color={policyStatusColor(item.policyApplyStatus)}>{String(item.policyApplyStatus).toUpperCase()}</Tag>
                      </Space>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title={t("dashboard.deliveryHealth")} className="ops-card">
            {deliveryRows.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No wake-up/poll data yet" />
            ) : (
              <div className="scroll-panel">
                {deliveryRows.map((item) => (
                  <div className="ops-snapshot-row" key={item.id}>
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>{item.deviceCode}</Typography.Text>
                      <Typography.Text type="secondary">
                        poll {fmtRelativeFromNow(item.lastPollAtEpochMillis)} / ack {fmtRelativeFromNow(item.lastCommandAckAtEpochMillis)}
                      </Typography.Text>
                    </Space>

                    <Space wrap>
                      <Tag color={item.hasFcmToken ? "blue" : "default"}>FCM={String(item.hasFcmToken)}</Tag>
                      {item.lastWakeupResult ? <Tag color={wakeupResultColor(item.lastWakeupResult)}>{item.lastWakeupResult}</Tag> : <Tag>no wake-up</Tag>}
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
