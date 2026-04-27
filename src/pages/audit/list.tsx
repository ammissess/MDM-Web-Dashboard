import React, { useCallback, useState } from "react";
import { Alert, Button, Card, DatePicker, Drawer, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import dayjs from "dayjs";
import type { AuditLogItem, AuditLogListResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fmtEpoch, normalizeError, tryFormatJsonString } from "../../utils/format";
import { downloadCsv, formatDateForFileName } from "../../utils/export";
import { useT } from "../../i18n";

const auditCsvColumns = [
  { key: "id", title: "id" },
  { key: "actorType", title: "actorType" },
  { key: "actorUserId", title: "actorUserId" },
  { key: "actorDeviceCode", title: "actorDeviceCode" },
  { key: "action", title: "action" },
  { key: "targetType", title: "targetType" },
  { key: "targetId", title: "targetId" },
  { key: "payloadJson", title: "payloadJson" },
  { key: "createdAt", title: "createdAt" },
  { key: "createdAtEpochMillis", title: "createdAtEpochMillis" },
];

function toAuditCsvRows(rows: AuditLogItem[]): Record<string, unknown>[] {
  return rows.map((item) => ({
    id: item.id,
    actorType: item.actorType,
    actorUserId: item.actorUserId,
    actorDeviceCode: item.actorDeviceCode,
    action: item.action,
    targetType: item.targetType,
    targetId: item.targetId,
    payloadJson: item.payloadJson,
    createdAt: fmtEpoch(item.createdAtEpochMillis),
    createdAtEpochMillis: item.createdAtEpochMillis,
  }));
}

function actorColor(actorType: string) {
  const up = String(actorType).toUpperCase();
  if (up === "ADMIN") return "blue";
  if (up === "DEVICE") return "green";
  return "default";
}

function payloadText(value?: string | null) {
  if (!value) return "";
  return tryFormatJsonString(value);
}

function actorLabel(record: AuditLogItem) {
  return [record.actorType, record.actorUserId ? `user=${record.actorUserId}` : null, record.actorDeviceCode ? `device=${record.actorDeviceCode}` : null]
    .filter(Boolean)
    .join(" / ");
}

function targetLabel(record: AuditLogItem) {
  return [record.targetType, record.targetId].filter(Boolean).join(" / ");
}

export const AuditListPage: React.FC = () => {
  const t = useT();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [actorType, setActorType] = useState<string | undefined>();
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [fromDate, setFromDate] = useState<dayjs.Dayjs | null>(null);
  const [toDate, setToDate] = useState<dayjs.Dayjs | null>(null);
  const [payloadRecord, setPayloadRecord] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await http.get<AuditLogListResponse>("/api/admin/audit", {
        params: {
          limit: 100,
          offset: 0,
          action: actionFilter || undefined,
          actorType: actorType || undefined,
          targetType: targetType || undefined,
          targetId: targetId || undefined,
          fromEpochMillis: fromDate?.valueOf(),
          toEpochMillis: toDate?.valueOf(),
        },
      });
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(normalizeError(err, t("audit.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [actionFilter, actorType, targetType, targetId, fromDate, toDate, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useAutoRefresh(load, true, 5000, [load]);

  function exportAuditCsv() {
    downloadCsv(`mdm-activity-logs-${formatDateForFileName()}.csv`, toAuditCsvRows(items), auditCsvColumns);
  }

  async function copyPayload() {
    if (!payloadRecord?.payloadJson) return;
    try {
      await navigator.clipboard.writeText(payloadText(payloadRecord.payloadJson));
      message.success(t("audit.payloadCopied"));
    } catch {
      message.error(t("audit.payloadCopyFailed"));
    }
  }

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
            {t("audit.title")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("audit.description")}
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Button onClick={exportAuditCsv} loading={loading} disabled={loading || items.length === 0}>
            {t("audit.exportCsv")}
          </Button>
          <Input
            placeholder={t("audit.actionPlaceholder")}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder={t("audit.actorType")}
            style={{ width: 160 }}
            value={actorType}
            onChange={(value) => setActorType(value)}
            options={[
              { value: "ADMIN", label: "ADMIN" },
              { value: "DEVICE", label: "DEVICE" },
            ]}
          />
          <Input
            placeholder={t("audit.targetType")}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            style={{ width: 160 }}
          />
          <Input
            placeholder={t("audit.targetId")}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ width: 220 }}
          />
          <DatePicker
            showTime
            placeholder={t("audit.from")}
            value={fromDate}
            onChange={(value) => setFromDate(value)}
          />
          <DatePicker
            showTime
            placeholder={t("audit.to")}
            value={toDate}
            onChange={(value) => setToDate(value)}
          />
        </Space>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <Card className="audit-table-card">
        <Table<AuditLogItem>
          dataSource={items}
          rowKey="id"
          loading={loading}
          tableLayout="fixed"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("audit.noRows")} /> }}
          scroll={{ x: 1240 }}
        >
          <Table.Column<AuditLogItem>
            title={t("audit.when")}
            width={210}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{fmtEpoch(record.createdAtEpochMillis)}</Typography.Text>
                <Typography.Text type="secondary">{record.createdAtEpochMillis}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<AuditLogItem>
            title={t("audit.actor")}
            width={300}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Tag color={actorColor(record.actorType)}>{record.actorType}</Tag>
                {record.actorUserId ? <Typography.Text type="secondary">user={record.actorUserId}</Typography.Text> : null}
                {record.actorDeviceCode ? <Typography.Text type="secondary">device={record.actorDeviceCode}</Typography.Text> : null}
              </Space>
            )}
          />
          <Table.Column<AuditLogItem>
            title={t("audit.action")}
            width={210}
            ellipsis
            render={(_, record) => <Tag color="purple">{record.action}</Tag>}
          />
          <Table.Column<AuditLogItem>
            title={t("audit.target")}
            width={320}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                {record.targetType ? <Tag>{record.targetType}</Tag> : <Typography.Text type="secondary">{t("common.notAvailable")}</Typography.Text>}
                {record.targetId ? (
                  <Tooltip title={record.targetId}>
                    <Typography.Text type="secondary" ellipsis style={{ maxWidth: 280 }}>
                      {record.targetId}
                    </Typography.Text>
                  </Tooltip>
                ) : (
                  <Typography.Text type="secondary">{t("common.notAvailable")}</Typography.Text>
                )}
              </Space>
            )}
          />
          <Table.Column<AuditLogItem>
            title={t("audit.payload")}
            width={160}
            render={(_, record) => (
              record.payloadJson ? (
                <Button size="small" onClick={() => setPayloadRecord(record)}>
                  {t("audit.viewPayload")}
                </Button>
              ) : (
                <Typography.Text type="secondary">{t("audit.noPayload")}</Typography.Text>
              )
            )}
          />
        </Table>
      </Card>

      <Drawer
        title={t("audit.payloadDetails")}
        open={Boolean(payloadRecord)}
        onClose={() => setPayloadRecord(null)}
        width={640}
        className="audit-payload-drawer"
        extra={
          <Space>
            <Button onClick={copyPayload} disabled={!payloadRecord?.payloadJson}>
              {t("audit.copyJson")}
            </Button>
            <Button onClick={() => setPayloadRecord(null)}>{t("common.close")}</Button>
          </Space>
        }
      >
        {payloadRecord ? (
          <div className="page-stack">
            <Card size="small">
              <DescriptionsGrid
                rows={[
                  [t("audit.when"), fmtEpoch(payloadRecord.createdAtEpochMillis)],
                  [t("audit.actor"), actorLabel(payloadRecord) || t("common.notAvailable")],
                  [t("audit.action"), payloadRecord.action],
                  [t("audit.target"), targetLabel(payloadRecord) || t("common.notAvailable")],
                  [t("audit.targetId"), payloadRecord.targetId ?? t("common.notAvailable")],
                ]}
              />
            </Card>
            {payloadRecord.payloadJson ? (
              <pre className="json-box audit-payload-json">{payloadText(payloadRecord.payloadJson)}</pre>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("audit.noPayload")} />
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

const DescriptionsGrid: React.FC<{ rows: Array<[string, React.ReactNode]> }> = ({ rows }) => (
  <div className="audit-payload-meta-grid">
    {rows.map(([label, value]) => (
      <React.Fragment key={label}>
        <Typography.Text type="secondary">{label}</Typography.Text>
        <Typography.Text>{value}</Typography.Text>
      </React.Fragment>
    ))}
  </div>
);
