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
    <div className="page-stack profile-list-page">
      <div className="profile-list-header">
        <div className="profile-list-header-copy">
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
            {t("profiles.title")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("profiles.description")}
          </Typography.Paragraph>
        </div>

        <Space className="profile-list-actions" wrap>
          <Input
            className="profile-list-search"
            placeholder={t("profiles.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button type="primary" onClick={() => navigate("/profiles/create")}>
            {t("profiles.create")}
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <Card className="profile-list-card">
        <Table<ProfileResponse>
          className="profile-list-table"
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          scroll={{ x: 1040 }}
        >
          <Table.Column<ProfileResponse>
            title={t("profiles.profileColumn")}
            width={330}
            render={(_, record) => (
              <div className="profile-list-profile-cell">
                <Tag className="profile-list-code-tag">{record.userCode}</Tag>
                <Typography.Text strong className="profile-list-name">
                  {record.name}
                </Typography.Text>
                {record.description ? (
                  <Typography.Paragraph
                    className="profile-list-description"
                    type="secondary"
                    ellipsis={{ rows: 1, tooltip: record.description }}
                  >
                    {record.description}
                  </Typography.Paragraph>
                ) : null}
              </div>
            )}
          />
          <Table.Column<ProfileResponse>
            title={t("profiles.allowedAppsColumn")}
            width={150}
            render={(_, record) => (
              <Tag className="profile-list-count-tag" color={record.allowedApps.length > 0 ? "blue" : "default"}>
                {record.allowedApps.length}
              </Tag>
            )}
          />
          <Table.Column<ProfileResponse>
            title={t("profiles.kioskColumn")}
            width={120}
            render={(_, record) => (
              <Tag color={record.kioskMode ? "green" : "default"}>{record.kioskMode ? t("profiles.on") : t("profiles.off")}</Tag>
            )}
          />
          <Table.Column<ProfileResponse>
            title={t("profiles.statusBarColumn")}
            width={140}
            render={(_, record) => (
              <Tag color={record.disableStatusBar ? "orange" : "green"}>
                {record.disableStatusBar ? t("profiles.disabled") : t("profiles.enabled")}
              </Tag>
            )}
          />
          <Table.Column<ProfileResponse>
            title={t("profiles.updatedColumn")}
            width={170}
            render={(_, record) => fmtEpoch(record.updatedAtEpochMillis)}
          />
          <Table.Column<ProfileResponse>
            title={t("profiles.actionsColumn")}
            width={230}
            render={(_, record) => (
              <Space className="profile-actions" size={8} wrap>
                <Link to={`/profiles/show/${record.id}`}>
                  <Button size="small">{t("profiles.openAction")}</Button>
                </Link>
                <Link to={`/profiles/edit/${record.id}`}>
                  <Button size="small">{t("profiles.editAction")}</Button>
                </Link>
                <Popconfirm title={t("profiles.deleteConfirm")} onConfirm={() => void deleteProfile(record.id)}>
                  <Button size="small" danger>
                    {t("profiles.deleteAction")}
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
