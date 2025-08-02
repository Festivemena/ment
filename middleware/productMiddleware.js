const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});


const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif'];
  const videoExts = ['.mp4', '.mov', '.avi'];

  if (imageExts.includes(ext) || videoExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 20 } // 20MB max
});

module.exports = upload;
