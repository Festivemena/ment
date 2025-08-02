const fs = require('fs');
const sanityClient = require('../sanity-studio/sanityClient');
const Product = require('../models/product');


const createProduct = async (req, res) => {
  try {
    const { title } = req.body;
    const files = req.files || [];
    const userId = req.user.id;
    let sanityAssets = [];

    for (const file of files) {
      const ext = file.mimetype.startsWith('image') ? 'image' : 'file';
      const filePath = file.path;

      try {
        const asset = await sanityClient.assets.upload(ext, fs.createReadStream(filePath), {
          filename: file.originalname,
        });

        sanityAssets.push({
          type: ext,
          url: asset.url,
          sanityId: asset._id,
        });

        // Create Sanity document referencing the asset
        if (ext === 'image') {
          await sanityClient.create({
            _type: 'productImg',
            title: file.originalname,
            images: [
              {
                _type: 'image',
                asset: {
                  _type: 'reference',
                  _ref: asset._id,
                },
              },
            ],
          });
        } else {
          await sanityClient.create({
            _type: 'productVideo',
            title: file.originalname,
            video: {
              _type: 'file',
              asset: {
                _type: 'reference',
                _ref: asset._id,
              },
            },
          });
        }

        // Delete local file
        await fs.promises.unlink(filePath);
      } catch (uploadErr) {
        console.error(`Upload failed for ${filePath}:`, uploadErr);
        await fs.promises.unlink(filePath).catch(() => {});
        return res.status(500).json({
          error: `Upload failed for ${file.originalname}`,
          detail: uploadErr.message,
        });
      }
    }

    // Create MongoDB product
    const newProduct = await Product.create({
      title,
      user_id: userId,
      media: sanityAssets,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
};


const getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  try {
    const products = await Product.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments();

    res.json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const getAllUserProducts = async (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  try {
    const products = await Product.find({ user_id: userId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments({ user_id: userId });

    res.json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findOne({ _id: id});

    if (!product) return res.status(404).json({ message: 'Product not found' });

    Object.assign(product, updates);
    await product.save();

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
};


const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndDelete({ _id: id});

    if (!product) return res.status(404).json({ message: 'Product not found or already deleted' });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
getAllUserProducts,
  deleteProduct,
};
