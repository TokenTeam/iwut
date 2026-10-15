import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStartupStore } from "@/store/startup";

const RENDER_WAIT_MS = 2000;

void SplashScreen.preventAutoHideAsync().catch(() => {});

export function useStartup({
  assetsReady,
  routeReady,
  inTabs,
  needsOnboarding,
}: {
  assetsReady: boolean;
  routeReady: boolean;
  inTabs: boolean;
  needsOnboarding: boolean;
}) {
  const [rootLaidOut, setRootLaidOut] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [released, setReleased] = useState(false);
  const hiding = useRef(false);
  const tabsReady = useStartupStore(
    (state) => state.homeReady && state.courseReady,
  );
  const onRootLayout = useCallback(() => setRootLaidOut(true), []);

  useEffect(() => {
    if (!assetsReady || !inTabs || needsOnboarding) return;
    const startup = useStartupStore.getState();
    if (startup.tabsRequested) return;
    startup.requestTabs();
    router.prefetch("/course");
    router.prefetch("/");
  }, [assetsReady, inTabs, needsOnboarding]);

  useEffect(() => {
    if (!rootLaidOut || released) return;
    // 隐藏页未能完成布局时也要释放启动屏
    const timer = setTimeout(() => setTimedOut(true), RENDER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [released, rootLaidOut]);

  const canRelease =
    timedOut || (routeReady && (!inTabs || (!needsOnboarding && tabsReady)));

  useEffect(() => {
    if (!assetsReady || !rootLaidOut || !canRelease || released) return;
    let secondFrame: number | undefined;
    // 就绪信号之后留出绘制帧，避免启动屏下露出未完成的画面
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (hiding.current) return;
        hiding.current = true;
        if (__DEV__) {
          console.info("[Startup] splash released", { tabsReady, timedOut });
        }
        void SplashScreen.hideAsync()
          .catch(() => {})
          .finally(() => setReleased(true));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [assetsReady, canRelease, released, rootLaidOut, tabsReady, timedOut]);

  return onRootLayout;
}
