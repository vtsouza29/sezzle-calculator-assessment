import type { AriaAttributes } from 'react'
import styles from './DisplayLine.module.css'

interface DisplayLineProps {
  text: string
  variant: 'expression' | 'result' | 'error'
  long?: boolean
  ariaLive?: AriaAttributes['aria-live']
}

export function DisplayLine({ text, variant, long, ariaLive }: DisplayLineProps) {
  const cls = [styles.line, styles[variant], long && styles.long].filter(Boolean).join(' ')
  return (
    <div className={cls} aria-live={ariaLive}>
      {text}
    </div>
  )
}
