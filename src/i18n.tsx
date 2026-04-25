import React, { createContext, useContext, useMemo, useState } from "react";

export type LanguageCode = "en" | "vi";

const STORAGE_KEY = "mdm.dashboard.language";

const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en: {
    "app.language": "Language",
    "app.english": "English",
    "app.vietnamese": "Vietnamese",
    "app.subtitle": "MDM Control System",
    "common.loading": "Loading...",
    "common.updating": "Updating...",
    "common.updated": "Updated",
    "common.lastUpdated": "Last updated",
    "common.noData": "No data",
    "common.empty": "empty",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.link": "Link",
    "common.unlinkProfile": "Unlink profile",
    "common.profile": "Profile",
    "common.status": "Status",
    "common.device": "Device",
    "dashboard.title": "MDM Operations Dashboard",
    "dashboard.subtitle": "Devices, compliance, command delivery, profile state, and telemetry health from the current backend contract.",
    "dashboard.devices": "Devices",
    "dashboard.active": "Active",
    "dashboard.locked": "Locked",
    "dashboard.profiles": "Profiles",
    "dashboard.recentlyPolled": "Recently polled",
    "dashboard.outOfSync": "Desired != applied",
    "dashboard.nonCompliant": "Non-compliant",
    "dashboard.wakeupIssues": "Wake-up issues",
    "dashboard.recentDevices": "Recent devices needing attention",
    "dashboard.audit": "Recent audit",
    "dashboard.observability": "Operations health snapshot",
    "dashboard.deliveryHealth": "Wake-up / delivery health",
    "dashboard.complianceOverview": "Compliance overview",
    "dashboard.noDevices": "No devices",
    "dashboard.noAudit": "No audit rows",
    "device.currentProfile": "Current linked profile",
    "device.desiredApplied": "Desired vs applied",
    "device.backendOwned": "Desired config is backend-owned. Android applies it through refresh_config / sync_config / poll, then reports policy-state.",
    "device.noProfile": "This device is not linked to any profile.",
    "device.profileIdentity": "Profile identity",
    "device.corePolicy": "Core policy",
    "device.securityHardening": "Security hardening",
    "device.allowedApps": "Allowed apps",
    "device.allowedAppsCompact": "Allowed apps",
    "device.appInventory": "App inventory",
    "device.events": "Recent device events",
    "device.location": "Location",
    "device.commandLifecycle": "Command lifecycle",
    "device.statusCommandActions": "Status vs command actions",
    "quick.profileLink": "Profile link",
    "quick.backendStatus": "Backend status actions",
    "quick.commandDelivery": "Device command delivery",
    "quick.backendStatusDesc": "These controls update backend/device status flows. They do not create a lock_screen command row.",
    "quick.commandDesc": "Commands are delivered through poll/lease/ack. Only lock_screen, refresh_config, and sync_config are valid command types.",
    "quick.setLocked": "Set backend status LOCKED",
    "quick.unlock": "Unlock by password",
    "quick.resetUnlock": "Reset unlock password",
    "quick.sendCommand": "Send command",
    "quick.sendLockScreen": "Send lock_screen command to device",
    "quick.sendRefresh": "Send refresh_config command",
    "quick.sendSync": "Send sync_config command",
    "command.empty": "No command lifecycle rows yet.",
    "command.created": "Created",
    "command.expires": "Expires",
    "command.leased": "Leased",
    "command.leaseExpires": "Lease expires",
    "command.acked": "Acked",
    "command.cancelled": "Cancelled",
    "command.payload": "Payload",
    "command.output": "Output",
    "command.error": "Error",
    "location.noData": "No valid location reported yet",
    "location.noDataDesc": "The dashboard only reads the latest backend location. Android must report a valid location first.",
    "location.invalidZero": "Location looks invalid or fallback-only",
    "location.invalidZeroDesc": "Coordinates are 0,0. Treat this as invalid unless your device is actually at Null Island.",
    "location.noToken": "Mapbox token is missing",
    "location.noTokenDesc": "Coordinates are shown below. Set VITE_MAPBOX_TOKEN only if you want the static map preview.",
    "location.reported": "Reported",
  },
  vi: {
    "app.language": "Ngôn ngữ",
    "app.english": "Tiếng Anh",
    "app.vietnamese": "Tiếng Việt",
    "app.subtitle": "Hệ thống điều khiển MDM",
    "common.loading": "Đang tải...",
    "common.updating": "Đang cập nhật...",
    "common.updated": "Đã cập nhật",
    "common.lastUpdated": "Cập nhật lần cuối",
    "common.noData": "Không có dữ liệu",
    "common.empty": "trống",
    "common.save": "Lưu",
    "common.cancel": "Hủy",
    "common.link": "Liên kết",
    "common.unlinkProfile": "Gỡ profile",
    "common.profile": "Profile",
    "common.status": "Trạng thái",
    "common.device": "Thiết bị",
    "dashboard.title": "MDM Operations Dashboard",
    "dashboard.subtitle": "Theo dõi thiết bị, compliance, command delivery, profile state và telemetry health theo backend contract hiện tại.",
    "dashboard.devices": "Thiết bị",
    "dashboard.active": "Đang hoạt động",
    "dashboard.locked": "Đã khóa",
    "dashboard.profiles": "Profiles",
    "dashboard.recentlyPolled": "Mới poll gần đây",
    "dashboard.outOfSync": "Desired != applied",
    "dashboard.nonCompliant": "Chưa compliant",
    "dashboard.wakeupIssues": "Vấn đề wake-up",
    "dashboard.recentDevices": "Thiết bị cần chú ý",
    "dashboard.audit": "Audit gần đây",
    "dashboard.observability": "Tổng quan vận hành",
    "dashboard.deliveryHealth": "Tình trạng wake-up / delivery",
    "dashboard.complianceOverview": "Tổng quan compliance",
    "dashboard.noDevices": "Chưa có thiết bị",
    "dashboard.noAudit": "Chưa có audit",
    "device.currentProfile": "Profile đang liên kết",
    "device.desiredApplied": "Desired vs applied",
    "device.backendOwned": "Desired config thuộc backend. Android áp dụng qua refresh_config / sync_config / poll rồi report policy-state.",
    "device.noProfile": "Thiết bị này chưa liên kết profile.",
    "device.profileIdentity": "Thông tin profile",
    "device.corePolicy": "Policy chính",
    "device.securityHardening": "Bảo mật / hardening",
    "device.allowedApps": "Ứng dụng được phép",
    "device.allowedAppsCompact": "Allowed apps",
    "device.appInventory": "Danh sách app",
    "device.events": "Sự kiện thiết bị gần đây",
    "device.location": "Vị trí",
    "device.commandLifecycle": "Vòng đời command",
    "device.statusCommandActions": "Status và command",
    "quick.profileLink": "Liên kết profile",
    "quick.backendStatus": "Thao tác trạng thái backend",
    "quick.commandDelivery": "Gửi command tới thiết bị",
    "quick.backendStatusDesc": "Các nút này cập nhật flow trạng thái backend/device. Chúng không tạo command lock_screen.",
    "quick.commandDesc": "Command đi qua poll/lease/ack. Chỉ có lock_screen, refresh_config và sync_config là hợp lệ.",
    "quick.setLocked": "Set backend status LOCKED",
    "quick.unlock": "Mở khóa bằng mật khẩu",
    "quick.resetUnlock": "Đặt lại mật khẩu mở khóa",
    "quick.sendCommand": "Gửi command",
    "quick.sendLockScreen": "Gửi lock_screen command tới thiết bị",
    "quick.sendRefresh": "Gửi refresh_config command",
    "quick.sendSync": "Gửi sync_config command",
    "command.empty": "Chưa có dòng command lifecycle.",
    "command.created": "Tạo lúc",
    "command.expires": "Hết hạn",
    "command.leased": "Lease lúc",
    "command.leaseExpires": "Lease hết hạn",
    "command.acked": "Ack lúc",
    "command.cancelled": "Hủy lúc",
    "command.payload": "Payload",
    "command.output": "Output",
    "command.error": "Lỗi",
    "location.noData": "Chưa có vị trí hợp lệ",
    "location.noDataDesc": "Dashboard chỉ đọc latest location từ backend. Android phải report vị trí hợp lệ trước.",
    "location.invalidZero": "Vị trí có vẻ không hợp lệ hoặc là fallback",
    "location.invalidZeroDesc": "Tọa độ đang là 0,0. Chỉ coi là hợp lệ nếu thiết bị thật sự ở Null Island.",
    "location.noToken": "Thiếu Mapbox token",
    "location.noTokenDesc": "Vẫn hiển thị tọa độ bên dưới. Chỉ cần VITE_MAPBOX_TOKEN nếu muốn xem ảnh map tĩnh.",
    "location.reported": "Report lúc",
  },
};

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (value: LanguageCode) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "vi") return stored;
  } catch {
    // ignored
  }
  return "en";
}

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: LanguageCode) => {
      setLanguageState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignored
      }
    };

    const t = (key: string) => dictionaries[language][key] ?? dictionaries.en[key] ?? key;

    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export function useT() {
  return useLanguage().t;
}
