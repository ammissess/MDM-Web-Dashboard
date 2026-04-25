import React, { useCallback, useState } from "react";
import { Alert, Card, DatePicker, Input, Select, Space, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { AuditLogItem, AuditLogListResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fmtEpoch, normalizeError, tryFormatJsonString } from "../../utils/format";

export const AuditListPage: React.FC = () => {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [actorType, setActorType] = useState<string | undefined>();
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [fromDate, setFromDate] = useState<dayjs.Dayjs | null>(null);
  const [toDate, setToDate] = useState<dayjs.Dayjs | null>(null);

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
      setError(normalizeError(err, "Cannot load audit log"));
    } finally {
      setLoading(false);
    }
  }, [actionFilter, actorType, targetType, targetId, fromDate, toDate]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useAutoRefresh(load, true, 5000, [load]);

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
            Audit log
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            GET /api/admin/audit supports action, actorType, targetType, targetId, time range, limit and offset.
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Input
            placeholder="Action, e.g. CREATE_COMMAND"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder="Actor type"
            style={{ width: 160 }}
            value={actorType}
            onChange={(value) => setActorType(value)}
            options={[
              { value: "ADMIN", label: "ADMIN" },
              { value: "DEVICE", label: "DEVICE" },
            ]}
          />
          <Input
            placeholder="Target type"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            style={{ width: 160 }}
          />
          <Input
            placeholder="Target id"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ width: 220 }}
          />
          <DatePicker
            showTime
            placeholder="From"
            value={fromDate}
            onChange={(value) => setFromDate(value)}
          />
          <DatePicker
            showTime
            placeholder="To"
            value={toDate}
            onChange={(value) => setToDate(value)}
          />
        </Space>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <Card>
        <Table<AuditLogItem>
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        >
          <Table.Column<AuditLogItem>
            title="When"
            render={(_, record) => fmtEpoch(record.createdAtEpochMillis)}
          />
          <Table.Column<AuditLogItem>
            title="Actor"
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Tag>{record.actorType}</Tag>
                {record.actorUserId ? <Typography.Text type="secondary">user={record.actorUserId}</Typography.Text> : null}
                {record.actorDeviceCode ? <Typography.Text type="secondary">device={record.actorDeviceCode}</Typography.Text> : null}
              </Space>
            )}
          />
          <Table.Column<AuditLogItem> title="Action" dataIndex="action" />
          <Table.Column<AuditLogItem>
            title="Target"
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{record.targetType ?? "-"}</Typography.Text>
                <Typography.Text type="secondary">{record.targetId ?? "-"}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<AuditLogItem>
            title="Payload"
            render={(_, record) => (
              <Typography.Paragraph style={{ marginBottom: 0 }} copyable={{ text: record.payloadJson ?? "" }}>
                <pre className="json-box compact">{tryFormatJsonString(record.payloadJson)}</pre>
              </Typography.Paragraph>
            )}
          />
        </Table>
      </Card>
    </div>
  );
};