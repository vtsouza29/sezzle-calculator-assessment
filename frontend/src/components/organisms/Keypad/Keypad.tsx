import type { Action } from '../../../calculator/reducer'
import { Key, type KeyVariant } from '../../atoms/Key'
import styles from './Keypad.module.css'

type Def = { label: string; aria?: string; variant: KeyVariant; action: Action; className?: string }

const digit = (d: string, className?: string): Def => ({ label: d, variant: 'digit', action: { type: 'digit', digit: d }, className })
const op = (label: string, aria: string, o: '+' | '-' | '*' | '/'): Def => ({ label, aria, variant: 'operator', action: { type: 'operator', op: o } })
const fn = (label: string, aria: string, action: Action): Def => ({ label, aria, variant: 'function', action })

// Spec §3.1 order, row by row.
const KEYS: Def[] = [
  fn('AC', 'clear', { type: 'clear' }), fn('⌫', 'backspace', { type: 'backspace' }),
  fn('±', 'toggle sign', { type: 'negate' }), op('÷', 'divide', '/'),
  fn('xʸ', 'power', { type: 'operator', op: '^' }), fn('√', 'square root', { type: 'sqrt' }),
  fn('%', 'percent', { type: 'percent' }), op('×', 'multiply', '*'),
  digit('7'), digit('8'), digit('9'), op('−', 'subtract', '-'),
  digit('4'), digit('5'), digit('6'), op('+', 'add', '+'),
  digit('1'), digit('2'), digit('3'),
  { label: '=', aria: 'equals', variant: 'equals', action: { type: 'equals' }, className: styles.equals },
  digit('0', styles.zero),
  { label: '.', aria: 'decimal point', variant: 'digit', action: { type: 'decimal' } },
]

export function Keypad({ onAction }: { onAction: (a: Action) => void }) {
  return (
    <div className={styles.keypad} data-keypad>
      {KEYS.map((k) => (
        <Key key={k.label} label={k.label} ariaLabel={k.aria} variant={k.variant} className={k.className} onPress={() => onAction(k.action)} />
      ))}
    </div>
  )
}
