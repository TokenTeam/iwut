import { createContext, useContext, type ReactNode } from "react";

type SetScrollEnabled = (enabled: boolean) => void;

const ScrollLockContext = createContext<SetScrollEnabled>(() => {});

/**
 * 由拥有可滚动容器的页面提供 `setScrollEnabled`，
 * 让深层组件（如基于 PanResponder 的滑块）在拖动时锁定/解锁滚动，避免手势冲突。
 */
export function ScrollLockProvider({
  value,
  children,
}: {
  value: SetScrollEnabled;
  children: ReactNode;
}) {
  return (
    <ScrollLockContext.Provider value={value}>
      {children}
    </ScrollLockContext.Provider>
  );
}

/** 返回锁定/解锁外层滚动的 setter：拖动开始时传 `false`，结束时传 `true`。 */
export function useScrollLock() {
  return useContext(ScrollLockContext);
}
