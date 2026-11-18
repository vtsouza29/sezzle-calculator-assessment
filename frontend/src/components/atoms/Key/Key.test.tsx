import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Key } from './Key'

describe('Key', () => {
  it('uses label as accessible name by default and ariaLabel when given', () => {
    const { rerender } = render(<Key label="7" variant="digit" onPress={() => {}} />)
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
    rerender(<Key label="÷" ariaLabel="divide" variant="operator" onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'divide' })).toBeInTheDocument()
  })

  it('calls onPress once per click', async () => {
    const onPress = vi.fn()
    render(<Key label="1" variant="digit" onPress={onPress} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('applies the variant class', () => {
    render(<Key label="=" variant="equals" onPress={() => {}} />)
    expect(screen.getByRole('button')).toHaveClass('equals')
  })

  it('drops focus after a pointer click', async () => {
    render(<Key label="1" variant="digit" onPress={() => {}} />)
    await userEvent.click(screen.getByRole('button'))
    expect(document.body).toHaveFocus()
  })
})
