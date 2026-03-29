import { describe, expect, it } from 'vitest'

import { SceneDiffer } from './SceneDiffer'

describe('SceneDiffer', () => {
  it('detects added, removed, modified, and unchanged files', () => {
    const previousFiles = [
      { filename: 'kept.js', lloc: 10, total_complexity: 2, functions: [{}, {}], is_unsupported: false },
      { filename: 'removed.js', lloc: 4, total_complexity: 1, functions: [], is_unsupported: false },
      { filename: 'modified.js', lloc: 8, total_complexity: 3, functions: [{}], is_unsupported: false },
    ]
    const currentFiles = [
      { filename: 'kept.js', lloc: 10, total_complexity: 2, functions: [{}, {}], is_unsupported: false },
      { filename: 'modified.js', lloc: 12, total_complexity: 3, functions: [{}], is_unsupported: false },
      { filename: 'added.js', lloc: 5, total_complexity: 1, functions: [], is_unsupported: false },
    ]

    const diff = SceneDiffer.diffFiles(previousFiles, currentFiles)

    expect(diff.added).toEqual([currentFiles[2]])
    expect(diff.removed).toEqual([previousFiles[1]])
    expect(diff.modified).toEqual([
      { old: previousFiles[2], new: currentFiles[1], filename: 'modified.js' },
    ])
    expect(diff.unchanged).toEqual([currentFiles[0]])
  })

  it('treats changes in complexity, function count, and unsupported state as meaningful', () => {
    expect(
      SceneDiffer.hasChanged(
        { filename: 'file.js', lloc: 8, total_complexity: 1, functions: [], is_unsupported: false },
        { filename: 'file.js', lloc: 8, total_complexity: 2, functions: [], is_unsupported: false },
      ),
    ).toBe(true)

    expect(
      SceneDiffer.hasChanged(
        { filename: 'file.js', lloc: 8, total_complexity: 1, functions: [], is_unsupported: false },
        { filename: 'file.js', lloc: 8, total_complexity: 1, functions: [{}], is_unsupported: false },
      ),
    ).toBe(true)

    expect(
      SceneDiffer.hasChanged(
        { filename: 'file.js', lloc: 8, total_complexity: 1, functions: [], is_unsupported: false },
        { filename: 'file.js', lloc: 8, total_complexity: 1, functions: [], is_unsupported: true },
      ),
    ).toBe(true)
  })

  it('builds a readable change summary', () => {
    const summary = SceneDiffer.getSummary({
      added: [{}, {}],
      removed: [{}],
      modified: [{}, {}, {}],
      unchanged: [{}],
    })

    expect(summary).toBe('+2 files, -1 files, ~3 files, =1 files')
  })
})
