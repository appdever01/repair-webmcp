import { HugeiconsIcon } from "@iconjar/icons/react";
import { ICONJAR_ICONS } from "./iconjar-icons";

export type RepairIconName = keyof typeof ICONJAR_ICONS;
export const REPAIR_ICON_NAMES = Object.keys(ICONJAR_ICONS) as RepairIconName[];

export function RepairIcon({
  name,
  size = 20,
  className,
}: {
  name: RepairIconName;
  size?: number;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      aria-hidden
      className={className}
      icon={ICONJAR_ICONS[name]}
      size={size}
      strokeWidth={1.5}
    />
  );
}
