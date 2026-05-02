import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Input, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import type { ProfileResponse } from "../../types/api";
import { http } from "../../providers/axios";
import { fmtEpoch, normalizeError } from "../../utils/format";
import { useT } from "../../i18n";

export const ProfileListPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await http.get<ProfileResponse[]>("/api/admin/profiles");
      setProfiles(data ?? []);
      setError(null);
    } catch (err) {
      setError(normalizeError(err, t("profiles.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteProfile(id: string) {
    try {
      await http.delete(`/api/admin/profiles/${id}`);
      message.success(t("profiles.deleted"));
      await load();
    } catch (err) {
      message.error(normalizeError(err, t("profiles.deleteFailed")));
    }
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((item) =>
      item.userCode.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
    );
  }, [keyword, profiles]);

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
            {t("profiles.title")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("profiles.description")}
          </Typography.Paragraph>
        </div>

        <Space>
          <Input
            placeholder={t("profiles.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
          />
          <Button type="primary" onClick={() => navigate("/profiles/create")}>
            {t("profiles.create")}
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <Card>
        <Table<ProfileResponse>
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        >
          <Table.Column<ProfileResponse>
            title={t("profiles.profileColumn")}
            render={(_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text code>{record.userCode}</Typography.Text>
                <Typography.Text>{record.name}</Typography.Text>
              </Space>
            )}
          />
          <Table.Column<ProfileResponse>
            title="Allowed Apps"
            render={(_, record) => <Tag>{record.allowedApps.length}</Tag>}
          />
          <Table.Column<ProfileResponse>
            title="Kiosk"
            render={(_, record) => <Tag color={record.kioskMode ? "green" : "default"}>{record.kioskMode ? "ON" : "OFF"}</Tag>}
          />
          <Table.Column<ProfileResponse>
            title="StatusBar"
            render={(_, record) => <Tag color={record.disableStatusBar ? "red" : "green"}>{record.disableStatusBar ? "DISABLED" : "ENABLED"}</Tag>}
          />
          <Table.Column<ProfileResponse>
            title="Updated"
            render={(_, record) => fmtEpoch(record.updatedAtEpochMillis)}
          />
          <Table.Column<ProfileResponse>
            title="Actions"
            render={(_, record) => (
              <Space>
                <Link to={`/profiles/show/${record.id}`}>
                  <Button size="small">Open</Button>
                </Link>
                <Link to={`/profiles/edit/${record.id}`}>
                  <Button size="small">Edit</Button>
                </Link>
                <Popconfirm title={t("profiles.deleteConfirm")} onConfirm={() => void deleteProfile(record.id)}>
                  <Button size="small" danger>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            )}
          />
        </Table>
      </Card>
    </div>
  );
};
