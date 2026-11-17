import { useEffect } from 'react'
import type { evaluate } from '../../../api/client'
import { keyToAction } from '../../../calculator/keyboard'
import { mainLine } from '../../../calculator/reducer'
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
      const action = keyToAction(e.key)
      if (!action) return
      e.preventDefault() // stops Enter from also clicking a focused key
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
      <Display expression={state.expressionLine} value={mainLine(state)} isError={state.status === 'error'} />
      <Keypad onAction={dispatch} />
    </div>
  )
}
