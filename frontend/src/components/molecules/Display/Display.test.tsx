import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Display } from './Display'

describe('Display', () => {
  it('shows both lines, value is a polite live region', () => {
    render(<Display expression="1 + 2" value="3" isError={false} />)
    expect(screen.getByText('1 + 2')).toBeInTheDocument()
    const value = screen.getByText('3')
    expect(value).toHaveAttribute('aria-live', 'polite')
    expect(value).not.toHaveClass('error')
  })

  it('uses the error variant', () => {
    render(<Display expression="" value="Undefined" isError />)
    expect(screen.getByText('Undefined')).toHaveClass('error')
  })

  it('marks long values', () => {
    render(<Display expression="" value="0.333333333333333" isError={false} />)
    expect(screen.getByText('0.333333333333333')).toHaveClass('long')
  })
})
