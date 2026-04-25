import { DependencyList, useEffect, useRef } from "react";

type UseAutoRefreshOptions = {
  pauseWhenHidden?: boolean;
  refreshOnVisible?: boolean;
};

export function useAutoRefresh(
  callback: () => void | Promise<void>,
  enabled: boolean,
  intervalMs: number,
  deps: DependencyList = [],
  options: UseAutoRefreshOptions = {},
) {
  const saved = useRef(callback);
  const running = useRef(false);
  const cancelled = useRef(false);
  const { pauseWhenHidden = true, refreshOnVisible = true } = options;

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    cancelled.current = false;

    const tick = async () => {
      if (running.current || cancelled.current) return;
      if (pauseWhenHidden && typeof document !== "undefined" && document.hidden) return;

      running.current = true;
      try {
        await saved.current();
      } finally {
        running.current = false;
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (!refreshOnVisible) return;
      if (document.hidden) return;
      void tick();
    };

    if (pauseWhenHidden && refreshOnVisible && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      cancelled.current = true;
      window.clearInterval(id);
      if (pauseWhenHidden && refreshOnVisible && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, pauseWhenHidden, refreshOnVisible, ...deps]);
}
