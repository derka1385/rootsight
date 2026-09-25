import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { Pressable, PressableProps, Text, View } from "react-native";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-xl active:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary",
        outline: "bg-background border border-border active:bg-muted",
        secondary: "bg-muted",
        ghost: "bg-transparent active:bg-muted",
        destructive: "bg-destructive",
        link: "bg-transparent",
      },
      size: {
        xs: "h-8 px-3 gap-1.5",
        sm: "h-10 px-4 gap-2",
        default: "h-14 px-6 gap-2",
        lg: "h-16 px-7 gap-2.5",
        icon: "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva("text-center font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      outline: "text-foreground",
      secondary: "text-foreground",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
      link: "text-foreground underline",
    },
    size: {
      xs: "text-sm",
      sm: "text-base",
      default: "text-lg",
      lg: "text-xl",
      icon: "text-base",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type ButtonProps = PressableProps & VariantProps<typeof buttonVariants>;

const Button = forwardRef<View, ButtonProps>(
  ({ className, variant, size, disabled, children, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        className={cn(
          buttonVariants({ variant, size }),
          disabled && "opacity-50",
          className as string,
        )}
        {...props}
      >
        {typeof children === "string" ? (
          <Text className={buttonTextVariants({ variant, size })}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
