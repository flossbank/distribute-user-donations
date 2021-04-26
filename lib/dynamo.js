class Dynamo {
  constructor ({ docs }) {
    this.docs = docs
    this.LOCKS_TABLE = 'flossbank_locks'
    this.LOCK_TIMEOUT = 240 * 1000 // 4mins in ms, same as max execution time of lambda
  }

  async lockUser ({ userId }) {
    // get lock info from flossbank_lambda_locks table
    // and lock on the user id for processing
    const { Attributes: lockInfo } = await this.docs.update({
      TableName: this.LOCKS_TABLE,
      Key: { lock_key: userId },
      UpdateExpression: 'SET locked_until = :lockTimeout',
      ConditionExpression: 'attribute_not_exists(locked_until) OR locked_until < :now',
      ExpressionAttributeValues: {
        ':lockTimeout': Date.now() + this.LOCK_TIMEOUT,
        ':now': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    }).promise()
    return lockInfo
  }

  async unlockUser ({ userId }) {
    return this.docs.delete({
      TableName: this.LOCKS_TABLE,
      Key: { lock_key: userId }
    }).promise()
  }
}

module.exports = Dynamo
