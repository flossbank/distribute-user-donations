const test = require('ava')
const sinon = require('sinon')
const { MongoClient, ObjectId } = require('mongodb')
const Mongo = require('../lib/mongo')

test.beforeEach((t) => {
  t.context.mongo = new Mongo({
    config: {
      getMongoUri: async () => 'mongodb+srv://0.0.0.0/test'
    }
  })
  t.context.mongo.batchSize = 2
  t.context.mongo.db = {
    collection: sinon.stub().returns({
      findOne: sinon.stub().resolves({ // getting pool amount from meta table
        data: { amount: 1500 }
      }),
      aggregate: sinon.stub().returns({
        toArray: sinon.stub().resolves([{ // total package installs across entire db
          _id: null,
          totalInstalls: 5
        }])
      }),
      find: sinon.stub().returns({
        project: sinon.stub().returns({
          limit: sinon.stub().returns({
            toArray: sinon.stub().onFirstCall().resolves([ // batch of packages
              {
                _id: ObjectId('5e2d194c05a98a206286b844'), // 2 installs
                installs: [{}, {}]
              },
              {
                _id: ObjectId('5e2d194c05a98a206286b845') // no installs
              }
            ]).onSecondCall().resolves([
              {
                _id: ObjectId('5e2d194c05a98a206286b846'), // 3 installs
                installs: [{}, {}, {}]
              }
            ])
          })
        })
      }),
      updateOne: sinon.stub().resolves(),
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

test('distribute pooled funds | nothing to distribute', async (t) => {
  t.context.mongo.db.collection().findOne.resolves({
    data: { amount: 0 }
  })
  const res = await t.context.mongo.distributePooledFunds()
  t.is(res.amount, 0)
  t.is(res.totalAmountUsed, 0)
})

test('distribute pooled funds | aggregate returns nothing', async (t) => {
  t.context.mongo.db.collection().aggregate().toArray.resolves([])
  const res = await t.context.mongo.distributePooledFunds()
  t.is(res.amount, 0)
  t.is(res.totalAmountUsed, 0)
})

test('distribute pooled funds | empty batch', async (t) => {
  t.context.mongo.db.collection().find().project().limit().toArray.onFirstCall().resolves([])
  const res = await t.context.mongo.distributePooledFunds()
  t.is(res.amount, 1500)
  t.is(res.totalAmountUsed, 0)
})

test('distribute pooled funds | funds to distribute', async (t) => {
  const res = await t.context.mongo.distributePooledFunds()
  t.is(res.amount, 1500)
  t.is(res.totalAmountUsed, 1500)

  t.true(t.context.mongo.db.collection().initializeUnorderedBulkOp().find().updateOne.calledWith({
    $inc: { dividend: (2 / 5) * 1500 } // pkg with 2 installs
  }))
  t.true(t.context.mongo.db.collection().initializeUnorderedBulkOp().find().updateOne.calledWith({
    $inc: { dividend: (3 / 5) * 1500 } // pkg with 3 installs
  }))
})
