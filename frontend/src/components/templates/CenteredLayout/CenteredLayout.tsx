import type { ReactNode } from 'react'
import styles from './CenteredLayout.module.css'

export function CenteredLayout({ children }: { children: ReactNode }) {
  return <main className={styles.layout}>{children}</main>
}
