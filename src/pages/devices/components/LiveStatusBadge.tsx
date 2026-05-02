import React from "react";
import { Badge } from "antd";
import { onlineStateFromLastSeen } from "../../../utils/format";
import { useT } from "../../../i18n";

type Props = {
  isOnline?: boolean | null;
  lastSeenAtEpochMillis?: number | null;
};

export const LiveStatusBadge: React.FC<Props> = ({ isOnline, lastSeenAtEpochMillis }) => {
  const t = useT();
  const state =
    typeof isOnline === "boolean"
      ? (isOnline ? "online" : "offline")
      : onlineStateFromLastSeen(lastSeenAtEpochMillis);

  if (state === "online") return <Badge status="success" text={t("common.online")} />;
  if (state === "offline") return <Badge status="warning" text={t("common.offline")} />;
  if (state === "lost_contact") return <Badge status="default" text={t("common.lostContact")} />;
  return <Badge status="default" text={t("common.unknown")} />;
};
