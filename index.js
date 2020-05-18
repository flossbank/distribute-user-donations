const AWS = require('aws-sdk')
const Process = require('./lib/process')
const Config = require('./lib/config')
const Db = require('./lib/mongo')
const Dynamo = require('./lib/dynamo')

const kms = new AWS.KMS({ region: 'us-west-2' })
const docs = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

/*
- Get session info from SQS event
- Lock session for processing so no other lambda duplicates the work
- Make sure amount is worth distribution
- Convert amount to microcents from cents (cents given to us by stripe)
- Find all packages installed by user in past month
- Create map of packages and their weights (sum weights across sessions)
- Find total mass of users impact
- For each package: distribute donation * fraction of each package weight / total mass in bulk op
*/
exports.handler = async (event) => {
  const log = console
  const dynamo = new Dynamo({ docs })
  const config = new Config({ kms })
  const db = new Db({ config })
  await db.connect()

  let results
  try {
    results = await Promise.all(
      event.Records.map(record => Process.process({ record, db, dynamo, log }))
    )
    if (!results.every(result => result.success)) {
      throw new Error(JSON.stringify(results))
    }
    return results
  } finally {
    await db.close()
  }
}
