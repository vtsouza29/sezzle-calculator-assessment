import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import { Calculator } from './Calculator'

const click = async (u: ReturnType<typeof userEvent.setup>, ...names: string[]) => {
  for (const n of names) await u.click(screen.getByRole('button', { name: n }))
}

it('evaluates 2 + 3 x 4 via the keypad', async () => {
  const fn = vi.fn().mockResolvedValue({ result: 14 })
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await click(u, '2', 'add', '3', 'multiply', '4', 'equals')
  expect(fn).toHaveBeenCalledWith('2 + 3 * 4')
  expect(await screen.findByText('14')).toBeInTheDocument()
  expect(screen.getByText('2+3×4')).toBeInTheDocument()
})

it('supports keyboard and repeated Enter', async () => {
  const fn = vi.fn().mockResolvedValueOnce({ result: 10, repeat: '+ 5' }).mockResolvedValue({ result: 15 })
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await u.keyboard('5+5{Enter}')
  expect(await screen.findByText('10')).toBeInTheDocument()
  await u.keyboard('{Enter}')
  expect(fn).toHaveBeenLastCalledWith('10 + 5')
})

it('shows API error message', async () => {
  const fn = vi.fn().mockRejectedValue(new ApiError('DIVISION_BY_ZERO', 'Undefined'))
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await u.keyboard('8/0{Enter}')
  expect(await screen.findByText('Undefined')).toBeInTheDocument()
})

it('Enter on a focused key fires equals once and does not click the key', async () => {
  const fn = vi.fn().mockResolvedValue({ result: 5 })
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await u.keyboard('2+3')
  const seven = screen.getByRole('button', { name: '7' })
  const clicked = vi.fn()
  seven.addEventListener('click', clicked)
  seven.focus()
  await u.keyboard('{Enter}')
  expect(clicked).not.toHaveBeenCalled()
  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn).toHaveBeenCalledWith('2 + 3')
  expect(screen.getByText('2+3')).toBeInTheDocument()
})

it('ignores a second = while a request is in flight', async () => {
  const fn = vi.fn().mockReturnValue(new Promise(() => {}))
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await click(u, '2', 'add', '3', 'equals', 'equals')
  expect(fn).toHaveBeenCalledTimes(1)
})

it('ignores keys with modifiers', async () => {
  const fn = vi.fn()
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await u.keyboard('{Control>}5{/Control}')
  expect(document.querySelector('[aria-live]')).toHaveTextContent('0')
})

it('Enter on the theme toggle toggles the theme and does not evaluate', async () => {
  const fn = vi.fn().mockResolvedValue({ result: 5 })
  const u = userEvent.setup()
  render(<Calculator evaluateFn={fn} />)
  await u.keyboard('2+3')
  const before = document.documentElement.dataset.theme
  const toggle = screen.getByRole('button', { name: /Switch to/ })
  toggle.focus()
  await u.keyboard('{Enter}')
  expect(document.documentElement.dataset.theme).not.toBe(before)
  expect(fn).not.toHaveBeenCalled()
})

it('keeps typing after the theme toggle was clicked', async () => {
  const u = userEvent.setup()
  render(<Calculator evaluateFn={vi.fn()} />)
  await u.click(screen.getByRole('button', { name: /Switch to/ }))
  await u.keyboard('7')
  expect(document.querySelector('[aria-live]')).toHaveTextContent('7')
})
