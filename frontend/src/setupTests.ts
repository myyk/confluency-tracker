import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-registers cleanup when vitest runs with globals
// enabled. It does not here, so without this every render stacks up in the
// same document and queries start matching earlier tests' markup.
afterEach(cleanup)
