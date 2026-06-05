import { useObserve } from "expo-observe";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

export function useMarkRouteInteractive(ready = true) {
  const { markInteractive } = useObserve();
  const hasMarkedInteractive = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!ready || hasMarkedInteractive.current) return;
      hasMarkedInteractive.current = true;
      markInteractive();
    }, [markInteractive, ready]),
  );
}
