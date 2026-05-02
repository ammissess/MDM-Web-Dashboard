import React, { useMemo } from "react";
import { Alert, Button, Collapse, Descriptions, Empty, List, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import type { CommandView } from "../../../types/api";
import { commandStatusColor, fmtEpoch, tryFormatJsonString } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  commands: CommandView[];
  loading?: boolean;
  emptyText?: string;
  onCancelCommand?: (command: CommandView) => Promise<void> | void;
  cancelBusyId?: string | null;
  actionsBlocked?: boolean;
  blockedReason?: string;
  onBlockedAction?: () => void;
};

function isCancelable(status: string) {
  const up = String(status).toUpperCase();
  return up === "PENDING" || up === "SENT";
}

function statusExplanation(status: string | null | undefined, t: (key: string) => string) {
  switch (String(status ?? "").toUpperCase()) {
    case "PENDING":
      return t("command.statusPendingHelp");
    case "SENT":
      return t("command.statusSentHelp");
    case "SUCCESS":
      return t("command.statusSuccessHelp");
    case "FAILED":
      return t("command.statusFailedHelp");
    case "CANCELLED":
      return t("command.statusCancelledHelp");
    default:
      return t("command.statusUnknownHelp");
  }
}

function maskToken(value: string) {
  if (value.length <= 8) return "[masked]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function timeText(value: number | null | undefined, t: (key: string) => string) {
  return value ? fmtEpoch(value) : t("common.notAvailable");
}

function statusTag(status: string | null | undefined, t: (key: string) => string) {
  const up = String(status ?? "").toUpperCase() || "UNKNOWN";
  return (
    <Tooltip title={statusExplanation(status, t)}>
      <Tag color={commandStatusColor(status)}>{up}</Tag>
    </Tooltip>
  );
}

function completedAt(command: CommandView) {
  return command.ackedAtEpochMillis ?? command.cancelledAtEpochMillis ?? null;
}

function completedAtLabel(command: CommandView, t: (key: string) => string) {
  return command.cancelledAtEpochMillis ? t("command.cancelledAt") : t("command.ackedCompletedAt");
}

function collapseItems(command: CommandView, t: (key: string) => string) {
  const items = [];

  if (command.payload) {
    items.push({
      key: "payload",
      label: t("command.payload"),
      children: <pre className="json-box compact">{tryFormatJsonString(command.payload)}</pre>,
    });
  }

  if (command.output) {
    items.push({
      key: "output",
      label: t("command.output"),
      children: <pre className="json-box compact">{tryFormatJsonString(command.output)}</pre>,
    });
  }

  if (command.error || command.errorCode) {
    items.push({
      key: "error",
      label: t("command.error"),
      children: (
        <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
          {command.error ?? t("command.errorFallback")}
          {command.errorCode ? ` [${command.errorCode}]` : ""}
        </Typography.Paragraph>
      ),
    });
  }

  return items;
}

export const CommandTimeline: React.FC<Props> = ({
  commands,
  loading,
  emptyText,
  onCancelCommand,
  cancelBusyId,
  actionsBlocked,
  blockedReason,
  onBlockedAction,
}) => {
  const t = useT();
  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => (b.createdAtEpochMillis ?? 0) - (a.createdAtEpochMillis ?? 0)),
    [commands],
  );

  if (!loading && sortedCommands.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("command.empty")} />;
  }

  return (
    <div className="scroll-panel command-timeline-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={t("command.lifecycleDescription")}
      />
      <List
        loading={loading}
        dataSource={sortedCommands}
        renderItem={(command) => {
          const details = collapseItems(command, t);

          return (
            <List.Item>
              <div className="command-item">
                <div className="command-item-top">
                  <Space wrap>
                    <Typography.Text strong>{command.type}</Typography.Text>
                    {statusTag(command.status, t)}
                    {command.errorCode ? <Tag color="red">{command.errorCode}</Tag> : null}
                  </Space>

                  {onCancelCommand && isCancelable(command.status) ? (
                    actionsBlocked ? (
                      <Tooltip title={blockedReason}>
                        <Button
                          size="small"
                          className="soft-disabled-action"
                          aria-disabled
                          loading={cancelBusyId === command.id}
                          onClick={() => onBlockedAction?.()}
                        >
                          {t("common.cancel")}
                        </Button>
                      </Tooltip>
                    ) : (
                      <Popconfirm
                        title={t("command.cancelConfirmTitle")}
                        description={t("command.cancelConfirmDescription")}
                        onConfirm={() => void onCancelCommand(command)}
                        okButtonProps={{ loading: cancelBusyId === command.id }}
                      >
                        <Button size="small" danger loading={cancelBusyId === command.id}>
                          {t("common.cancel")}
                        </Button>
                      </Popconfirm>
                    )
                  ) : null}
                </div>

                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {statusExplanation(command.status, t)}
                </Typography.Paragraph>

                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label={t("command.created")}>{timeText(command.createdAtEpochMillis, t)}</Descriptions.Item>
                  <Descriptions.Item label={t("command.sentLeasedAt")}>{timeText(command.leasedAtEpochMillis, t)}</Descriptions.Item>
                  <Descriptions.Item label={completedAtLabel(command, t)}>{timeText(completedAt(command), t)}</Descriptions.Item>
                  <Descriptions.Item label={t("command.expires")}>{timeText(command.expiresAtEpochMillis, t)}</Descriptions.Item>
                  <Descriptions.Item label={t("command.leaseExpires")}>{timeText(command.leaseExpiresAtEpochMillis, t)}</Descriptions.Item>
                  {command.createdByUserId ? (
                    <Descriptions.Item label={t("command.createdByUser")}>{command.createdByUserId}</Descriptions.Item>
                  ) : null}
                  {command.leaseToken ? (
                    <Descriptions.Item label="leaseToken">
                      <Tooltip title={t("command.leaseTokenMasked")}>
                        <Typography.Text code>{maskToken(command.leaseToken)}</Typography.Text>
                      </Tooltip>
                    </Descriptions.Item>
                  ) : null}
                  {command.cancelReason ? (
                    <Descriptions.Item label={t("command.cancelReason")}>
                      <code>{command.cancelReason}</code>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>

                {details.length > 0 ? <Collapse size="small" ghost items={details} /> : null}
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
};
