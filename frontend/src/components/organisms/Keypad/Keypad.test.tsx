import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Keypad } from './Keypad'

it('renders 22 keys in spec order', () => {
  render(<Keypad onAction={() => {}} />)
  const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
  expect(names).toEqual([
    'clear', 'backspace', 'toggle sign', 'divide',
    'power', 'square root', 'percent', 'multiply',
    '7', '8', '9', 'subtract',
    '4', '5', '6', 'add',
    '1', '2', '3', 'equals',
    '0', 'decimal point',
  ])
})
