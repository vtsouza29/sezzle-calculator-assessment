import { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // storage unavailable: fall through to OS preference
  }
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const toggle = () => {
    try {
      localStorage.setItem('theme', next)
    } catch {
      // persistence is best-effort
    }
    setTheme(next)
  }

  return (
    <button type="button" className={styles.toggle} aria-label={`Switch to ${next} theme`} onClick={toggle}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
