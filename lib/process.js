exports.process = async ({ log, record, db, dynamo }) => {
  const {
    amount,
    timestamp,
    customerId,
    description,
  } = JSON.parse(record.body)

  log({ amount, timestamp, customerId, description })
  const userId = await db.findUserId({ customerId })
  // If another lambda has already picked up this transaction, it'll be locked on user id
  // preventing us from double paying packages from a users donation. 
  // This will throw if it's locked
  const lockInfo = await dynamo.lockUser(userId)
  log({ lockInfo })
  const packageWeightsMap = await db.createPackageWeightsMap({ userId })
  await db.distributeUserDonation({ amount, packageWeightsMap })

  await dynamo.unlockUser(userId)

  log({ customerId, amount, description })
  return { success: true }
}
