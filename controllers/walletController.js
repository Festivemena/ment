const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// INITIATE DEPOSIT
exports.initiateDeposit = async (req, res) => {
  const { amount } = req.body;
 const user = req.user;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  try {
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        "email": user.email,
        "amount": parseInt(amount * 100)
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { authorization_url } = paystackRes.data.data;

    await createNotification(
      req.user._id,
      'deposit',
      'Deposit Started',
      `You started a deposit of ₦${amount}.`
    );

    res.status(200).json({ message: 'Deposit initiated', authorization_url });
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Deposit failed', error: error.message });
  }
};

// HANDLE PAYSTACK WEBHOOK
exports.handlePaystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) return res.sendStatus(401);

  const event = req.body;

  if (event.event === 'charge.success') {
    const { amount, customer } = event.data;
    const user = await User.findOne({ email: customer.email });

    if (user) {
      user.wallet.balance += amount / 100;
      await user.save();
await Transaction.create({
  user: user._id,
  type: 'deposit',
reference: reference,
  amount: amount / 100,
  description: 'Wallet deposit via Paystack',
});

      await createNotification(
        user._id,
        'deposit',
        'Deposit Successful',
        `₦${amount / 100} was added to your wallet.`
      );
    }
  }

  res.sendStatus(200);
};

// REGISTER BANK DETAILS
exports.addBankDetails = async (req, res) => {
  const { account_number, bank_code, name } = req.body;
  const user = await User.findById(req.user._id);

  try {
    const recipientRes = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: 'nuban',
        name,
        account_number,
        bank_code,
        currency: 'NGN',
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    user.bankDetails = {
      account_number,
      bank_code,
      recipient_code: recipientRes.data.data.recipient_code,
    };

    await user.save();
    res.status(200).json({ message: 'Bank details added' });
  } catch (err) {
    res.status(500).json({ message: 'Bank registration failed', error: err.message });
  }
};

// WITHDRAW FROM WALLET
exports.withdraw = async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user._id);

  if (amount <= 0 || amount > user.wallet.balance) {
    return res.status(400).json({ message: 'Insufficient funds' });
  }

  try {
    const transferRes = await axios.post(
      'https://api.paystack.com/transfer',
      {
        source: 'balance',
        amount: amount * 100,
        recipient: user.bankDetails.recipient_code,
        reason: 'Wallet Withdrawal',
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    user.wallet.balance -= amount;
    await user.save();
await Transaction.create({
  user: user._id,
  type: 'withdrawal',
  amount,
  description: 'Wallet withdrawal to bank account',
});

    await createNotification(
      user._id,
      'withdrawal',
      'Withdrawal Successful',
      `You withdrew ₦${amount} from your wallet.`
    );

    res.status(200).json({
      message: 'Withdrawal initiated',
      transfer: transferRes.data.data,
    });
  } catch (err) {
    res.status(500).json({ message: 'Withdrawal failed', error: err.message });
  }
};

// CREATE BOOKING AND SPLIT PAYMENT
exports.bookCreative = async (req, res) => {
  const { creative_id, date_time, location, total_price } = req.body;

  const client = await User.findById(req.user._id);
  const creative = await User.findById(creative_id);

  if (client.wallet.balance < total_price) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  const upfront = total_price * 0.25;
  const hold = total_price * 0.75;

  client.wallet.balance -= total_price;
  creative.wallet.balance += upfront;

  await client.save();
  await creative.save();

  const booking = new Booking({
    client_id: client._id,
    creative_id,
    date_time,
          location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      },
    total_price,
    holdAmount: hold,
    status: 'ongoing',
  });

  await booking.save(); 

await Transaction.create({
  user: client._id,
  type: 'booking',
  amount: total_price,
  description: `Booking payment to ${creative.userName}`,
  metadata: { creativeId: creative._id, bookingId: booking._id },
});

await Transaction.create({
  user: creative._id,
  type: 'payout',
  amount: upfront,
  description: `Upfront from ${client.userName} for booking`,
  metadata: { clientId: client._id, bookingId: booking._id },
});

  await createNotification(
    client._id,
    'booking',
    'Booking Confirmed',
    `You booked ${creative.userName} for ₦${total_price}.`
  );

  await createNotification(
    creative._id,
    'booking',
    'New Booking',
    `${client.userName} booked you. You've received ₦${upfront} upfront.`
  );

  res.status(201).json({ message: 'Booking created', booking });
};

// COMPLETE BOOKING AND RELEASE HOLD
exports.completeBooking = async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId);
  const creative = await User.findById(booking.creative_id);

  if (!booking || booking.status !== 'ongoing') {
    return res.status(400).json({ message: 'Invalid booking' });
  }

  creative.wallet.balance += booking.holdAmount;

await Transaction.create({
  user: creative._id,
  type: 'payout',
  amount: booking.holdAmount,
  description: `Final payout from booking with client`,
  metadata: { bookingId: booking._id },
});

  await createNotification(
    creative._id,
    'booking',
    'Booking Completed',
    `You received ₦${booking.holdAmount} from a completed booking.`
  );

  await createNotification(
    booking.client_id,
    'booking',
    'Booking Completed',
    `Your booking with ${creative.userName} was marked as completed.`
  );

  booking.holdAmount = 0;
  booking.status = 'completed';

  await creative.save();
  await booking.save();

  res.status(200).json({ message: 'Booking completed, payment released' });
};

// ⭐ Rate a creative
exports.rateCreative = async (req, res) => {
  try {
    const { creativeId } = req.params;
    const { rating, comment } = req.body;
    const clientId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const creative = await User.findById(creativeId);
    if (!creative || creative.role !== 'creative') {
      return res.status(404).json({ message: 'Creative not found.' });
    }

    // Add review
    creative.reviews.push({ client_id: clientId, rating, comment });

    // Update average rating
    const totalRatings = creative.reviews.reduce((sum, r) => sum + r.rating, 0);
    creative.avg_rating = totalRatings / creative.reviews.length;

    await creative.save();

    // Send notification to creative
    await createNotification(
      creative._id,
      'rating',
      'You Got a Review!',
      `${req.user.userName || 'A client'} rated you ${rating} star${rating > 1 ? 's' : ''}.`
    );

    res.status(200).json({
      message: 'Review submitted successfully.',
      avg_rating: creative.avg_rating
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 💸 Tip a creative
exports.tipCreative = async (req, res) => {
  try {
    const { creativeId } = req.params;
    const { amount } = req.body;
    const clientId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }

    const creative = await User.findById(creativeId);
    const client = await User.findById(clientId);

    if (!creative || creative.role !== 'creative') {
      return res.status(404).json({ message: 'Creative not found.' });
    }

    if (!client || client.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Adjust wallet balances
    client.wallet.balance -= amount;
    creative.wallet.balance += amount;

    await client.save();
    await creative.save();
await Transaction.create({
  user: clientId,
  type: 'tip',
  amount,
  description: `Tip sent to ${creative.userName}`,
  metadata: { creativeId },
});

await Transaction.create({
  user: creative._id,
  type: 'tip',
  amount,
  description: `Tip received from ${client.userName}`,
  metadata: { clientId },
});

    // Notifications
    await createNotification(
      clientId,
      'tip',
      'You Tipped a Creative',
      `You sent ₦${amount} to ${creative.userName}.`
    );

    await createNotification(
      creative._id,
      'tip',
      'You Got Tipped!',
      `You received ₦${amount} from ${client.userName}.`
    );

    res.status(200).json({
      message: `Successfully tipped ₦${amount} to ${creative.userName}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};