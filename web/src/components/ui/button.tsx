import { cn } from '../../lib/cn'
import type { ButtonHTMLAttributes } from 'react'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'pitch' | 'ghost' | 'outline' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl min-h-11 px-4 py-2 text-base font-bold cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        variant === 'primary' && 'btn-cta uppercase tracking-wide font-display text-lg',
        variant === 'pitch' && 'btn-pitch uppercase tracking-wide font-display text-lg',
        variant === 'ghost' && 'hover:bg-black/5 dark:hover:bg-white/10',
        variant === 'outline' && 'border border-border bg-card/70 hover:bg-black/5 dark:hover:bg-white/10',
        variant === 'danger' && 'bg-[#b91c1c] text-white hover:bg-[#991b1b]',
        className,
      )}
      {...props}
    />
  )
}
