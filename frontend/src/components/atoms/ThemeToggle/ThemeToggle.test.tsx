import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })
  afterEach(() => vi.restoreAllMocks())

  it('toggles dark then light and stores the choice', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('starts from the stored theme', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('leaves data-theme unset until the user chooses, and labels from the OS theme', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(<ThemeToggle />)
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('still toggles when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('prevents mousedown default so clicks do not take focus', async () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('button')
    expect(fireEvent.mouseDown(btn)).toBe(false)
    await userEvent.click(btn)
    expect(btn).not.toHaveFocus()
  })
})
