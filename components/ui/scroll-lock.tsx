import { createContext, useContext, type ReactNode } from "react";

type ScrollLockController = {
  acquire: () => void;
  release: () => void;
};

const noop = () => {};

const ScrollLockContext = createContext<ScrollLockController>({
  acquire: noop,
  release: noop,
});

/**
 * 由拥有可滚动容器的页面提供滚动锁。
 * 深层组件可在拖动开始/结束时 acquire/release，避免手势冲突。
 */
export function ScrollLockProvider({
  value,
  children,
}: {
  value: ScrollLockController;
  children: ReactNode;
}) {
  return (
    <ScrollLockContext.Provider value={value}>
      {children}
    </ScrollLockContext.Provider>
  );
}

/** 返回外层滚动锁：拖动开始时 acquire，结束或取消时 release。 */
export function useScrollLock() {
  return useContext(ScrollLockContext);
}
