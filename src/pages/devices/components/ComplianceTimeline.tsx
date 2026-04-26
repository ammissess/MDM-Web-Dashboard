import React from "react";
import { Alert, Card, Space, Tag, Timeline, Typography } from "antd";
import type { CommandView, DeviceDetailResponse } from "../../../types/api";
import { commandStatusColor, fmtEpoch, policyStatusColor } from "../../../utils/format";

type Props = {
  device: DeviceDetailResponse;
  commands: CommandView[];
};

type StepStatus = "Done" | "Pending" | "Failed" | "Unknown";

type TimelineStep = {
  title: string;
  status: StepStatus;
  description: React.ReactNode;
  timestamp?: number | null;
  timestampLabel?: string;
};

const syncCommandTypes = new Set(["refresh_config", "sync_config"]);

function statusColor(status: StepStatus) {
  switch (status) {
    case "Done":
      return "green";
    case "Pending":
      return "gold";
    case "Failed":
      return "red";
    default:
      return "default";
  }
}

function timelineColor(status: StepStatus) {
  switch (status) {
    case "Done":
      return "green";
    case "Pending":
      return "orange";
    case "Failed":
      return "red";
    default:
      return "gray";
  }
}

function shortHash(value?: string | null) {
  if (!value) return "Not available";
  return value.length <= 18 ? value : `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function latestSyncCommand(commands: CommandView[]) {
  return [...commands]
    .filter((command) => syncCommandTypes.has(String(command.type)))
    .sort((a, b) => (b.createdAtEpochMillis ?? 0) - (a.createdAtEpochMillis ?? 0))[0] ?? null;
}

function commandStatus(command: CommandView | null) {
  return String(command?.status ?? "").toUpperCase();
}

function hasPolicyFailure(device: DeviceDetailResponse) {
  return (
    String(device.policyApplyStatus ?? "").toUpperCase() === "FAILED" ||
    Boolean(device.policyApplyError || device.policyApplyErrorCode)
  );
}

function buildComplianceStatus(device: DeviceDetailResponse): { status: StepStatus; source: string; detail: string } {
  if (hasPolicyFailure(device)) {
    return {
      status: "Failed",
      source: device.complianceSummary ? "Backend" : "UI-derived",
      detail: "Policy apply failure or policy error is present.",
    };
  }

  if (device.complianceSummary?.isCompliant === true) {
    return {
      status: "Done",
      source: "Backend",
      detail: "Backend compliance summary reports compliant.",
    };
  }

  if (device.complianceSummary?.isCompliant === false) {
    return {
      status: "Pending",
      source: "Backend",
      detail: "Backend compliance summary reports non-compliant.",
    };
  }

  if (!device.desiredConfigHash && !device.appliedConfigHash) {
    return {
      status: "Unknown",
      source: "UI-derived",
      detail: "Desired/applied config data is not available.",
    };
  }

  if (!device.appliedConfigHash || device.desiredConfigHash !== device.appliedConfigHash) {
    return {
      status: "Pending",
      source: "UI-derived",
      detail: "Desired and applied config do not match yet.",
    };
  }

  if (String(device.policyApplyStatus ?? "").toUpperCase() === "SUCCESS") {
    return {
      status: "Done",
      source: "UI-derived",
      detail: "Desired/applied config match and policy apply status is SUCCESS.",
    };
  }

  return {
    status: "Unknown",
    source: "UI-derived",
    detail: "Policy apply status is not enough to classify compliance.",
  };
}

function buildSteps(device: DeviceDetailResponse, commands: CommandView[]): TimelineStep[] {
  const syncCommand = latestSyncCommand(commands);
  const syncStatus = commandStatus(syncCommand);
  const policyStatus = String(device.policyApplyStatus ?? "").toUpperCase();
  const compliance = buildComplianceStatus(device);

  const desiredStatus: StepStatus =
    device.desiredConfigHash || device.desiredConfigVersionEpochMillis ? "Done" : "Unknown";

  const triggerStatus: StepStatus = syncCommand ? "Done" : "Unknown";

  let leaseStatus: StepStatus = "Unknown";
  if (syncCommand) {
    if (syncStatus === "PENDING") {
      leaseStatus = "Pending";
    } else if (syncCommand.leasedAtEpochMillis || syncCommand.ackedAtEpochMillis || syncStatus === "SENT") {
      leaseStatus = "Done";
    }
  }

  let ackStatus: StepStatus = "Unknown";
  if (syncCommand) {
    if (syncStatus === "PENDING" || syncStatus === "SENT") {
      ackStatus = "Pending";
    } else if (syncStatus === "SUCCESS") {
      ackStatus = "Done";
    } else if (syncStatus === "FAILED" || syncStatus === "CANCELLED" || syncStatus === "EXPIRED") {
      ackStatus = "Failed";
    }
  }

  let applyStatus: StepStatus = "Unknown";
  if (hasPolicyFailure(device)) {
    applyStatus = "Failed";
  } else if (policyStatus === "SUCCESS") {
    applyStatus = "Done";
  } else if (policyStatus === "PENDING" || policyStatus === "PARTIAL") {
    applyStatus = "Pending";
  }

  let appliedStateStatus: StepStatus = "Unknown";
  if (hasPolicyFailure(device)) {
    appliedStateStatus = "Failed";
  } else if (device.appliedConfigHash || device.appliedConfigVersionEpochMillis) {
    appliedStateStatus = "Done";
  } else if (device.desiredConfigHash || device.desiredConfigVersionEpochMillis) {
    appliedStateStatus = "Pending";
  }

  return [
    {
      title: "Backend desired config",
      status: desiredStatus,
      timestamp: device.desiredConfigVersionEpochMillis,
      timestampLabel: "Desired version",
      description: (
        <Space direction="vertical" size={2}>
          <Typography.Text>Source: Backend-owned</Typography.Text>
          <Typography.Text type="secondary">desiredConfigHash: {shortHash(device.desiredConfigHash)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Refresh/sync trigger",
      status: triggerStatus,
      timestamp: syncCommand?.createdAtEpochMillis,
      timestampLabel: "Command created",
      description: syncCommand ? (
        <Space direction="vertical" size={2}>
          <Space wrap>
            <Tag>{syncCommand.type}</Tag>
            <Tag color={commandStatusColor(syncCommand.status)}>{syncStatus || "UNKNOWN"}</Tag>
          </Space>
          <Typography.Text type="secondary">Command id: {syncCommand.id}</Typography.Text>
        </Space>
      ) : (
        <Typography.Text type="secondary">No refresh_config or sync_config command in current command list.</Typography.Text>
      ),
    },
    {
      title: "Device poll / command lease",
      status: leaseStatus,
      timestamp: syncCommand?.leasedAtEpochMillis,
      timestampLabel: "Leased at",
      description: syncCommand ? (
        <Typography.Text type="secondary">
          {syncCommand.leasedAtEpochMillis
            ? `Lease token expires at ${fmtEpoch(syncCommand.leaseExpiresAtEpochMillis)}.`
            : syncStatus === "SENT"
              ? "Command status is SENT. No separate sent timestamp exists in the current web contract."
              : syncStatus === "PENDING"
                ? "Waiting for device poll/lease."
                : "No lease timestamp is available in current command data."}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">Command data is not available.</Typography.Text>
      ),
    },
    {
      title: "Device ack final status",
      status: ackStatus,
      timestamp: syncCommand?.ackedAtEpochMillis ?? syncCommand?.cancelledAtEpochMillis,
      timestampLabel: syncCommand?.cancelledAtEpochMillis ? "Cancelled at" : "Acked at",
      description: syncCommand ? (
        <Space direction="vertical" size={2}>
          <Tag color={commandStatusColor(syncCommand.status)}>{syncStatus || "UNKNOWN"}</Tag>
          {syncCommand.error || syncCommand.errorCode ? (
            <Typography.Text type="secondary">
              {syncCommand.error ?? "Command error"}
              {syncCommand.errorCode ? ` [${syncCommand.errorCode}]` : ""}
            </Typography.Text>
          ) : null}
        </Space>
      ) : (
        <Typography.Text type="secondary">Command final status is not available.</Typography.Text>
      ),
    },
    {
      title: "Android apply policy",
      status: applyStatus,
      timestamp: device.lastPolicyAppliedAtEpochMillis,
      timestampLabel: "Policy applied at",
      description: (
        <Space direction="vertical" size={2}>
          <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatus || "UNKNOWN"}</Tag>
          {device.policyApplyError || device.policyApplyErrorCode ? (
            <Typography.Text type="secondary">
              {device.policyApplyError ?? "Policy apply error"}
              {device.policyApplyErrorCode ? ` [${device.policyApplyErrorCode}]` : ""}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Android reported applied state",
      status: appliedStateStatus,
      timestamp: device.appliedConfigVersionEpochMillis,
      timestampLabel: "Applied version",
      description: (
        <Space direction="vertical" size={2}>
          <Typography.Text>Source: Android-reported</Typography.Text>
          <Typography.Text type="secondary">appliedConfigHash: {shortHash(device.appliedConfigHash)}</Typography.Text>
          <Typography.Text type="secondary">policyApplyStatus: {policyStatus || "Unknown"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Dashboard compliance display",
      status: compliance.status,
      description: (
        <Space direction="vertical" size={2}>
          <Space wrap>
            <Tag>{compliance.source}</Tag>
            {device.healthSummary?.isOnline != null ? (
              <Tag color={device.healthSummary.isOnline ? "green" : "red"}>
                online={String(device.healthSummary.isOnline)}
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
      ),
    },
  ];
}

export const ComplianceTimeline: React.FC<Props> = ({ device, commands }) => {
  const steps = buildSteps(device, commands);

  return (
    <Card title="Policy / Compliance Timeline" style={{ marginTop: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Timeline is built from current admin read data. Missing timestamps are shown as Unknown rather than inferred."
        />

        <Timeline
          items={steps.map((step) => ({
            color: timelineColor(step.status),
            children: (
              <Space direction="vertical" size={4}>
                <Space wrap>
                  <Typography.Text strong>{step.title}</Typography.Text>
                  <Tag color={statusColor(step.status)}>{step.status}</Tag>
                </Space>
                {step.description}
                <Typography.Text type="secondary">
                  {step.timestampLabel ?? "Timestamp"}: {step.timestamp ? fmtEpoch(step.timestamp) : "Unknown"}
                </Typography.Text>
              </Space>
            ),
          }))}
        />
      </Space>
    </Card>
  );
};
