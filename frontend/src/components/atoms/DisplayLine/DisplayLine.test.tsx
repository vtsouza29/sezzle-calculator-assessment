import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DisplayLine } from './DisplayLine'

afterEach(() => vi.restoreAllMocks())

it('scrolls to the end so the newest characters stay visible', () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500)
  const { container, rerender } = render(<DisplayLine text="1+1" variant="expression" />)
  const el = container.firstElementChild as HTMLElement
  expect(el.scrollLeft).toBe(500)
  el.scrollLeft = 0
  rerender(<DisplayLine text="1+12" variant="expression" />)
  expect(el.scrollLeft).toBe(500)
})
