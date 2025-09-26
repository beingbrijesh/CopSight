import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-fluid-xs whitespace-nowrap rounded-lg font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:shadow-button",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-button",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-button",
        outline:
          "border border-white-border bg-white text-gray-900 hover:bg-secondary/50 shadow-button",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-button",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        orange: "bg-accent-orange text-white hover:bg-accent-orange-dark shadow-button hover:shadow-lg transition-all duration-200",
        hero: "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200",
      },
      size: {
        sm: "h-9 px-fluid-sm py-fluid-xs text-fluid-sm [&_svg]:size-4",
        md: "h-11 px-fluid-md py-fluid-sm text-fluid-base [&_svg]:size-4",
        lg: "h-12 px-fluid-lg py-fluid-md text-fluid-lg [&_svg]:size-5",
        icon: "h-10 w-10 [&_svg]:size-4",
        default: "h-10 px-fluid-md py-fluid-sm text-fluid-base [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };