import React from "react";
import { useLogin } from "@refinedev/core";
import { Button, Card, Form, Input, Segmented, Space, Typography } from "antd";
import { useLanguage } from "../../i18n";

export const LoginPage: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { mutate: login, isLoading } = useLogin();

  return (
    <div className="login-page">
      <div className="login-language-switch">
        <Typography.Text type="secondary">{t("app.language")}</Typography.Text>
        <Segmented
          size="small"
          value={language}
          options={[
            { label: "EN", value: "en" },
            { label: "VI", value: "vi" },
          ]}
          onChange={(value) => setLanguage(value as "en" | "vi")}
        />
      </div>

      <Card className="login-card">
        <div className="login-brand">
          <div className="login-brand-mark">MDM</div>
          <div>
            <Typography.Text strong>{t("app.productName")}</Typography.Text>
            <Typography.Text type="secondary">{t("app.subtitle")}</Typography.Text>
          </div>
        </div>

        <div className="login-copy">
          <Typography.Title level={3}>{t("login.title")}</Typography.Title>
          <Typography.Paragraph type="secondary">{t("login.subtitle")}</Typography.Paragraph>
        </div>

        <Form
          className="login-form"
          layout="vertical"
          onFinish={(values) =>
            login({
              ...values,
              errorName: t("login.errorTitle"),
              loginFailedMessage: t("login.failed"),
              forbiddenMessage: t("login.forbidden"),
              noTokenMessage: t("login.noToken"),
            })
          }
        >
          <Form.Item
            label={t("login.username")}
            name="username"
            rules={[{ required: true, message: t("login.usernameRequired") }]}
          >
            <Input autoFocus placeholder={t("login.usernamePlaceholder")} />
          </Form.Item>

          <Form.Item
            label={t("login.password")}
            name="password"
            rules={[{ required: true, message: t("login.passwordRequired") }]}
          >
            <Input.Password placeholder={t("login.passwordPlaceholder")} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={isLoading} block>
            {t("login.submit")}
          </Button>
        </Form>

        <Space className="login-help-text">
          <Typography.Text type="secondary">{t("login.help")}</Typography.Text>
        </Space>
      </Card>
    </div>
  );
};
