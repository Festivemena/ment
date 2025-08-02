const { createClient } = require('@sanity/client')

const client = createClient({
  projectId: 'sy8gcqst',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-01-01',
  token: process.env.SANITY_TOKEN,
})

module.exports = client

