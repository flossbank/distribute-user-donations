const test = require('ava')
const sinon = require('sinon')
const Process = require('../lib/process')

test.beforeEach((t) => {
  t.context.db = {
    findUserId: sinon.stub().resolves('test-user-id'),
    createPackageWeightsMap: sinon.stub().resolves({}),
    distributeUserDonation: sinon.stub()
  }
  t.context.dynamo = {
    lockUser: sinon.stub().resolves({ success: true }),
    unlockUser: sinon.stub().resolves({ success: true })
  }
  t.context.log = { log: sinon.stub() }
  t.context.recordBody = {
    amount: 1000,
    timestamp: 1234,
    customerId: 'customerid',
    description: 'testing donation'
  }
  t.context.testRecord = {
    body: JSON.stringify(t.context.recordBody)
  }
  t.context.undefinedCustomerRecordBody = {
    amount: 1000,
    timestamp: 1234,
    customerId: undefined,
    description: 'testing donation'
  }
  t.context.undefinedCustomerTestRecord = {
    body: JSON.stringify(t.context.undefinedCustomerRecordBody)
  }
})

test('process | success', async (t) => {
  const res = await Process.process({
    db: t.context.db,
    log: t.context.log,
    dynamo: t.context.dynamo,
    record: t.context.testRecord
  })
  t.true(t.context.log.log.calledWith({ ...t.context.recordBody }))
  t.true(t.context.db.findUserId.calledWith({ customerId: t.context.recordBody.customerId }))
  t.true(t.context.dynamo.lockUser.calledWith({ userId: 'test-user-id' }))
  t.true(t.context.log.log.calledWith({ lockInfo: { success: true } }))
  const expectedDonationAmount = ((t.context.recordBody.amount * 0.94) - 30) * 1000
  t.true(t.context.db.distributeUserDonation.calledWith({
    donationAmount: expectedDonationAmount,
    packageWeightsMap: {},
    userId: 'test-user-id'
  }))
  t.deepEqual(res, { success: true })
})

test('process | failure, undefined returned fetching user', async (t) => {
  t.context.db.findUserId.resolves(undefined)
  await t.throwsAsync(Process.process({
    db: t.context.db,
    log: t.context.log,
    dynamo: t.context.dynamo,
    record: t.context.testRecord
  }))
})

test('process | failure, undefined customer id', async (t) => {
  await t.throwsAsync(Process.process({
    db: t.context.db,
    log: t.context.log,
    dynamo: t.context.dynamo,
    record: t.context.undefinedCustomerTestRecord
  }))
})

test('process | failure, user already locked', async (t) => {
  t.context.dynamo.lockUser.rejects()
  await t.throwsAsync(Process.process({
    db: t.context.db,
    log: t.context.log,
    dynamo: t.context.dynamo,
    record: t.context.testRecord
  }))
  t.false(t.context.db.distributeUserDonation.calledOnce)
})

test('process | failure, distributeUserDonation fails', async (t) => {
  t.context.db.distributeUserDonation.rejects()
  await t.throwsAsync(Process.process({
    db: t.context.db,
    log: t.context.log,
    dynamo: t.context.dynamo,
    record: t.context.testRecord
  }))
})
