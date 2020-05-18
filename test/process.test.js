const test = require('ava')
const sinon = require('sinon')
const Process = require('../lib/process')

test.beforeEach((t) => {
  t.context.db = {
    distributePooledFunds: sinon.stub().resolves({})
  }
})

test('distributes funds to packages', async (t) => {
  await Process.process({ db: t.context.db, log: () => {} })
  t.true(t.context.db.distributePooledFunds.calledOnce)
})
