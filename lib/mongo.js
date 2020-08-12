const { MongoClient, ObjectId } = require('mongodb')

const MONGO_DB = 'flossbank_db'
const PACKAGES_COLLECTION = 'packages'

class Mongo {
  constructor ({ config }) {
    this.config = config
    this.db = null
    this.mongoClient = null
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

  async createPackageWeightsMap ({ userId }) {
    const weightsMap = new Map()
    const userInstalledPackages = await this.db.collection(PACKAGES_COLLECTION).aggregate([
      {
        $project: { installs: 1 }
      }, {
        $match: { 'installs.userId': userId }
      }, {
        $unwind: { path: '$installs' }
      }, {
        $match: {
          'installs.userId': userId,
          'installs.fraudSession': { $ne: true }
        }
      }, {
        $group: {
          _id: '$_id',
          weight: { $sum: '$installs.weight' }
        }
      }
    ]).toArray()
    // Could do this in a .map on the above lines but want to isolate logic
    for (const pkg of userInstalledPackages) {
      weightsMap.set(pkg._id, pkg.weight)
    }

    return weightsMap
  }

  async distributeUserDonation ({ donationAmount, packageWeightsMap, userId }) {
    // If there are no installs yet - i.e. a user JUST signed up, bail on distribution
    if (!packageWeightsMap.size) {
      return
    }

    const totalMassOfUsersImpact = Array.from(packageWeightsMap.values()).reduce((acc, val) => acc + val, 0)
    const packageIds = packageWeightsMap.keys()

    const bulkUpdates = this.db.collection(PACKAGES_COLLECTION).initializeUnorderedBulkOp()
    for (const id of packageIds) {
      const packageWeight = packageWeightsMap.get(id)
      const packagePortion = packageWeight / totalMassOfUsersImpact
      const packageShareOfDonation = packagePortion * donationAmount
      bulkUpdates.find({ _id: ObjectId(id) }).updateOne({
        $push: {
          donationRevenue: { userId, amount: packageShareOfDonation, timestamp: Date.now() }
        }
      })
    }
    return bulkUpdates.execute()
  }
}

module.exports = Mongo
