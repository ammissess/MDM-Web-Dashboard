import React from "react";
import { Alert, Card, Space, Tag, Timeline, Typography } from "antd";
import type { CommandView, DeviceDetailResponse } from "../../../types/api";
import { commandStatusColor, fmtEpoch, policyStatusColor } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  device: DeviceDetailResponse;
  commands: CommandView[];
};

type StepStatus = "Done" | "Pending" | "Failed" | "Unknown";

type TimelineStep = {
  titleKey: string;
  status: StepStatus;
  description: React.ReactNode;
  timestamp?: number | null;
  timestampLabelKey?: string;
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

function shortHash(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return t("common.notAvailable");
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

function buildComplianceStatus(device: DeviceDetailResponse): { status: StepStatus; sourceKey: string; detailKey: string; uiDerived: boolean } {
  if (hasPolicyFailure(device)) {
    return {
      status: "Failed",
      sourceKey: device.complianceSummary ? "common.backend" : "common.uiDerived",
      detailKey: "report.compliance.policyFailure",
      uiDerived: !device.complianceSummary,
    };
  }

  if (device.complianceSummary?.isCompliant === true) {
    return {
      status: "Done",
      sourceKey: "common.backend",
      detailKey: "timeline.backendCompliant",
      uiDerived: false,
    };
  }

  if (device.complianceSummary?.isCompliant === false) {
    return {
      status: "Pending",
      sourceKey: "common.backend",
      detailKey: "report.compliance.backendNonCompliant",
      uiDerived: false,
    };
  }

  if (!device.desiredConfigHash && !device.appliedConfigHash) {
    return {
      status: "Unknown",
      sourceKey: "common.uiDerived",
      detailKey: "report.compliance.noDesiredApplied",
      uiDerived: true,
    };
  }

  if (!device.appliedConfigHash || device.desiredConfigHash !== device.appliedConfigHash) {
    return {
      status: "Pending",
      sourceKey: "common.uiDerived",
      detailKey: "timeline.desiredAppliedMismatch",
      uiDerived: true,
    };
  }

  if (String(device.policyApplyStatus ?? "").toUpperCase() === "SUCCESS") {
    return {
      status: "Done",
      sourceKey: "common.uiDerived",
      detailKey: "report.compliance.uiCompliant",
      uiDerived: true,
    };
  }

  return {
    status: "Unknown",
    sourceKey: "common.uiDerived",
    detailKey: "report.compliance.notEnoughData",
    uiDerived: true,
  };
}

function buildSteps(device: DeviceDetailResponse, commands: CommandView[], t: (key: string) => string): TimelineStep[] {
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
      titleKey: "timeline.backendDesiredConfig",
      status: desiredStatus,
      timestamp: device.desiredConfigVersionEpochMillis,
      timestampLabelKey: "timeline.desiredVersion",
      description: (
        <Space direction="vertical" size={2}>
          <Typography.Text>{t("timeline.sourceBackendOwned")}</Typography.Text>
          <Typography.Text type="secondary">desiredConfigHash: {shortHash(device.desiredConfigHash, t)}</Typography.Text>
        </Space>
      ),
    },
    {
      titleKey: "timeline.refreshSyncTrigger",
      status: triggerStatus,
      timestamp: syncCommand?.createdAtEpochMillis,
      timestampLabelKey: "timeline.commandCreated",
      description: syncCommand ? (
        <Space direction="vertical" size={2}>
          <Space wrap>
            <Tag>{syncCommand.type}</Tag>
            <Tag color={commandStatusColor(syncCommand.status)}>{syncStatus || "UNKNOWN"}</Tag>
          </Space>
          <Typography.Text type="secondary">{t("timeline.commandId")}: {syncCommand.id}</Typography.Text>
        </Space>
      ) : (
        <Typography.Text type="secondary">{t("timeline.noSyncCommand")}</Typography.Text>
      ),
    },
    {
      titleKey: "timeline.devicePollLease",
      status: leaseStatus,
      timestamp: syncCommand?.leasedAtEpochMillis,
      timestampLabelKey: "timeline.leasedAt",
      description: syncCommand ? (
        <Typography.Text type="secondary">
          {syncCommand.leasedAtEpochMillis
            ? `${t("timeline.leaseTokenExpiresAt")} ${fmtEpoch(syncCommand.leaseExpiresAtEpochMillis)}.`
            : syncStatus === "SENT"
              ? t("timeline.sentNoTimestamp")
              : syncStatus === "PENDING"
                ? t("timeline.waitingPollLease")
                : t("timeline.noLeaseTimestamp")}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">{t("timeline.commandDataUnavailable")}</Typography.Text>
      ),
    },
    {
      titleKey: "timeline.deviceAckFinalStatus",
      status: ackStatus,
      timestamp: syncCommand?.ackedAtEpochMillis ?? syncCommand?.cancelledAtEpochMillis,
      timestampLabelKey: syncCommand?.cancelledAtEpochMillis ? "command.cancelledAt" : "command.acked",
      description: syncCommand ? (
        <Space direction="vertical" size={2}>
          <Tag color={commandStatusColor(syncCommand.status)}>{syncStatus || "UNKNOWN"}</Tag>
          {syncCommand.error || syncCommand.errorCode ? (
            <Typography.Text type="secondary">
              {syncCommand.error ?? t("command.errorFallback")}
              {syncCommand.errorCode ? ` [${syncCommand.errorCode}]` : ""}
            </Typography.Text>
          ) : null}
        </Space>
      ) : (
        <Typography.Text type="secondary">{t("timeline.commandFinalUnavailable")}</Typography.Text>
      ),
    },
    {
      titleKey: "timeline.androidApplyPolicy",
      status: applyStatus,
      timestamp: device.lastPolicyAppliedAtEpochMillis,
      timestampLabelKey: "report.policyAppliedAt",
      description: (
        <Space direction="vertical" size={2}>
          <Tag color={policyStatusColor(device.policyApplyStatus)}>{policyStatus || "UNKNOWN"}</Tag>
          {device.policyApplyError || device.policyApplyErrorCode ? (
            <Typography.Text type="secondary">
              {device.policyApplyError ?? t("timeline.policyApplyError")}
              {device.policyApplyErrorCode ? ` [${device.policyApplyErrorCode}]` : ""}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      titleKey: "timeline.androidReportedAppliedState",
      status: appliedStateStatus,
      timestamp: device.appliedConfigVersionEpochMillis,
      timestampLabelKey: "timeline.appliedVersion",
      description: (
        <Space direction="vertical" size={2}>
          <Typography.Text>{t("timeline.sourceAndroidReported")}</Typography.Text>
          <Typography.Text type="secondary">{t("timeline.androidReportedAppliedStateDetail")}</Typography.Text>
          <Typography.Text type="secondary">appliedConfigHash: {shortHash(device.appliedConfigHash, t)}</Typography.Text>
          <Typography.Text type="secondary">policyApplyStatus: {policyStatus || t("common.unknown")}</Typography.Text>
        </Space>
      ),
    },
    {
      titleKey: "timeline.dashboardComplianceDisplay",
      status: compliance.status,
      description: (
        <Space direction="vertical" size={2}>
          <Space wrap>
            <Tag>{t(compliance.sourceKey)}</Tag>
            {device.healthSummary?.isOnline != null ? (
              <Tag color={device.healthSummary.isOnline ? "green" : "red"}>
                online={String(device.healthSummary.isOnline)}
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
      ),
    },
  ];
}

export const ComplianceTimeline: React.FC<Props> = ({ device, commands }) => {
  const t = useT();
  const steps = buildSteps(device, commands, t);

  return (
    <Card title={t("timeline.title")} style={{ marginTop: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message={t("timeline.reflectsCurrentData")}
        />

        <Timeline
          items={steps.map((step) => ({
            color: timelineColor(step.status),
            children: (
              <Space direction="vertical" size={4}>
                <Space wrap>
                  <Typography.Text strong>{t(step.titleKey)}</Typography.Text>
                  <Tag color={statusColor(step.status)}>{t(`common.${step.status.toLowerCase()}`)}</Tag>
                </Space>
                {step.description}
                <Typography.Text type="secondary">
                  {step.timestampLabelKey ? t(step.timestampLabelKey) : t("timeline.timestamp")}: {step.timestamp ? fmtEpoch(step.timestamp) : t("common.unknown")}
                </Typography.Text>
              </Space>
            ),
          }))}
        />
      </Space>
    </Card>
  );
};
