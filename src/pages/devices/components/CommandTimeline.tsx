import React, { useMemo } from "react";
import { Button, Collapse, Empty, List, Popconfirm, Space, Tag, Typography } from "antd";
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

function compactTime(label: string, value?: number | null) {
  if (!value) return null;
  return (
    <Typography.Text type="secondary">
      {label}: {fmtEpoch(value)}
    </Typography.Text>
  );
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
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText ?? t("command.empty")} />;
  }

  return (
    <div className="scroll-panel command-timeline-panel">
      <List
        loading={loading}
        dataSource={sortedCommands}
        renderItem={(command) => (
          <List.Item>
            <div className="command-item">
              <div className="command-item-top">
                <Space wrap>
                  <Typography.Text strong>{command.type}</Typography.Text>
                  <Tag color={commandStatusColor(command.status)}>{String(command.status).toUpperCase()}</Tag>
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

              <Space direction="vertical" size={0}>
                {compactTime(t("command.created"), command.createdAtEpochMillis)}
                {compactTime(t("command.expires"), command.expiresAtEpochMillis)}
                {compactTime(t("command.leased"), command.leasedAtEpochMillis)}
                {compactTime(t("command.leaseExpires"), command.leaseExpiresAtEpochMillis)}
                {compactTime(t("command.acked"), command.ackedAtEpochMillis)}
                {compactTime(t("command.cancelled"), command.cancelledAtEpochMillis)}
                {command.createdByUserId ? (
                  <Typography.Text type="secondary">Created by user: {command.createdByUserId}</Typography.Text>
                ) : null}
                {command.leaseToken ? (
                  <Typography.Text type="secondary" copyable={{ text: command.leaseToken }}>
                    leaseToken: {command.leaseToken.slice(0, 8)}...
                  </Typography.Text>
                ) : null}
              </Space>

              <Collapse
                size="small"
                ghost
                items={[
                  {
                    key: "payload",
                    label: t("command.payload"),
                    children: <pre className="json-box compact">{tryFormatJsonString(command.payload)}</pre>,
                  },
                  ...(command.output
                    ? [
                        {
                          key: "output",
                          label: t("command.output"),
                          children: <pre className="json-box compact">{tryFormatJsonString(command.output ?? "")}</pre>,
                        },
                      ]
                    : []),
                ]}
              />

              {command.cancelReason ? (
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  Cancel reason: <code>{command.cancelReason}</code>
                </Typography.Paragraph>
              ) : null}

              {command.error || command.errorCode ? (
                <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
                  {t("command.error")}: {command.error ?? "-"}
                  {command.errorCode ? ` [${command.errorCode}]` : ""}
                </Typography.Paragraph>
              ) : null}
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};
