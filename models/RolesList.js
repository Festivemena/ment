const mongoose = require('mongoose');
const slugify = require('slugify');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, unique: true },
  subcategories: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        slug: { type: String, required: true },
      },
    ],
    default: [],
  },
});

RoleSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  // Regenerate subcategory slugs too 
  if (this.isModified('subcategories')) {
    this.subcategories = this.subcategories.map((sub) => ({
      ...sub,
      slug: slugify(`${this.name}-${sub.name}`, { lower: true, strict: true }),
    }));
  }

  next();
});

const Role = mongoose.model('Role', RoleSchema);
module.exports = Role;
