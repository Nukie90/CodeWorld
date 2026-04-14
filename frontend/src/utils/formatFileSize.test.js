import { describe, expect, it } from 'vitest'

import { formatFileSize } from './formatFileSize'

describe('formatFileSize', () => {
  it.each([
    {
      caseName: 'below the lower bound',
      bytes: -1,
      expected: '0 B',
    },
    {
      caseName: 'at the lower bound',
      bytes: 0,
      expected: '0 B',
    },
    {
      caseName: 'just above the lower bound',
      bytes: 1,
      expected: '1 B',
    },
    {
      caseName: 'just below the KB boundary',
      bytes: 1023,
      expected: '1023 B',
    },
    {
      caseName: 'at the KB boundary',
      bytes: 1024,
      expected: '1.0 KB',
    },
    {
      caseName: 'just above the KB boundary',
      bytes: 1025,
      expected: '1.0 KB',
    },
    {
      caseName: 'just below the integer-rounding cutoff within KB',
      bytes: 10 * 1024 - 1,
      expected: '10.0 KB',
    },
    {
      caseName: 'at the integer-rounding cutoff within KB',
      bytes: 10 * 1024,
      expected: '10 KB',
    },
    {
      caseName: 'just above the integer-rounding cutoff within KB',
      bytes: 10 * 1024 + 1,
      expected: '10 KB',
    },
    {
      caseName: 'just below the MB boundary',
      bytes: 1024 ** 2 - 1,
      expected: '1024 KB',
    },
    {
      caseName: 'at the MB boundary',
      bytes: 1024 ** 2,
      expected: '1.0 MB',
    },
    {
      caseName: 'at the configured maximum unit cap',
      bytes: 1024 ** 5,
      expected: '1024 TB',
    },
  ])('applies boundary value analysis for $caseName', ({ bytes, expected }) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })

  it('returns 0 B for non-finite values', () => {
    expect(formatFileSize(Number.NaN)).toBe('0 B')
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B')
  })

  it('formats typical in-range values correctly', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5.0 GB')
  })
})
