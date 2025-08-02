export default {
  name: 'productImg',
  type: 'document',
  title: 'Product Images',
  fields: [
    {
      name: 'title',
      type: 'string',
      title: 'Title'
    },
    {
      name: 'images',
      type: 'array',
      title: 'Product Images (max 5)',
      of: [{ type: 'image' }],
      validation: Rule => Rule.max(5).error('You can upload up to 5 images only')
    }
  ]
}
