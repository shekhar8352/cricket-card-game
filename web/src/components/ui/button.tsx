import { cn } from '../../lib/cn'
import type { ButtonHTMLAttributes } from 'react'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl min-h-11 px-4 py-2 text-base font-semibold cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        variant === 'primary' && 'bg-cta text-cta-fg hover:bg-cta/90',
        variant === 'ghost' && 'hover:bg-black/5 dark:hover:bg-white/10',
        variant === 'outline' && 'border border-border bg-card hover:bg-black/5 dark:hover:bg-white/10',
        variant === 'danger' && 'bg-[#b91c1c] text-white hover:bg-[#991b1b]',
        className,
      )}
      {...props}
    />
  )
}
