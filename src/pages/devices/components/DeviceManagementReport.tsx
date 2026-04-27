import React from "react";
import { Alert, Button, Card, Col, Descriptions, Row, Space, Tag, Tooltip, Typography } from "antd";
import type {
  AdminDeviceEventView,
  AdminLatestLocationResponse,
  AdminTelemetrySummaryResponse,
  AdminUsageSummaryResponse,
  DeviceDetailResponse,
  ProfileResponse,
} from "../../../types/api";
import {
  fmtDurationMs,
  fmtEpoch,
  fmtRelativeFromNow,
  policyStatusColor,
  telemetryFreshnessColor,
} from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  device: DeviceDetailResponse;
  linkedProfile: ProfileResponse | null;
  latestLocation: AdminLatestLocationResponse | null;
  events: AdminDeviceEventView[];
  usageSummary: AdminUsageSummaryResponse | null;
  telemetrySummary: AdminTelemetrySummaryResponse | null;
  onExportJson: () => void;
  exportDisabled?: boolean;
};

type ComplianceDisplay = {
  labelKey: string;
  color: string;
  sourceKey: string;
  detailKey: string;
  uiDerived: boolean;
};

function notAvailable(t: (key: string) => string) {
  return <Typography.Text type="secondary">{t("common.notAvailable")}</Typography.Text>;
}

function textOrNA(value: string | number | boolean | null | undefined, t: (key: string) => string) {
  if (value == null || value === "") return notAvailable(t);
  return String(value);
}

function timestamp(value: number | null | undefined, t: (key: string) => string) {
  if (!value) return notAvailable(t);
  return (
    <Space direction="vertical" size={0}>
      <Typography.Text>{fmtEpoch(value)}</Typography.Text>
      <Typography.Text type="secondary">{fmtRelativeFromNow(value)}</Typography.Text>
    </Space>
  );
}

function hashValue(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return notAvailable(t);
  const display = value.length <= 18 ? value : `${value.slice(0, 10)}...${value.slice(-6)}`;
  return (
    <Tooltip title={value}>
      <Typography.Text code copyable={{ text: value }}>
        {display}
      </Typography.Text>
    </Tooltip>
  );
}

function statusTag(value: string | null | undefined, t: (key: string) => string) {
  const up = String(value ?? "").toUpperCase();
  if (!up) return <Tag>{t("common.unknown")}</Tag>;
  return <Tag color={up === "ACTIVE" ? "green" : up === "LOCKED" ? "red" : "default"}>{up}</Tag>;
}

function deriveCompliance(device: DeviceDetailResponse): ComplianceDisplay {
  const policyStatus = String(device.policyApplyStatus ?? "").toUpperCase();
  const hasPolicyError = Boolean(device.policyApplyError || device.policyApplyErrorCode);

  if (policyStatus === "FAILED" || hasPolicyError) {
    return {
      labelKey: "common.failed",
      color: "red",
      sourceKey: device.complianceSummary ? "common.backend" : "common.uiDerived",
      detailKey: "report.compliance.policyFailure",
      uiDerived: !device.complianceSummary,
    };
  }

  if (device.complianceSummary?.isCompliant === true) {
    return {
      labelKey: "report.compliant",
      color: "green",
      sourceKey: "common.backend",
      detailKey: "report.compliance.backendCompliant",
      uiDerived: false,
    };
  }

  if (device.complianceSummary?.isCompliant === false) {
    return {
      labelKey: "common.pending",
      color: "orange",
      sourceKey: "common.backend",
      detailKey: "report.compliance.backendNonCompliant",
      uiDerived: false,
    };
  }

  if (!device.desiredConfigHash && !device.appliedConfigHash) {
    return {
      labelKey: "common.unknown",
      color: "default",
      sourceKey: "common.uiDerived",
      detailKey: "report.compliance.noDesiredApplied",
      uiDerived: true,
    };
  }

  if (!device.appliedConfigHash || device.desiredConfigHash !== device.appliedConfigHash) {
    return {
      labelKey: "common.pending",
      color: "orange",
      sourceKey: "common.uiDerived",
      detailKey: "report.compliance.outOfSync",
      uiDerived: true,
    };
  }

  if (policyStatus === "SUCCESS") {
    return {
      labelKey: "report.compliant",
      color: "green",
      sourceKey: "common.uiDerived",
      detailKey: "report.compliance.uiCompliant",
      uiDerived: true,
    };
  }

  return {
    labelKey: "common.unknown",
    color: "default",
    sourceKey: "common.uiDerived",
    detailKey: "report.compliance.notEnoughData",
    uiDerived: true,
  };
}

function latestEvent(events: AdminDeviceEventView[]) {
  return [...events].sort((a, b) => (b.createdAtEpochMillis ?? 0) - (a.createdAtEpochMillis ?? 0))[0] ?? null;
}

export const DeviceManagementReport: React.FC<Props> = ({
  device,
  linkedProfile,
  latestLocation,
  events,
  usageSummary,
  telemetrySummary,
  onExportJson,
  exportDisabled,
}) => {
  const t = useT();
  const compliance = deriveCompliance(device);
  const newestEvent = latestEvent(events);
  const usageItems = usageSummary?.items ?? [];
  const topUsage = [...usageItems].sort((a, b) => b.totalDurationMs - a.totalDurationMs)[0] ?? null;

  return (
    <Card
      title={t("report.title")}
      style={{ marginTop: 16 }}
      extra={
        <Button onClick={onExportJson} disabled={exportDisabled}>
          {t("report.exportJson")}
        </Button>
      }
    >
      <div className="page-stack">
        <Alert
          type="info"
          showIcon
          message={t("report.managementExplanation")}
          description={t("report.managementDescription")}
        />

        <Row gutter={[12, 12]}>
          <Col xs={24} xl={12}>
            <Card size="small" title={t("report.deviceIdentity")}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t("report.deviceId")}>
                  <Typography.Text code copyable={{ text: device.id }}>
                    {device.id}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t("report.deviceCode")}>
                  <Typography.Text code>{device.deviceCode}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t("common.status")}>{statusTag(device.status, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.linkedProfile")}>
                  {linkedProfile ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{linkedProfile.name}</Typography.Text>
                      <Typography.Text type="secondary">
                        userCode={linkedProfile.userCode} / id={linkedProfile.id}
                      </Typography.Text>
                    </Space>
                  ) : device.userCode ? (
                    <Tag color="blue">{device.userCode}</Tag>
                  ) : (
                    notAvailable(t)
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.lastSeen")}>{timestamp(device.lastSeenAtEpochMillis, t)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title={t("report.configurationState")}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t("report.desiredConfigHash")}>{hashValue(device.desiredConfigHash, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.desiredVersion")}>{timestamp(device.desiredConfigVersionEpochMillis, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.appliedConfigHash")}>{hashValue(device.appliedConfigHash, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.appliedVersion")}>{timestamp(device.appliedConfigVersionEpochMillis, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.policyApplyStatus")}>
                  <Tag color={policyStatusColor(device.policyApplyStatus)}>
                    {String(device.policyApplyStatus || t("common.unknown")).toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("report.policyApplyError")}>{textOrNA(device.policyApplyError, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.policyErrorCode")}>{textOrNA(device.policyApplyErrorCode, t)}</Descriptions.Item>
                <Descriptions.Item label={t("report.policyAppliedAt")}>{timestamp(device.lastPolicyAppliedAtEpochMillis, t)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} xl={12}>
            <Card size="small" title={t("report.complianceSummary")}>
              <Space direction="vertical" size={8}>
                <Space wrap>
                  <Tag color={compliance.color}>{t(compliance.labelKey)}</Tag>
                  <Tag>{t(compliance.sourceKey)}</Tag>
                  {device.healthSummary?.isOnline != null ? (
                    <Tag color={device.healthSummary.isOnline ? "green" : "red"}>
                      online={String(device.healthSummary.isOnline)}
                    </Tag>
                  ) : null}
                  {device.healthSummary?.telemetryFreshness ? (
                    <Tag color={telemetryFreshnessColor(device.healthSummary.telemetryFreshness)}>
                      telemetry={device.healthSummary.telemetryFreshness}
                    </Tag>
                  ) : null}
                </Space>
                <Typography.Text type="secondary">{t(compliance.detailKey)}</Typography.Text>
                {compliance.uiDerived ? (
                  <Typography.Text type="secondary">
                    {t("report.uiDerivedSourceOfTruth")}
                  </Typography.Text>
                ) : null}
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title={t("report.latestRuntimeData")}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t("report.latestLocation")}>
                  {latestLocation ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>
                        {latestLocation.latitude}, {latestLocation.longitude}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        accuracy={latestLocation.accuracyMeters}m / {fmtEpoch(latestLocation.updatedAtEpochMillis)}
                      </Typography.Text>
                    </Space>
                  ) : (
                    notAvailable(t)
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t("report.telemetrySummary")}>
                  {telemetrySummary ? (
                    <Space wrap>
                      <Tag>types={telemetrySummary.eventCountByType.length}</Tag>
                      <Tag>categories={telemetrySummary.eventCountByCategory.length}</Tag>
                      <Tag>severities={telemetrySummary.eventCountBySeverity.length}</Tag>
                      <Tag>generated={fmtEpoch(telemetrySummary.generatedAtEpochMillis)}</Tag>
                    </Space>
                  ) : (
                    notAvailable(t)
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t("report.usageSummary")}>
                  {usageSummary ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{usageItems.length} {t("report.rows")}</Typography.Text>
                      <Typography.Text type="secondary">
                        top={topUsage ? `${topUsage.packageName} (${fmtDurationMs(topUsage.totalDurationMs)})` : t("common.notAvailable")}
                      </Typography.Text>
                    </Space>
                  ) : (
                    notAvailable(t)
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t("report.recentEvents")}>
                  {newestEvent ? (
                    <Space direction="vertical" size={0}>
                      <Space wrap>
                        <Typography.Text>{events.length} {t("report.events")}</Typography.Text>
                        <Tag>{newestEvent.type}</Tag>
                        <Tag>{newestEvent.severity}</Tag>
                      </Space>
                      <Typography.Text type="secondary">{fmtEpoch(newestEvent.createdAtEpochMillis)}</Typography.Text>
                    </Space>
                  ) : (
                    notAvailable(t)
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </div>
    </Card>
  );
};
