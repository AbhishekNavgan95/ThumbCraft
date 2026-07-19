import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type ComposerOption = {
  value: string
  label: string
  description?: string
}

type ComposerOptionSelectProps = {
  label: string
  value: string
  disabled?: boolean
  emptyLabel?: string
  options: ComposerOption[]
  onChange: (value: string) => void
  className?: string
  contentClassName?: string
}

export function ComposerOptionSelect({
  label,
  value,
  disabled,
  emptyLabel = "Select",
  options,
  onChange,
  className,
  contentClassName,
}: ComposerOptionSelectProps) {
  const selected = options.find((option) => option.value === value)
  const triggerText = selected?.label ?? emptyLabel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled || options.length === 0}
          aria-label={label}
          className={cn(
            "inline-flex h-8 max-w-[9.5rem] items-center gap-1.5 rounded-full",
            "border border-border/70 bg-muted/60 px-2.5 text-xs font-medium text-foreground",
            "outline-none transition-colors hover:bg-muted",
            "focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
        >
          <span className="truncate">{triggerText}</span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={10}
        className={cn("w-52", contentClassName)}
      >
        {options.map((option) => {
          const isSelected = option.value === value
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn(
                "gap-2",
                option.description ? "items-start py-2.5" : "justify-between",
              )}
              onSelect={() => onChange(option.value)}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {option.label}
                </p>
                {option.description ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {option.description}
                  </p>
                ) : null}
              </div>
              {isSelected ? (
                <Check
                  className={cn(
                    "size-3.5 shrink-0 text-primary",
                    option.description && "mt-0.5",
                  )}
                  strokeWidth={2.5}
                />
              ) : (
                <span
                  className={cn(
                    "size-3.5 shrink-0",
                    option.description && "mt-0.5",
                  )}
                />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
