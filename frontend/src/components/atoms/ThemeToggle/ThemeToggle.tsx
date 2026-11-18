import { useLayoutEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

type Theme = 'light' | 'dark'

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // storage unavailable: fall back to OS preference
  }
  return null
}

function osTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeToggle() {
  // null = no explicit choice yet, so data-theme stays unset and CSS follows the OS live.
  const [choice, setChoice] = useState<Theme | null>(storedTheme)
  const theme = choice ?? osTheme()

  useLayoutEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice
  }, [choice])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const toggle = () => {
    try {
      localStorage.setItem('theme', next)
    } catch {
      // persistence is best-effort
    }
    setChoice(next)
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Switch to ${next} theme`}
      onClick={(e) => {
        toggle()
        if (e.detail > 0) e.currentTarget.blur() // pointer click: drop focus (see Key)
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
