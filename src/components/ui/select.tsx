import * as SelectPrimitive from "@radix-ui/react-select";
import type { ComponentProps } from "react";
import { RepairIcon } from "../../design/RepairIcon";

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Select(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

export function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={classNames("shadcn-select-trigger", className)}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <RepairIcon className="shadcn-select-chevron" name="down" size={16} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={classNames("shadcn-select-content", className)}
        data-slot="select-content"
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="shadcn-select-scroll-button">
          <RepairIcon name="up" size={16} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="shadcn-select-viewport">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="shadcn-select-scroll-button">
          <RepairIcon name="down" size={16} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={classNames("shadcn-select-item", className)}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="shadcn-select-indicator">
        <SelectPrimitive.ItemIndicator>
          <RepairIcon name="tick" size={16} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}
