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
};

function isCancelable(status: string) {
  const up = String(status).toUpperCase();
  return up === "PENDING" || up === "SENT";
}

function statusExplanation(status?: string | null) {
  switch (String(status ?? "").toUpperCase()) {
    case "PENDING":
      return "Admin created the command; device has not leased it yet.";
    case "SENT":
      return "Device has polled/leased the command.";
    case "SUCCESS":
      return "Device acknowledged success.";
    case "FAILED":
      return "Device acknowledged failure or backend marked failure.";
    case "CANCELLED":
      return "Admin cancelled before final processing.";
    default:
      return "Status is not recognized by the current web display.";
  }
}

function maskToken(value: string) {
  if (value.length <= 8) return "[masked]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function timeText(value?: number | null) {
  return value ? fmtEpoch(value) : "Not available";
}

function statusTag(status?: string | null) {
  const up = String(status ?? "").toUpperCase() || "UNKNOWN";
  return (
    <Tooltip title={statusExplanation(status)}>
      <Tag color={commandStatusColor(status)}>{up}</Tag>
    </Tooltip>
  );
}

function completedAt(command: CommandView) {
  return command.ackedAtEpochMillis ?? command.cancelledAtEpochMillis ?? null;
}

function completedAtLabel(command: CommandView) {
  return command.cancelledAtEpochMillis ? "Cancelled at" : "Acked/completed at";
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
          {command.error ?? "Command error"}
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
}) => {
  const t = useT();
  const sortedCommands = useMemo(
    () => [...commands].sort((a, b) => (b.createdAtEpochMillis ?? 0) - (a.createdAtEpochMillis ?? 0)),
    [commands],
  );

  if (!loading && sortedCommands.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No commands yet" />;
  }

  return (
    <div className="scroll-panel command-timeline-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Command lifecycle: admin creates command, device polls and leases it, device acknowledges final result, backend stores status and audit/read-model side effects."
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
                    {statusTag(command.status)}
                    {command.errorCode ? <Tag color="red">{command.errorCode}</Tag> : null}
                  </Space>

                  {onCancelCommand && isCancelable(command.status) ? (
                    <Popconfirm
                      title="Cancel this command?"
                      description="Command will move to CANCELLED only if the backend accepts the transition."
                      onConfirm={() => void onCancelCommand(command)}
                      okButtonProps={{ loading: cancelBusyId === command.id }}
                    >
                      <Button size="small" danger loading={cancelBusyId === command.id}>
                        {t("common.cancel")}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </div>

                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {statusExplanation(command.status)}
                </Typography.Paragraph>

                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label={t("command.created")}>{timeText(command.createdAtEpochMillis)}</Descriptions.Item>
                  <Descriptions.Item label="Sent/leased at">{timeText(command.leasedAtEpochMillis)}</Descriptions.Item>
                  <Descriptions.Item label={completedAtLabel(command)}>{timeText(completedAt(command))}</Descriptions.Item>
                  <Descriptions.Item label={t("command.expires")}>{timeText(command.expiresAtEpochMillis)}</Descriptions.Item>
                  <Descriptions.Item label={t("command.leaseExpires")}>{timeText(command.leaseExpiresAtEpochMillis)}</Descriptions.Item>
                  {command.createdByUserId ? (
                    <Descriptions.Item label="Created by user">{command.createdByUserId}</Descriptions.Item>
                  ) : null}
                  {command.leaseToken ? (
                    <Descriptions.Item label="leaseToken">
                      <Tooltip title="Masked for security; full lease token is not shown.">
                        <Typography.Text code>{maskToken(command.leaseToken)}</Typography.Text>
                      </Tooltip>
                    </Descriptions.Item>
                  ) : null}
                  {command.cancelReason ? (
                    <Descriptions.Item label="Cancel reason">
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
