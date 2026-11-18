import styles from './Key.module.css'

export type KeyVariant = 'digit' | 'function' | 'operator' | 'equals'

interface KeyProps {
  label: string
  ariaLabel?: string
  variant: KeyVariant
  onPress: () => void
  className?: string
}

export function Key({ label, ariaLabel, variant, onPress, className }: KeyProps) {
  return (
    <button
      type="button"
      className={[styles.key, styles[variant], className].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? label}
      onClick={onPress}
      onMouseDown={(e) => e.preventDefault()} // clicks must not take focus, so Enter keeps reaching the calculator
    >
      {label}
    </button>
  )
}
