const { MongoClient } = require('mongodb')

const MONGO_DB = 'flossbank_db'
const PACKAGES_COLLECTION = 'packages'
const META_COLLECTION = 'meta'
const USER_COLLECTION = 'users'

class Mongo {
  constructor ({ config }) {
    this.config = config
    this.db = null
    this.mongoClient = null
    this.batchSize = 1000
  }

  async connect () {
    const mongoUri = await this.config.getMongoUri()
    this.mongoClient = new MongoClient(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    await this.mongoClient.connect()

    this.db = this.mongoClient.db(MONGO_DB)
  }

  async close () {
    if (this.mongoClient) return this.mongoClient.close()
  }

  async findUserId ({ customerId }) {
    return this.db.collection(USER_COLLECTION).findOne({
      'billingInfo.customerId': customerId 
    })
  }

  // TODO actually implement this
  async createPackageWeightsMap ({ userId }) {
    const result = (await this.db.collection(PACKAGES_COLLECTION).aggregate([
      {
        $match: { installs: { $ne: null } }
      },
      {
        $group: { _id: null, totalInstalls: { $sum: { $size: '$installs' } } }
      }
    ]).toArray()).pop()
    return { result: userId }
  }

  // TODO actually implement this
  async distributeUserDonation () {
    return { success: false }
  }
}

module.exports = Mongo
