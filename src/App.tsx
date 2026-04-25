import React from "react";
import { Refine, Authenticated } from "@refinedev/core";
import { ErrorComponent, RefineThemes, ThemedLayoutV2, ThemedSiderV2 } from "@refinedev/antd";
import routerBindings, { DocumentTitleHandler, UnsavedChangesNotifier } from "@refinedev/react-router-v6";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ConfigProvider, Segmented, Space, Typography } from "antd";

import { authProvider } from "./providers/authProvider";
import { dataProvider } from "./providers/dataProvider";
import { LanguageProvider, useLanguage } from "./i18n";

import { DashboardPage } from "./pages/dashboard";
import { DeviceListPage } from "./pages/devices/list";
import { DeviceShowPage } from "./pages/devices/show";
import { AuditListPage } from "./pages/audit/list";
import { LoginPage } from "./pages/login";
import { ProfileCreatePage } from "./pages/profiles/create";
import { ProfileEditPage } from "./pages/profiles/edit";
import { ProfileListPage } from "./pages/profiles/list";
import { ProfileShowPage } from "./pages/profiles/show";

const DashboardHeader: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="app-header">
      <div>
        <Typography.Text strong>MDM Dashboard</Typography.Text>
        <Typography.Text type="secondary" className="app-header-subtitle">
          {t("app.subtitle")}
        </Typography.Text>
      </div>

      <Space>
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
      </Space>
    </div>
  );
};

const AppLayout: React.FC = () => (
  <ThemedLayoutV2 Sider={() => <ThemedSiderV2 fixed />} Header={() => <DashboardHeader />}>
    <Outlet />
  </ThemedLayoutV2>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <LanguageProvider>
          <Refine
            routerProvider={routerBindings}
            authProvider={authProvider}
            dataProvider={dataProvider}
            resources={[
              { name: "dashboard", list: "/", meta: { label: "Dashboard" } },
              { name: "devices", list: "/devices", show: "/devices/show/:id", meta: { label: "Devices" } },
              {
                name: "profiles",
                list: "/profiles",
                create: "/profiles/create",
                edit: "/profiles/edit/:id",
                show: "/profiles/show/:id",
                meta: { label: "Profiles" },
              },
              { name: "audit", list: "/audit", meta: { label: "Audit" } },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: false,
              projectId: "mdm-dashboard-redesign",
            }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <Authenticated key="protected-routes" fallback={<Navigate to="/login" replace />}>
                    <AppLayout />
                  </Authenticated>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/devices">
                  <Route index element={<DeviceListPage />} />
                  <Route path="show/:id" element={<DeviceShowPage />} />
                </Route>
                <Route path="/profiles">
                  <Route index element={<ProfileListPage />} />
                  <Route path="create" element={<ProfileCreatePage />} />
                  <Route path="edit/:id" element={<ProfileEditPage />} />
                  <Route path="show/:id" element={<ProfileShowPage />} />
                </Route>
                <Route path="/audit" element={<AuditListPage />} />
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>

            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </LanguageProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
};
