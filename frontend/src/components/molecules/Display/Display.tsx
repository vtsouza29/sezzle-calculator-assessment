import { DisplayLine } from '../../atoms/DisplayLine'
import styles from './Display.module.css'

interface DisplayProps {
  expression: string
  value: string
  isError: boolean
}

export function Display({ expression, value, isError }: DisplayProps) {
  return (
    <div className={styles.display}>
      <DisplayLine text={expression} variant="expression" />
      <DisplayLine
        text={value}
        variant={isError ? 'error' : 'result'}
        long={value.length > 9}
        ariaLive="polite"
      />
    </div>
  )
}
