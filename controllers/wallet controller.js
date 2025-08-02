const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Booking = require('../models/Booking');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// INITIATE DEPOSIT
exports.initiateDeposit = async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  try {
    const paystackRes = await axios.post(
      'https://api.paystack.com/transaction/initialize',
      {
        email: req.user.email,
        amount: amount * 100,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { authorization_url } = paystackRes.data.data;
    res.status(200).json({ message: 'Deposit initiated', authorization_url });
  } catch (err) {
    res.status(500).json({ message: 'Deposit failed', error: err.message });
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
      'https://api.paystack.com/transferrecipient',
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
    location,
    total_price,
    holdAmount: hold,
    status: 'ongoing',
  });

  await booking.save();

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
  booking.holdAmount = 0;
  booking.status = 'completed';

  await creative.save();
  await booking.save();

  res.status(200).json({ message: 'Booking completed, payment released' });
};