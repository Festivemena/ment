// controllers/savedProductsController.js
const SavedProduct = require('../models/SavedProduct');
const Product = require('../models/product');
const { createNotification } = require('./notificationController');

// Save a product for later
exports.saveProduct = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if already saved
    const existingSave = await SavedProduct.findOne({ user: userId, product: productId });
    if (existingSave) {
      return res.status(400).json({
        success: false,
        message: 'Product already saved'
      });
    }

    // Create saved product entry
    const savedProduct = await SavedProduct.create({
      user: userId,
      product: productId
    });

    // Create notification for the product owner
    await createNotification(
      product.user_id,
      'product',
      'Product Saved',
      `${req.user.userName || req.user.firstName} saved your product "${product.title}"`
    );

    res.status(201).json({
      success: true,
      message: 'Product saved successfully',
      savedProduct
    });
  } catch (error) {
    next(error);
  }
};

// Remove a saved product
exports.unsaveProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const savedProduct = await SavedProduct.findOneAndDelete({
      user: userId,
      product: productId
    });

    if (!savedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Saved product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product removed from saved items'
    });
  } catch (error) {
    next(error);
  }
};

// Get all saved products for a user
exports.getSavedProducts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const savedProducts = await SavedProduct.find({ user: userId })
      .populate({
        path: 'product',
        populate: {
          path: 'user_id',
          select: 'firstName lastName userName profilePic'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SavedProduct.countDocuments({ user: userId });

    // Filter out any saved products where the product was deleted
    const validSavedProducts = savedProducts.filter(saved => saved.product);

    res.json({
      success: true,
      savedProducts: validSavedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Check if a product is saved by the user
exports.isProductSaved = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const savedProduct = await SavedProduct.findOne({
      user: userId,
      product: productId
    });

    res.json({
      success: true,
      isSaved: !!savedProduct
    });
  } catch (error) {
    next(error);
  }
};

// Get saved products statistics
exports.getSavedProductsStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const stats = await SavedProduct.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'productInfo.user_id',
          foreignField: '_id',
          as: 'creativeInfo'
        }
      },
      { $unwind: '$creativeInfo' },
      {
        $group: {
          _id: '$creativeInfo.skill.type',
          count: { $sum: 1 },
          latestSaved: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalSaved = await SavedProduct.countDocuments({ user: userId });

    res.json({
      success: true,
      stats: {
        totalSaved,
        byCategory: stats
      }
    });
  } catch (error) {
    next(error);
  }
};
