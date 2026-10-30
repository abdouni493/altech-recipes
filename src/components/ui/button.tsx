import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Editorial style: squared, uppercase, wide tracking. Solid variants get a cinematic colour sweep on hover (::before).
const sweep =
  "relative isolate overflow-hidden before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.76,0,0.24,1)] hover:before:scale-x-100 rtl:before:origin-right";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-label text-xs font-bold uppercase tracking-[0.16em] transition-[color,background-color,border-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform hover:[&_svg.flip-rtl]:translate-x-0.5 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: `${sweep} bg-primary text-primary-foreground before:bg-foreground hover:text-background dark:before:bg-lemon dark:hover:text-lemon-foreground`,
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: `${sweep} border-2 border-foreground/80 bg-transparent text-foreground before:bg-foreground hover:text-background`,
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
        lemon: `${sweep} bg-lemon text-lemon-foreground before:bg-white hover:text-primary`,
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-[11px]",
        lg: "h-12 px-8 text-[13px]",
        icon: "h-9 w-9 normal-case tracking-normal",
        "icon-sm": "h-8 w-8 normal-case tracking-normal",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
