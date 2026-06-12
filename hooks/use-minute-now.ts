import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * 返回按分钟刷新的当前时间戳，回到前台时立即刷新一次，用于倒计时等随时间变化的 UI。
 */
export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    schedule();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(Date.now());
        clearTimeout(timer);
        schedule();
      }
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return now;
}
