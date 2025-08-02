const mongoose = require('mongoose');
const slugify = require('slugify');
const Role = require('../models/RolesList');

// Utility: Generate subcategory object
const generateSubcategory = (roleName, name) => ({
  id: new mongoose.Types.ObjectId().toString(),
  name,
  slug: slugify(`${roleName}-${name}`, { lower: true, strict: true }),
});

// Get all roles (just id, name, slug)
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}, '_id name slug');
    const formatted = roles.map((role) => ({
      id: role._id,
      name: role.name,
      slug: role.slug,
    }));

    res.status(200).json({ data: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error getting roles' });
  }
};

// Get subcategories for one role (by slug)
exports.getSubcategoriesByRoleSlug = async (req, res) => {
  try {
    const { roleSlug } = req.params;
    const role = await Role.findOne({ slug: roleSlug }, 'subcategories');

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const subcategories = role.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
    }));

    res.status(200).json({ data: subcategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error getting subcategories' });
  }
};

// Create a new role (admin only)
exports.createRole = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existing = await Role.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ error: 'Role name already exists' });
    }

    const role = await Role.create({ name: name.trim() });
    res.status(201).json({ message: 'Role created', role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while creating role' });
  }
};

// Add subcategories to a role (admin only)
exports.addSubcategoriesToRole = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { roleId } = req.params;
    let { subcategories, subcategory } = req.body;

    if (subcategory && !subcategories) subcategories = [subcategory];
    if (!Array.isArray(subcategories) || subcategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one subcategory',
        errorCode: 'NO_SUBCATEGORIES_PROVIDED',
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
        errorCode: 'ROLE_NOT_FOUND',
      });
    }

    const existingSlugs = new Set(role.subcategories.map((s) => s.slug));

    const newSubcategories = subcategories
      .map((name) => generateSubcategory(role.name, name))
      .filter((sub) => !existingSlugs.has(sub.slug));

    if (newSubcategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All subcategories already exist',
        errorCode: 'SUBCATEGORY_EXISTS',
      });
    }

    role.subcategories.push(...newSubcategories);
    await role.save();

    res.status(200).json({ message: 'Subcategories added', added: newSubcategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while adding subcategories' });
  }
};

// Update role name and subcategory slugs
exports.updateRole = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { roleId } = req.params;
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const previous = {
      name: role.name,
      slug: role.slug,
    };

    role.name = name;
    role.slug = slug;

    role.subcategories = role.subcategories.map((sub) => ({
      ...sub.toObject(),
      slug: slugify(`${name}-${sub.name}`, { lower: true, strict: true }),
    }));

    await role.save();

    res.status(200).json({
      message: 'Role updated',
      changes: {
        name: { before: previous.name, after: role.name },
        slug: { before: previous.slug, after: role.slug },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while updating role' });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { roleId } = req.params;
    const deletedRole = await Role.findByIdAndDelete(roleId);

    if (!deletedRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.status(200).json({ message: 'Role deleted', role: deletedRole });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while deleting role' });
  }
};

// Delete subcategories
exports.deleteSubcategoriesFromRole = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { roleId } = req.params;
    let { subcategories = [], subcategory } = req.body;

    if (subcategory && subcategories.length === 0) {
      subcategories = [subcategory];
    }

    if (!Array.isArray(subcategories) || subcategories.length === 0) {
      return res.status(400).json({ error: 'Provide subcategory IDs to delete' });
    }

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const beforeCount = role.subcategories.length;

    role.subcategories = role.subcategories.filter(
      (sub) => !subcategories.includes(sub.id)
    );

    if (role.subcategories.length === beforeCount) {
      return res.status(400).json({ error: 'No matching subcategories found' });
    }

    await role.save();
    res.status(200).json({ message: 'Subcategories deleted', deleted: subcategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while deleting subcategories' });
  }
};
