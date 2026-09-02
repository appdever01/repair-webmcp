import Alert02Icon from "@iconjar/icons/Alert02Icon";
import CheckmarkCircle02Icon from "@iconjar/icons/CheckmarkCircle02Icon";
import Copy01Icon from "@iconjar/icons/Copy01Icon";
import ElectricPlugsIcon from "@iconjar/icons/ElectricPlugsIcon";
import Exchange01Icon from "@iconjar/icons/Exchange01Icon";
import GaugeIcon from "@iconjar/icons/GaugeIcon";
import HistoryIcon from "@iconjar/icons/HistoryIcon";
import MoreVerticalIcon from "@iconjar/icons/MoreVerticalIcon";
import Recycle03Icon from "@iconjar/icons/Recycle03Icon";
import RefreshCcwIcon from "@iconjar/icons/RefreshCcwIcon";
import RepairToolIcon from "@iconjar/icons/RepairIcon";
import type { IconSvgElement } from "@iconjar/icons/react";
import SearchVisualIcon from "@iconjar/icons/SearchVisualIcon";
import UndoIcon from "@iconjar/icons/UndoIcon";

export const ICONJAR_ICONS = {
  check: CheckmarkCircle02Icon,
  compare: Exchange01Icon,
  copy: Copy01Icon,
  history: HistoryIcon,
  inspect: SearchVisualIcon,
  isolate: ElectricPlugsIcon,
  measure: GaugeIcon,
  more: MoreVerticalIcon,
  repair: RepairToolIcon,
  reset: RefreshCcwIcon,
  reuse: Recycle03Icon,
  undo: UndoIcon,
  warning: Alert02Icon,
} as const satisfies Record<string, IconSvgElement>;
