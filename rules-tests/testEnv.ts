import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const rulesPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../firestore.rules')

export function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-letusmeet',
    firestore: { rules: readFileSync(rulesPath, 'utf8') },
  })
}
