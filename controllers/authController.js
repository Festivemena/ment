const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const sendEmail = require('../middleware/sendEmail');

// Send cookie helper
const sendTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
      referredBy = referrer.referralCode;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    await Otp.create({
      email,
      code: otpCode,
      password: hashedPassword,
      referredBy, // Store referral for later
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendEmail(email, 'Your PICME OTP Code', otpCode);

    res.status(200).json({ message: 'OTP sent to email. Please verify to complete registration.' });
  } catch (error) {
    next(error);
  }
};

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

exports.confirmOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const existingOtp = await Otp.findOne({ email, code: otp });

    if (!existingOtp || existingOtp.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
// Generate a unique referral code for the new user
    let newReferralCode;
    let referralExists = true;
    while (referralExists) {
      newReferralCode = generateReferralCode();
      referralExists = await User.findOne({ referralCode: newReferralCode });
    }


    // Create new user first
    const newUser = new User({
  email,
  password: existingOtp.password,
  isCompleted: false,
  referralCode: newReferralCode,
  referredBy: existingOtp.referredBy || null,
  location: {
    type: 'Point',
    coordinates: [0, 0],
  },
});

    const savedUser = await newUser.save();

    // Generate token after saving to get user ID
    const payload = { id: savedUser._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Save token to user
    savedUser.token = token;
    await savedUser.save();

    // Remove OTP record after successful registration
    await Otp.deleteOne({ email });

    // Set cookie with token
    sendTokenCookie(res, token);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: savedUser._id,
        role: savedUser.role,
        email: savedUser.email,
        location: savedUser.location,
        created_at: savedUser.created_at,
      },
    });
  } catch (error) {
    console.error('Error in confirmOtp:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = user.token;
    if (!token) {
      return res.status(500).json({ message: 'Token missing from user record' });
    }

    const profileCompleted = user.isCompleted === true || user.isCompleted === 'true';

    if (!profileCompleted) {
      return res.status(403).json({
        message: 'Profile is incomplete. Please complete your profile to proceed.',
        profileCompleted: false,
      });
    }

    sendTokenCookie(res, token);

    res.status(200).json({
      message: 'Login successful',
      token,
      profileCompleted: true,
      user: {
        _id: user._id,
        role: user.role,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        location: user.location,
        bio: user.bio,
        skill: user.skill,
        pricing: user.pricing,
        availability: user.availability,
        avg_rating: user.avg_rating,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    await Otp.findOneAndUpdate(
      { email },
      {
        code: otpCode,
        password: user.password, // Keep existing password
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      { upsert: true }
    );

    await sendEmail(email, 'Reset Your Password - PICME OTP', `Your OTP code is: ${otpCode}`);

    res.status(200).json({ message: 'OTP sent to email for password reset' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }

    const otpRecord = await Otp.findOne({ email, code: otp });

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await Otp.deleteOne({ email });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingOtp = await Otp.findOne({ email });

    if (!existingOtp) {
      return res.status(404).json({ message: 'No pending registration found for this email' });
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    existingOtp.code = newOtp;
    existingOtp.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await existingOtp.save();

    await sendEmail(email, 'Your Resent OTP Code', `Your new OTP code is: ${newOtp}`);

    res.status(200).json({ message: 'OTP resent successfully' });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};