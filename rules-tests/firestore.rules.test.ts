import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { createRulesTestEnv } from './testEnv'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await createRulesTestEnv()
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('keystore', () => {
  it('is readable only by its owner', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/keystore/poll1'), { encryptedData: 'x', iv: 'y', updatedAt: 1, amkId: 'a' })
    })
    await assertSucceeds(getDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice/keystore/poll1')))
    await assertFails(getDoc(doc(env.authenticatedContext('mallory').firestore(), 'users/alice/keystore/poll1')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice/keystore/poll1')))
  })
})

describe('polls ledger', () => {
  it('blocks listing polls', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'polls')))
  })

  it('accepts a well-formed event stamped with the server time and refuses to rewrite it', async () => {
    const db = env.authenticatedContext('alice').firestore()
    const ref = doc(db, 'polls/p1/events/e1')
    await assertSucceeds(setDoc(ref, { eventId: 'e1', createdAt: serverTimestamp(), encryptedData: 'ct', iv: 'iv' }))
    await assertFails(updateDoc(ref, { encryptedData: 'tampered' }))
    await assertFails(deleteDoc(ref))
  })
})
