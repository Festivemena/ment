const User = require('../models/User');

// 1. Get creatives by category
exports.getCreativesByCategory = async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    const creatives = await User.find({
      role: 'creative',
      'skill.type': category
    });

    res.status(200).json({ creatives });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 2. Get creatives by category & section
exports.getCreativesBySection = async (req, res) => {
  try {
    const { category, section } = req.params;

    const creatives = await User.find({
      role: 'creative',
      'skill.type': category.toLowerCase(),
      'subsection.section': section.toLowerCase()
    });

    res.status(200).json({ creatives });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 3. Filter creatives by delivery time and skill level
exports.filterCreatives = async (req, res) => {
  try {
    const { deliveryTime, skillLevel } = req.query;

    const query = {
      role: 'creative',
    };

    if (deliveryTime) query.deliveryTime = deliveryTime;
    if (skillLevel) query['skill.level'] = skillLevel;

    const creatives = await User.find(query);
    res.status(200).json({ creatives });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 4. Get creatives by nearest proximity
exports.getCreativesNearby = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const radiusInRadians = radius / 6378.1;

    const creatives = await User.find({
      role: 'creative',
      location: {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians],
        },
      },
    });

    res.status(200).json({ creatives });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};