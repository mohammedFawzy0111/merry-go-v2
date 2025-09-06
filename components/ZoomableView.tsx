import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import React, { useCallback } from "react";
import { Dimensions, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2;

type Props = {
  children: React.ReactNode;
  onZoomChange?: (zoomed: boolean) => void;
  onSingleTap?: () => void;
};

export function ZoomableView({ children, onZoomChange, onSingleTap }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const fx = useSharedValue(W / 2);
  const fy = useSharedValue(H / 2);

  const notifyZoom = useCallback((z: boolean) => onZoomChange?.(z), [onZoomChange]);

  const clampT = () => {
    "worklet";
    const boundX = (W * (scale.value - 1)) / 2;
    const boundY = (H * (scale.value - 1)) / 2;
    tx.value = Math.max(-boundX, Math.min(boundX, tx.value));
    ty.value = Math.max(-boundY, Math.min(boundY, ty.value));
  };

  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      savedScale.value = scale.value;
      fx.value = e.focalX || W / 2;
      fy.value = e.focalY || H / 2;
    })
    .onUpdate((e) => {
      fx.value = e.focalX || W / 2;
      fy.value = e.focalY || H / 2;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
      const wasZoomed = scale.value > 1.01;
      scale.value = next;
      if (!wasZoomed && next > 1.01) runOnJS(notifyZoom)(true);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        runOnJS(notifyZoom)(false);
      } else {
        clampT();
      }
    });

  const pan = Gesture.Pan()
    .enabled(() => scale.value > 1.01)
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
      clampT();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.value > 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        runOnJS(notifyZoom)(false);
      } else {
        fx.value = e.x || W / 2;
        fy.value = e.y || H / 2;
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        runOnJS(notifyZoom)(true);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      onSingleTap && runOnJS(onSingleTap)();
    });

  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gestures = Gesture.Simultaneous(pinch, pan, taps);

  const style = useAnimatedStyle(() => {
    if (scale.value <= 1.001) {
      return { transform: [{ scale: 1 }] }; // disable focal transforms at 1x
    }
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { translateX: fx.value },
        { translateY: fy.value },
        { scale: scale.value },
        { translateX: -fx.value },
        { translateY: -fy.value },
      ],
    };
  });

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}