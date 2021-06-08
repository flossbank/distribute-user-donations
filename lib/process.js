exports.process = async ({ log, record, db, dynamo }) => {
  const {
    amount,
    timestamp,
    userId,
    description
  } = JSON.parse(record.body)

  // If no user id, throw
  if (!userId) throw Error('Undefined user id passed in')

  log.log({ amount, timestamp, userId, description })
  // Subtract 3% for stripe percentage fee and 3% for our fee
  // Subtract 30 cents for stripe base charge
  const donationAmount = (amount * 0.94) - 30

  // If another lambda has already picked up this transaction, it'll be locked on user id
  // preventing us from double paying packages from a users donation.
  // This will throw if it's locked
  const lockInfo = await dynamo.lockUser({ userId })
  log.log({ lockInfo })

  const packageWeightsMap = await db.createPackageWeightsMap({ userId })
  await db.distributeUserDonation({ donationAmount, packageWeightsMap, userId, description })
  await dynamo.unlockUser({ userId })

  log.log({ userId, donationAmount, description })
  return { success: true }
}
