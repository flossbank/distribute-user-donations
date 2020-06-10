exports.process = async ({ log, record, db, dynamo }) => {
  const {
    amount,
    timestamp,
    customerId,
    description
  } = JSON.parse(record.body)

  log({ amount, timestamp, customerId, description })
  const donationAmount = amount * 1000
  const userId = await db.findUserId({ customerId })
  if (!userId) throw Error('Cound not find user for customer id', customerId)
  // If another lambda has already picked up this transaction, it'll be locked on user id
  // preventing us from double paying packages from a users donation.
  // This will throw if it's locked
  const lockInfo = await dynamo.lockUser({ userId })
  log({ lockInfo })
  const packageWeightsMap = await db.createPackageWeightsMap({ userId })
  await db.distributeUserDonation({ donationAmount, packageWeightsMap, userId })

  await dynamo.unlockUser({ userId })

  log({ success: true, customerId, donationAmount, description })
  return { success: true }
}
