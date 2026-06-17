import PagerView, {
  type PagerViewOnPageScrollEventData,
} from "react-native-pager-view";
import Animated, {
  type SharedValue,
  useEvent,
  useHandler,
  useSharedValue,
} from "react-native-reanimated";

export const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

/**
 * 在 UI 线程消费 PagerView 的 onPageScroll，返回一个表示当前页位置
 * 的 shared value，用于驱动分段指示器/下划线。
 */
export function usePagerPosition(initialPage = 0) {
  const position = useSharedValue(initialPage);
  const handlers = {
    onPageScroll: (event: PagerViewOnPageScrollEventData) => {
      "worklet";
      position.value = event.position + event.offset;
    },
  };
  const { doDependenciesDiffer } = useHandler(handlers, []);
  const handler = useEvent<PagerViewOnPageScrollEventData>(
    (event) => {
      "worklet";
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith("onPageScroll")) {
        onPageScroll(event);
      }
    },
    ["onPageScroll"],
    doDependenciesDiffer,
  );
  return { position, handler } as {
    position: SharedValue<number>;
    handler: typeof handler;
  };
}
