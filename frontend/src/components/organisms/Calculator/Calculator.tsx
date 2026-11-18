import { useEffect } from 'react'
import type { evaluate } from '../../../api/client'
import { keyToAction } from '../../../calculator/keyboard'
import { expressionLine, mainLine } from '../../../calculator/reducer'
import { useCalculator } from '../../../calculator/useCalculator'
import { ThemeToggle } from '../../atoms/ThemeToggle'
import { Display } from '../../molecules/Display'
import { Keypad } from '../Keypad'
import styles from './Calculator.module.css'

export function Calculator({ evaluateFn }: { evaluateFn?: typeof evaluate }) {
  const { state, dispatch } = useCalculator(evaluateFn)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Only a keyboard-focused button reaches here with Enter/Space (clicks never focus); let it activate natively.
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement) return
      const action = keyToAction(e.key)
      if (!action) return
      if (e.repeat && action.type === 'equals') return
      e.preventDefault()
      dispatch(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  return (
    <div className={styles.calculator}>
      <div className={styles.header}>
        <ThemeToggle />
      </div>
      <Display expression={expressionLine(state)} value={mainLine(state)} isError={state.status === 'error'} />
      <Keypad onAction={dispatch} />
    </div>
  )
}
