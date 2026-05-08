import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Empty, Input, Select, Tag, Typography } from "antd";
import type { AdminDeviceAppView, AdminDeviceAppsResponse, DeviceResponse } from "../../../types/api";
import { http } from "../../../providers/axios";
import { fmtEpoch, normalizeError } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  value?: string[];
  onChange?: (value: string[]) => void;
  inventorySources?: DeviceResponse[];
  linkedUserCode?: string | null;
};

function normalizePackages(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function formatSourceLabel(device: DeviceResponse, t: (key: string) => string) {
  const parts = [device.deviceCode];
  if (device.userCode) parts.push(`${t("profiles.userCode")}: ${device.userCode}`);
  if (device.model) parts.push(device.model);
  return parts.join(" - ");
}

function formatInventoryOption(item: AdminDeviceAppView) {
  if (!item.appName || item.appName === item.packageName) {
    return item.packageName;
  }
  return `${item.appName} - ${item.packageName}`;
}

export const AllowedAppsEditor: React.FC<Props> = ({ value, onChange, inventorySources, linkedUserCode }) => {
  const t = useT();
  const [input, setInput] = useState("");
  const [inventoryDeviceId, setInventoryDeviceId] = useState<string>();
  const [inventoryItems, setInventoryItems] = useState<AdminDeviceAppView[]>([]);
  const [inventorySelection, setInventorySelection] = useState<string[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [launchableOnly, setLaunchableOnly] = useState(true);

  const apps = useMemo(() => normalizePackages(value ?? []), [value]);
  const showInventoryPicker = inventorySources !== undefined;

  const sortedSources = useMemo(() => {
    return [...(inventorySources ?? [])].sort((a, b) => {
      const aLinked = linkedUserCode && a.userCode === linkedUserCode ? 1 : 0;
      const bLinked = linkedUserCode && b.userCode === linkedUserCode ? 1 : 0;
      if (aLinked !== bLinked) return bLinked - aLinked;
      return b.lastSeenAtEpochMillis - a.lastSeenAtEpochMillis;
    });
  }, [inventorySources, linkedUserCode]);

  const linkedSources = useMemo(() => {
    if (!linkedUserCode) return [];
    return sortedSources.filter((device) => device.userCode === linkedUserCode);
  }, [linkedUserCode, sortedSources]);

  const selectedSource = useMemo(
    () => sortedSources.find((device) => device.id === inventoryDeviceId) ?? null,
    [inventoryDeviceId, sortedSources],
  );

  const launchableCount = useMemo(
    () => inventoryItems.filter((item) => item.hasLauncherActivity === true).length,
    [inventoryItems],
  );

  const inventoryOptions = useMemo(() => {
    return inventoryItems
      .filter((item) => !launchableOnly || item.hasLauncherActivity === true)
      .map((item) => ({
        label: formatInventoryOption(item),
        value: item.packageName,
        disabled: apps.includes(item.packageName),
        searchLabel: `${item.appName ?? ""} ${item.packageName}`.trim().toLowerCase(),
      }));
  }, [apps, inventoryItems, launchableOnly]);

  useEffect(() => {
    if (!sortedSources.length) {
      setInventoryDeviceId(undefined);
      return;
    }

    if (inventoryDeviceId && sortedSources.some((device) => device.id === inventoryDeviceId)) {
      return;
    }

    setInventoryDeviceId((linkedSources[0] ?? sortedSources[0])?.id);
  }, [inventoryDeviceId, linkedSources, sortedSources]);

  useEffect(() => {
    if (!inventoryDeviceId) {
      setInventoryItems([]);
      setInventorySelection([]);
      setInventoryError(null);
      return;
    }

    let active = true;
    setInventoryLoading(true);
    setInventoryError(null);

    void http
      .get<AdminDeviceAppsResponse>(`/api/admin/devices/${inventoryDeviceId}/apps`)
      .then(({ data }) => {
        if (!active) return;
        const items = data.items ?? [];
        setInventoryItems(items);
        setInventorySelection((prev) => prev.filter((pkg) => items.some((item) => item.packageName === pkg)));
      })
      .catch((error) => {
        if (!active) return;
        setInventoryItems([]);
        setInventorySelection([]);
        setInventoryError(normalizeError(error, t("profiles.appInventoryLoadFailed")));
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inventoryDeviceId, t]);

  function addOne(raw: string) {
    const pkg = raw.trim();
    if (!pkg) return;
    onChange?.(normalizePackages([...apps, pkg]));
    setInput("");
  }

  function addSelectedInventory() {
    if (!inventorySelection.length) return;
    onChange?.(normalizePackages([...apps, ...inventorySelection]));
    setInventorySelection([]);
  }

  function remove(pkg: string) {
    onChange?.(apps.filter((item) => item !== pkg));
  }

  return (
    <div className="profile-apps-editor">
      <Typography.Paragraph type="secondary" className="profile-helper-text">
        {t("profiles.allowedAppsHelp")}
      </Typography.Paragraph>

      <div className="profile-apps-manual-row">
        <Input
          placeholder={t("profiles.packageNamePlaceholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => addOne(input)}
        />
        <Button onClick={() => addOne(input)}>{t("profiles.addPackage")}</Button>
      </div>

      <div className="profile-app-tags profile-apps-current">
        {apps.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("profiles.noAllowedApps")} />
        ) : (
          apps.map((pkg) => (
            <Tag key={pkg} closable onClose={() => remove(pkg)}>
              {pkg}
            </Tag>
          ))
        )}
      </div>

      {showInventoryPicker ? (
        <div className="profile-inventory-card">
          <div className="profile-inventory-header">
            <div>
              <Typography.Text strong>{t("profiles.importFromInventory")}</Typography.Text>
              <Typography.Paragraph type="secondary" className="profile-helper-text">
                {t("profiles.inventoryHelp")}
              </Typography.Paragraph>
            </div>
            <Typography.Text type="secondary" className="profile-inventory-api-note">
              <code>GET /api/admin/devices/{`{id}`}/apps</code>
            </Typography.Text>
          </div>

          {sortedSources.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("profiles.noInventorySources")} />
          ) : (
            <div className="profile-inventory-body">
              <Select
                value={inventoryDeviceId}
                onChange={setInventoryDeviceId}
                className="profile-inventory-select"
                options={sortedSources.map((device) => ({
                  label: formatSourceLabel(device, t),
                  value: device.id,
                }))}
                placeholder={t("profiles.chooseInventorySource")}
              />

              <div className="profile-inventory-meta">
                <Checkbox checked={launchableOnly} onChange={(event) => setLaunchableOnly(event.target.checked)}>
                  {t("profiles.launchableOnly")}
                </Checkbox>
                {selectedSource ? (
                  <Tag
                    className="profile-inventory-tag"
                    color={linkedSources.some((device) => device.id === selectedSource.id) ? "blue" : "default"}
                  >
                    {t("profiles.sourceLabel")}: {selectedSource.deviceCode}
                  </Tag>
                ) : null}
                {selectedSource?.userCode ? (
                  <Tag className="profile-inventory-tag">
                    {t("profiles.userCode")}: {selectedSource.userCode}
                  </Tag>
                ) : null}
                {inventoryItems.length > 0 ? (
                  <Tag className="profile-inventory-tag">
                    {inventoryItems.length} {t("profiles.appsLabel")} / {launchableCount}{" "}
                    {t("profiles.launchableLabel")} / {t("profiles.seenLabel")}{" "}
                    {fmtEpoch(selectedSource?.lastSeenAtEpochMillis)}
                  </Tag>
                ) : null}
              </div>

              {inventoryError ? <Alert type="warning" showIcon message={inventoryError} /> : null}

              <div className="profile-inventory-import-row">
                <Select
                  mode="multiple"
                  value={inventorySelection}
                  onChange={setInventorySelection}
                  className="profile-inventory-package-select"
                  placeholder={inventoryLoading ? t("profiles.loadingInventory") : t("profiles.searchInventoryPlaceholder")}
                  options={inventoryOptions}
                  loading={inventoryLoading}
                  maxTagCount="responsive"
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    `${String(option?.label ?? "")} ${String((option as { searchLabel?: string } | undefined)?.searchLabel ?? "")}`
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  notFoundContent={
                    inventoryLoading
                      ? t("profiles.loadingInventory")
                      : launchableOnly
                        ? t("profiles.noMatchingLaunchableApps")
                        : t("profiles.noMatchingApps")
                  }
                />

                <Button onClick={addSelectedInventory} disabled={inventorySelection.length === 0}>
                  {t("profiles.addSelectedPackages")}
                </Button>
              </div>

              {!inventoryLoading && selectedSource && inventoryItems.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("profiles.noInventoryData")} />
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
