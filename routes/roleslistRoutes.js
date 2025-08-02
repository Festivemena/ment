const express = require('express');
const router = express.Router();

const {
  getRoles,
  getSubcategoriesByRoleSlug,
  createRole,
  addSubcategoriesToRole,
  updateRole,
  deleteRole,
  deleteSubcategoriesFromRole,
} = require('../controllers/roleslistController');

const { protect } = require('../middleware/authMiddleware');

// Public Route — anyone can view roles and subcategories
router.get('/', getRoles);
router.get('/roles/:roleSlug/subcategories', getSubcategoriesByRoleSlug);


//  Protected Admin Routes
router.post('/', protect, createRole);
router.patch('/:roleId', protect, updateRole);
router.patch('/:roleId/subcategories', protect, addSubcategoriesToRole);
router.patch('/:roleId/subcategories/delete', protect, deleteSubcategoriesFromRole);
router.delete('/:roleId', protect, deleteRole);

module.exports = router;

