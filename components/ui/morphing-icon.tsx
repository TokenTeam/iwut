import { MorphIcon, type IconInput } from "morphicons/react-native";
import type { ComponentProps } from "react";

type Props = Omit<
  ComponentProps<typeof MorphIcon>,
  "icon" | "reducedMotion" | "spring"
> & {
  icon: IconInput;
};

export function MorphingIcon({ icon, ...props }: Readonly<Props>) {
  return (
    <MorphIcon {...props} icon={icon} spring="snappy" reducedMotion="user" />
  );
}
