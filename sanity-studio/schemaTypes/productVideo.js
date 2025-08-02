export default {
  name: 'productVideo',
  type: 'document',
  title: 'Product Video',
  fields: [
    {
      name: 'title',
      type: 'string',
      title: 'Title'
    },
    {
      name: 'video',
      type: 'file',
      title: 'Product Video (Only one)',
      options: {
        accept: 'video/*'
      },
      validation: Rule => Rule.required().error('Video is required')
    }
  ]
}
