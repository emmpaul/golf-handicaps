import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Étiquette à coins droits et filet d'encre : jamais de pilule pleine (design D4). La
// variante `default` est un contour, `secondary` du texte secondaire sans fond.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-1.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color] duration-(--dur-micro) ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-foreground text-foreground [a]:hover:bg-muted",
        secondary: "px-0 text-muted-foreground [a]:hover:text-foreground",
        destructive: "border-destructive text-destructive [a]:hover:bg-destructive/10",
        outline: "border-border text-foreground [a]:hover:bg-muted",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "px-0 text-primary underline underline-offset-4 hover:decoration-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
