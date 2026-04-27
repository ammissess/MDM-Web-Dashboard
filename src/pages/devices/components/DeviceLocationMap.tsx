import React from "react";
import { Alert, Empty, Space, Tag, Typography } from "antd";
import type { AdminLatestLocationResponse } from "../../../types/api";
import { fmtEpoch, fmtRelativeFromNow } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  location: AdminLatestLocationResponse | null;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function buildStaticMapUrl(lat: number, lon: number) {
  const marker = `pin-s+1677ff(${lon},${lat})`;
  const zoom = 15;
  const bearing = 0;
  const pitch = 0;
  const size = "900x360";
  const style = "mapbox/streets-v12";

  return `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${lon},${lat},${zoom},${bearing},${pitch}/${size}?access_token=${MAPBOX_TOKEN}`;
}

function isFiniteCoordinate(value: number) {
  return Number.isFinite(value);
}

function isZeroZero(location: AdminLatestLocationResponse) {
  return location.latitude === 0 && location.longitude === 0;
}

function CoordinateBlock({ location }: { location: AdminLatestLocationResponse }) {
  const t = useT();
  const coordinateText = `${location.latitude}, ${location.longitude}`;

  return (
    <div className="location-coordinate-block">
      <Space wrap>
        <Tag color="blue">{t("location.latitude")} {location.latitude}</Tag>
        <Tag color="blue">{t("location.longitude")} {location.longitude}</Tag>
        <Tag>{t("location.accuracy")} {location.accuracyMeters} m</Tag>
      </Space>
      <Typography.Text type="secondary">
        {t("location.reported")}: {fmtEpoch(location.updatedAtEpochMillis)} · {fmtRelativeFromNow(location.updatedAtEpochMillis)}
      </Typography.Text>
      <Typography.Text copyable={{ text: coordinateText }}>{t("location.coordinates")}: {coordinateText}</Typography.Text>
    </div>
  );
}

const DeviceLocationPanel: React.FC<Props> = ({ location }) => {
  const t = useT();

  if (!location) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={2}>
            <Typography.Text>{t("location.noData")}</Typography.Text>
            <Typography.Text type="secondary">{t("location.noDataDesc")}</Typography.Text>
          </Space>
        }
      />
    );
  }

  const { latitude, longitude } = location;
  const invalid = !isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude);

  if (invalid) {
    return (
      <Alert
        type="warning"
        showIcon
        message={t("location.invalidPayload")}
        description={`${t("location.nonFiniteCoordinates")}: latitude=${String(latitude)}, longitude=${String(longitude)}.`}
      />
    );
  }

  const zeroZero = isZeroZero(location);

  if (zeroZero) {
    return (
      <div className="page-stack">
        <Alert type="warning" showIcon message={t("location.invalidZero")} description={t("location.invalidZeroDesc")} />
        <CoordinateBlock location={location} />
      </div>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="page-stack">
        <Alert type="info" showIcon message={t("location.noToken")} description={t("location.noTokenDesc")} />
        <CoordinateBlock location={location} />
      </div>
    );
  }

  const staticUrl = buildStaticMapUrl(latitude, longitude);

  return (
    <div className="page-stack">
      <div className="device-map-header">
        <CoordinateBlock location={location} />
      </div>

      <div className="device-static-map-shell">
        <img
          src={staticUrl}
          alt={`${t("location.deviceLocationAlt")} ${latitude}, ${longitude}`}
          className="device-static-map-image"
        />
      </div>
    </div>
  );
};


export const DeviceLocationStaticMap = DeviceLocationPanel;
export const DeviceLocationMap = DeviceLocationPanel;
