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
  label: "Compliant" | "Pending" | "Failed" | "Unknown";
  color: string;
  source: "Backend" | "UI-derived";
  detail: string;
};

const notAvailable = <Typography.Text type="secondary">Not available</Typography.Text>;

function textOrNA(value?: string | number | boolean | null) {
  if (value == null || value === "") return notAvailable;
  return String(value);
}

function timestamp(value?: number | null) {
  if (!value) return notAvailable;
  return (
    <Space direction="vertical" size={0}>
      <Typography.Text>{fmtEpoch(value)}</Typography.Text>
      <Typography.Text type="secondary">{fmtRelativeFromNow(value)}</Typography.Text>
    </Space>
  );
}

function hashValue(value?: string | null) {
  if (!value) return notAvailable;
  const display = value.length <= 18 ? value : `${value.slice(0, 10)}...${value.slice(-6)}`;
  return (
    <Tooltip title={value}>
      <Typography.Text code copyable={{ text: value }}>
        {display}
      </Typography.Text>
    </Tooltip>
  );
}

function statusTag(value?: string | null) {
  const up = String(value ?? "").toUpperCase();
  if (!up) return <Tag>Unknown</Tag>;
  return <Tag color={up === "ACTIVE" ? "green" : up === "LOCKED" ? "red" : "default"}>{up}</Tag>;
}

function deriveCompliance(device: DeviceDetailResponse): ComplianceDisplay {
  const policyStatus = String(device.policyApplyStatus ?? "").toUpperCase();
  const hasPolicyError = Boolean(device.policyApplyError || device.policyApplyErrorCode);

  if (policyStatus === "FAILED" || hasPolicyError) {
    return {
      label: "Failed",
      color: "red",
      source: device.complianceSummary ? "Backend" : "UI-derived",
      detail: "Policy apply failure or policy error is present.",
    };
  }

  if (device.complianceSummary?.isCompliant === true) {
    return {
      label: "Compliant",
      color: "green",
      source: "Backend",
      detail: "Backend compliance summary reports this device as compliant.",
    };
  }

  if (device.complianceSummary?.isCompliant === false) {
    return {
      label: "Pending",
      color: "orange",
      source: "Backend",
      detail: "Backend compliance summary reports non-compliant; review desired/applied state.",
    };
  }

  if (!device.desiredConfigHash && !device.appliedConfigHash) {
    return {
      label: "Unknown",
      color: "default",
      source: "UI-derived",
      detail: "Desired/applied config data is not available.",
    };
  }

  if (!device.appliedConfigHash || device.desiredConfigHash !== device.appliedConfigHash) {
    return {
      label: "Pending",
      color: "orange",
      source: "UI-derived",
      detail: "Desired and applied config are not in sync yet.",
    };
  }

  if (policyStatus === "SUCCESS") {
    return {
      label: "Compliant",
      color: "green",
      source: "UI-derived",
      detail: "Desired and applied config match and policy apply status is SUCCESS.",
    };
  }

  return {
    label: "Unknown",
    color: "default",
    source: "UI-derived",
    detail: "Policy apply status is not enough to classify compliance.",
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
  const compliance = deriveCompliance(device);
  const newestEvent = latestEvent(events);
  const usageItems = usageSummary?.items ?? [];
  const topUsage = [...usageItems].sort((a, b) => b.totalDurationMs - a.totalDurationMs)[0] ?? null;

  return (
    <Card
      title="Device Management Report"
      style={{ marginTop: 16 }}
      extra={
        <Button onClick={onExportJson} disabled={exportDisabled}>
          Export Device Report JSON
        </Button>
      }
    >
      <div className="page-stack">
        <Alert
          type="info"
          showIcon
          message="Management explanation"
          description="Desired config is owned by backend. Android fetches config, applies policy, then reports applied state and policy-state. Compliance is displayed from desired/applied config and policy apply status."
        />

        <Row gutter={[12, 12]}>
          <Col xs={24} xl={12}>
            <Card size="small" title="Device Identity">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Device ID">
                  <Typography.Text code copyable={{ text: device.id }}>
                    {device.id}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Device Code">
                  <Typography.Text code>{device.deviceCode}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Status">{statusTag(device.status)}</Descriptions.Item>
                <Descriptions.Item label="Linked profile">
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
                    notAvailable
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Last seen">{timestamp(device.lastSeenAtEpochMillis)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title="Configuration State">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Desired config hash">{hashValue(device.desiredConfigHash)}</Descriptions.Item>
                <Descriptions.Item label="Desired version">{timestamp(device.desiredConfigVersionEpochMillis)}</Descriptions.Item>
                <Descriptions.Item label="Applied config hash">{hashValue(device.appliedConfigHash)}</Descriptions.Item>
                <Descriptions.Item label="Applied version">{timestamp(device.appliedConfigVersionEpochMillis)}</Descriptions.Item>
                <Descriptions.Item label="Policy apply status">
                  <Tag color={policyStatusColor(device.policyApplyStatus)}>
                    {String(device.policyApplyStatus || "UNKNOWN").toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Policy apply error">{textOrNA(device.policyApplyError)}</Descriptions.Item>
                <Descriptions.Item label="Policy error code">{textOrNA(device.policyApplyErrorCode)}</Descriptions.Item>
                <Descriptions.Item label="Policy applied at">{timestamp(device.lastPolicyAppliedAtEpochMillis)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} xl={12}>
            <Card size="small" title="Compliance Summary">
              <Space direction="vertical" size={8}>
                <Space wrap>
                  <Tag color={compliance.color}>{compliance.label}</Tag>
                  <Tag>{compliance.source}</Tag>
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
                <Typography.Text type="secondary">{compliance.detail}</Typography.Text>
                {compliance.source === "UI-derived" ? (
                  <Typography.Text type="secondary">
                    UI-derived display from desired/applied config and policy apply status. Backend remains source of truth.
                  </Typography.Text>
                ) : null}
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" title="Latest Runtime Data">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Latest location">
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
                    notAvailable
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Telemetry summary">
                  {telemetrySummary ? (
                    <Space wrap>
                      <Tag>types={telemetrySummary.eventCountByType.length}</Tag>
                      <Tag>categories={telemetrySummary.eventCountByCategory.length}</Tag>
                      <Tag>severities={telemetrySummary.eventCountBySeverity.length}</Tag>
                      <Tag>generated={fmtEpoch(telemetrySummary.generatedAtEpochMillis)}</Tag>
                    </Space>
                  ) : (
                    notAvailable
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Usage summary">
                  {usageSummary ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{usageItems.length} row(s)</Typography.Text>
                      <Typography.Text type="secondary">
                        top={topUsage ? `${topUsage.packageName} (${fmtDurationMs(topUsage.totalDurationMs)})` : "Not available"}
                      </Typography.Text>
                    </Space>
                  ) : (
                    notAvailable
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Recent events">
                  {newestEvent ? (
                    <Space direction="vertical" size={0}>
                      <Space wrap>
                        <Typography.Text>{events.length} event(s)</Typography.Text>
                        <Tag>{newestEvent.type}</Tag>
                        <Tag>{newestEvent.severity}</Tag>
                      </Space>
                      <Typography.Text type="secondary">{fmtEpoch(newestEvent.createdAtEpochMillis)}</Typography.Text>
                    </Space>
                  ) : (
                    notAvailable
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
