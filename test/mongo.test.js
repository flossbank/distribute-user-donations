const test = require('ava')
const sinon = require('sinon')
const { MongoClient } = require('mongodb')
const Mongo = require('../lib/mongo')

test.before(() => {
  sinon.stub(Date, 'now').returns(1234)
})

test.beforeEach((t) => {
  t.context.mongo = new Mongo({
    config: {
      getMongoUri: async () => 'mongodb+srv://0.0.0.0/test'
    }
  })

  t.context.userId = 'aaaaaaaaaaaa'
  t.context.packageInstallsForUser = [{ 
      _id: 'package-1aaa',
      weight: 0.015
    },
    {
      _id: 'package-2bbb',
      weight: 0.5
    },
    {
      _id: 'package-3ccc',
      weight: 1.5
    }
  ]
  t.context.packageWeightsMap = new Map([['package-1aaa', 0.015], ['package-2bbb', 0.5], ['package-3ccc', 1.5]])

  t.context.mongo.db = {
    collection: sinon.stub().returns({
      findOne: sinon.stub().resolves({ 
        _id: 'test-user'
      }),
      aggregate: sinon.stub().returns({
        toArray: sinon.stub().resolves(t.context.packageInstallsForUser)
      }),
      initializeUnorderedBulkOp: sinon.stub().returns({
        find: sinon.stub().returns({
          updateOne: sinon.stub()
        }),
        execute: sinon.stub().returns({ nModified: 2 })
      })
    })
  }
})

test('connect', async (t) => {
  sinon.stub(MongoClient.prototype, 'connect')
  sinon.stub(MongoClient.prototype, 'db')

  await t.context.mongo.connect()
  t.true(MongoClient.prototype.connect.calledOnce)

  MongoClient.prototype.connect.restore()
  MongoClient.prototype.db.restore()
})

test('close', async (t) => {
  await t.context.mongo.close()
  t.context.mongo.mongoClient = { close: sinon.stub() }
  await t.context.mongo.close()
  t.true(t.context.mongo.mongoClient.close.calledOnce)
})

test('find UserId | success', async (t) => {
  t.context.mongo.db.collection().findOne.resolves({
    _id: 'nico',
    apiKey: 'blah'
  })
  const res = await t.context.mongo.findUserId({ customerId: 'blanket' })
  t.is(res, 'nico')
})

test('find UserId | returns undefined if non existent', async (t) => {
  t.context.mongo.db.collection().findOne.resolves(undefined)
  const res = await t.context.mongo.findUserId({ customerId: 'blanket' })
  t.is(res, undefined)
})

test('create Package Weights Map | success', async (t) => {
  const res = await t.context.mongo.createPackageWeightsMap({ userId: t.context.userId })
  t.deepEqual(res, t.context.packageWeightsMap)
})

test('create Package Weights Map | error in aggregation', async (t) => {
  t.context.mongo.db.collection().aggregate().toArray.rejects()
  await t.throwsAsync(t.context.mongo.createPackageWeightsMap({ userId: t.context.userId }))
})

test('distribute User Donation | success', async (t) => {
  const expectedTotalMass = t.context.packageInstallsForUser.reduce((acc, val) => acc + val.weight, 0)
  const donationAmount = 1000000 // 10 bucks in mc
  const packageWeightsMap = t.context.packageWeightsMap
  await t.context.mongo.distributeUserDonation({ userId: t.context.userId, packageWeightsMap, donationAmount })
  // 3 pushes for 3 diff packages in our packageWeightsMap
  t.true(t.context.mongo.db.collection().initializeUnorderedBulkOp().find().updateOne.calledWith({
    $push: { donationRevenue: { 
      userId: t.context.userId, 
      timestamp: 1234, 
      amount: ((packageWeightsMap.get('package-1aaa') / expectedTotalMass) * donationAmount) } } 
  }))
  t.true(t.context.mongo.db.collection().initializeUnorderedBulkOp().find().updateOne.calledWith({
    $push: { donationRevenue: { 
      userId: t.context.userId, 
      timestamp: 1234, 
      amount: ((packageWeightsMap.get('package-2bbb') / expectedTotalMass) * donationAmount) } }
  }))
  t.true(t.context.mongo.db.collection().initializeUnorderedBulkOp().find().updateOne.calledWith({
    $push: { donationRevenue: { 
      userId: t.context.userId, 
      timestamp: 1234, 
      amount: ((packageWeightsMap.get('package-3ccc') / expectedTotalMass) * donationAmount) } } 
  }))
})
