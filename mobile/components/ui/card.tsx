import { forwardRef } from "react";
import { Text, TextProps, View, ViewProps } from "react-native";
import { cn } from "@/lib/utils";

const Card = forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "rounded-xl border border-border bg-card gap-4 py-5",
      className as string,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        "flex-row items-start justify-between gap-3 px-5",
        className as string,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardHeaderText = forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("flex-1 gap-1.5", className as string)}
      {...props}
    />
  ),
);
CardHeaderText.displayName = "CardHeaderText";

const CardTitle = forwardRef<Text, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn(
        "font-semibold text-base text-card-foreground",
        className as string,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<Text, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn("text-sm text-muted-foreground", className as string)}
      {...props}
    />
  ),
);
CardDescription.displayName = "CardDescription";

const CardAction = forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("shrink-0", className as string)}
      {...props}
    />
  ),
);
CardAction.displayName = "CardAction";

const CardContent = forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("px-5", className as string)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("flex-row items-center px-5", className as string)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeaderText,
  CardTitle,
};
