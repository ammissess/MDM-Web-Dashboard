import React from "react";
import { Badge } from "antd";
import { onlineStateFromLastSeen } from "../../../utils/format";

type Props = {
  isOnline?: boolean | null;
  lastSeenAtEpochMillis?: number | null;
};

export const LiveStatusBadge: React.FC<Props> = ({ isOnline, lastSeenAtEpochMillis }) => {
  const state =
    typeof isOnline === "boolean"
      ? (isOnline ? "online" : "offline")
      : onlineStateFromLastSeen(lastSeenAtEpochMillis);

  if (state === "online") return <Badge status="success" text="online" />;
  if (state === "offline") return <Badge status="error" text="offline" />;
  return <Badge status="default" text="unknown" />;
};