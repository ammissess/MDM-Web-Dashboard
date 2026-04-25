import React from "react";
import { useLogin } from "@refinedev/core";
import { Button, Card, Form, Input, Typography } from "antd";

export const LoginPage: React.FC = () => {
  const { mutate: login, isLoading } = useLogin();

  return (
    <div className="login-shell">
      <Card className="login-card">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          MDM Dashboard Login
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Đăng nhập bằng tài khoản <b>ADMIN</b> đã seed ở backend.
        </Typography.Paragraph>

        <Form
          layout="vertical"
          initialValues={{ username: "admin", password: "admin123" }}
          onFinish={(values) => login(values)}
        >
          <Form.Item label="Username" name="username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>

          <Form.Item label="Password" name="password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={isLoading} block>
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
};