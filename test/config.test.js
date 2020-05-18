const test = require('ava')
const Config = require('../lib/config')

test('getMongoUri decrypts with kms', async (t) => {
  const config = new Config({
    kms: {
      decrypt: () => ({
        promise: async () => ({
          Plaintext: Buffer.from('abc')
        })
      })
    }
  })

  process.env.MONGO_URI = Buffer.from('abc').toString('base64')
  const mongoUri = await config.getMongoUri()
  t.deepEqual(mongoUri, 'abc')
})
