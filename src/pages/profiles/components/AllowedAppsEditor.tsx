import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Select, Space, Tag, Typography } from "antd";
import type { AdminDeviceAppView, AdminDeviceAppsResponse, DeviceResponse } from "../../../types/api";
import { http } from "../../../providers/axios";
import { fmtRelativeFromNow, normalizeError } from "../../../utils/format";

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

function formatSourceLabel(device: DeviceResponse) {
  const parts = [device.deviceCode];
  if (device.userCode) parts.push(`userCode=${device.userCode}`);
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
        setInventoryError(normalizeError(error, "Cannot load app inventory"));
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inventoryDeviceId]);

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
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Each packageName is one app allowed to run in kiosk mode, for example <code>com.android.chrome</code>.
      </Typography.Paragraph>

      {showInventoryPicker ? (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>Import packages from device inventory</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Inventory only comes from <code>GET /api/admin/devices/{`{id}`}/apps</code>. Choose one source device, then
            add multiple packages into the current allowedApps list.
          </Typography.Paragraph>

          {sortedSources.length === 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="No device is available for inventory import yet. Manual package entry still works."
            />
          ) : (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Select
                value={inventoryDeviceId}
                onChange={setInventoryDeviceId}
                style={{ width: "100%" }}
                options={sortedSources.map((device) => ({
                  label: formatSourceLabel(device),
                  value: device.id,
                }))}
                placeholder="Choose a device inventory source"
              />

              <Space wrap>
                <Checkbox checked={launchableOnly} onChange={(event) => setLaunchableOnly(event.target.checked)}>
                  Launchable only
                </Checkbox>
                {selectedSource ? (
                  <Tag color={linkedSources.some((device) => device.id === selectedSource.id) ? "blue" : "default"}>
                    source={selectedSource.deviceCode}
                  </Tag>
                ) : null}
                {selectedSource?.userCode ? <Tag>userCode={selectedSource.userCode}</Tag> : null}
                {inventoryItems.length > 0 ? (
                  <Tag>
                    {inventoryItems.length} apps / {launchableCount} launchable / seen{" "}
                    {fmtRelativeFromNow(selectedSource?.lastSeenAtEpochMillis)}
                  </Tag>
                ) : null}
              </Space>

              {inventoryError ? <Alert type="warning" showIcon message={inventoryError} /> : null}

              <Select
                mode="multiple"
                value={inventorySelection}
                onChange={setInventorySelection}
                style={{ width: "100%" }}
                placeholder={inventoryLoading ? "Loading inventory..." : "Search appName or packageName from inventory"}
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
                    ? "Loading inventory..."
                    : launchableOnly
                      ? "No matching launchable apps"
                      : "No matching apps"
                }
              />

              <Button onClick={addSelectedInventory} disabled={inventorySelection.length === 0}>
                Add selected packages
              </Button>
            </Space>
          )}
        </div>
      ) : null}

      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder="com.example.app"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => addOne(input)}
        />
        <Button onClick={() => addOne(input)}>Add</Button>
      </Space.Compact>

      <div className="allowed-app-scroll" style={{ marginTop: 12 }}>
        {apps.length === 0 ? <Tag>empty</Tag> : null}
        {apps.map((pkg) => (
          <Tag key={pkg} closable onClose={() => remove(pkg)}>
            {pkg}
          </Tag>
        ))}
      </div>
    </div>
  );
};