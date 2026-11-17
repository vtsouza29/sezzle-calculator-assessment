import { useLayoutEffect, useRef, type AriaAttributes } from 'react'
import styles from './DisplayLine.module.css'

interface DisplayLineProps {
  text: string
  variant: 'expression' | 'result' | 'error'
  long?: boolean
  ariaLive?: AriaAttributes['aria-live']
}

export function DisplayLine({ text, variant, long, ariaLive }: DisplayLineProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Overflowing content start-aligns, hiding the newest characters; keep the tail in view.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [text])
  const cls = [styles.line, styles[variant], long && styles.long].filter(Boolean).join(' ')
  return (
    <div ref={ref} className={cls} aria-live={ariaLive}>
      {text}
    </div>
  )
}
