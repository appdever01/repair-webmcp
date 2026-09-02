import Activity02Icon from "@iconjar/icons/Activity02Icon";
import AiBrowserIcon from "@iconjar/icons/AiBrowserIcon";
import Alert02Icon from "@iconjar/icons/Alert02Icon";
import ArrowLeft01Icon from "@iconjar/icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@iconjar/icons/ArrowRight01Icon";
import Camera01Icon from "@iconjar/icons/Camera01Icon";
import CheckmarkCircle02Icon from "@iconjar/icons/CheckmarkCircle02Icon";
import Copy01Icon from "@iconjar/icons/Copy01Icon";
import CubeIcon from "@iconjar/icons/CubeIcon";
import Delete02Icon from "@iconjar/icons/Delete02Icon";
import Edit02Icon from "@iconjar/icons/Edit02Icon";
import ElectricPlugsIcon from "@iconjar/icons/ElectricPlugsIcon";
import Exchange01Icon from "@iconjar/icons/Exchange01Icon";
import GaugeIcon from "@iconjar/icons/GaugeIcon";
import HistoryIcon from "@iconjar/icons/HistoryIcon";
import ImageUploadIcon from "@iconjar/icons/ImageUploadIcon";
import InformationCircleIcon from "@iconjar/icons/InformationCircleIcon";
import MoreVerticalIcon from "@iconjar/icons/MoreVerticalIcon";
import PlayIcon from "@iconjar/icons/PlayIcon";
import Recycle03Icon from "@iconjar/icons/Recycle03Icon";
import RefreshCcwIcon from "@iconjar/icons/RefreshCcwIcon";
import RepairToolIcon from "@iconjar/icons/RepairIcon";
import RotateThreeDIcon from "@iconjar/icons/RotateThreeDIcon";
import type { IconSvgElement } from "@iconjar/icons/react";
import SearchVisualIcon from "@iconjar/icons/SearchVisualIcon";
import ShieldCheckIcon from "@iconjar/icons/ShieldCheckIcon";
import StopCircleIcon from "@iconjar/icons/StopCircleIcon";
import UndoIcon from "@iconjar/icons/UndoIcon";
import ZoomInIcon from "@iconjar/icons/ZoomInIcon";
import ZoomOutIcon from "@iconjar/icons/ZoomOutIcon";

export const ICONJAR_ICONS = {
  activity: Activity02Icon,
  agent: AiBrowserIcon,
  back: ArrowLeft01Icon,
  camera: Camera01Icon,
  check: CheckmarkCircle02Icon,
  compare: Exchange01Icon,
  copy: Copy01Icon,
  cube: CubeIcon,
  delete: Delete02Icon,
  edit: Edit02Icon,
  forward: ArrowRight01Icon,
  history: HistoryIcon,
  info: InformationCircleIcon,
  inspect: SearchVisualIcon,
  isolate: ElectricPlugsIcon,
  measure: GaugeIcon,
  more: MoreVerticalIcon,
  play: PlayIcon,
  repair: RepairToolIcon,
  reset: RefreshCcwIcon,
  rotate: RotateThreeDIcon,
  reuse: Recycle03Icon,
  shield: ShieldCheckIcon,
  stop: StopCircleIcon,
  undo: UndoIcon,
  upload: ImageUploadIcon,
  warning: Alert02Icon,
  zoomIn: ZoomInIcon,
  zoomOut: ZoomOutIcon,
} as const satisfies Record<string, IconSvgElement>;
