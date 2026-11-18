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
      onClick={(e) => {
        onPress()
        // Pointer clicks (detail > 0) must not keep focus, so Enter keeps reaching the calculator; preventing mousedown would suppress :active in Firefox.
        if (e.detail > 0) e.currentTarget.blur()
      }}
    >
      {label}
    </button>
  )
}
