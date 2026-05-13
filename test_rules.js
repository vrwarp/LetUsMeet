const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('fs');

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: "demo-project",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });

  const alice = testEnv.authenticatedContext("alice");

  // Test 1: existing rules vulnerable to update
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('polls').doc('p1').set({ organizerUid: 'alice', adminToken: 'secret', createdAt: '2023' });
  });

  const bob = testEnv.authenticatedContext("bob");
  const bobDb = bob.firestore();

  // Bob can update alice's poll without token
  const res = await assertSucceeds(bobDb.collection('polls').doc('p1').update({ title: 'hacked' }));
  console.log("Vulnerability confirmed:", res !== undefined);

  await testEnv.cleanup();
}
main().catch(console.error);
