import { useLayoutEffect, useRef } from "react";

/** 返回稳定的 ref，并在布局阶段同步到最新值，供长期存活的事件回调读取。 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
