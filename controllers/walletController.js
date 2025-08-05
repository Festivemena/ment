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
    // Generate unique reference
    const reference = `dep_${Date.now()}_${user._id}`;

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        "email": user.email,
        "amount": parseInt(amount * 100),
        "reference": reference,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { authorization_url } = paystackRes.data.data;

    // Create pending transaction
    await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      reference: reference,
      description: `Wallet deposit of ₦${amount}`,
    });

    await createNotification(
      req.user._id,
      'deposit',
      'Deposit Started',
      `You started a deposit of ₦${amount}.`
    );

    res.status(200).json({ 
      message: 'Deposit initiated', 
      authorization_url,
      reference 
    });
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Deposit failed', error: error.message });
  }
};

// HANDLE PAYSTACK WEBHOOK
exports.handlePaystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  
  if (!signature) {
    return res.status(401).json({ message: 'No signature provided' });
  }

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.body;

  try {
    if (event.event === 'charge.success') {
      const { amount, customer, reference } = event.data;
      
      // Find the transaction
      const transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        console.error('Transaction not found:', reference);
        return res.sendStatus(404);
      }

      // Find the user
      const user = await User.findById(transaction.user);
      if (!user) {
        console.error('User not found for transaction:', reference);
        return res.sendStatus(404);
      }

      // Update user wallet and transaction
      user.wallet.balance += amount / 100;
      await user.save();

      transaction.status = 'success';
      await transaction.save();

      await createNotification(
        user._id,
        'deposit',
        'Deposit Successful',
        `₦${amount / 100} was added to your wallet.`
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.sendStatus(500);
  }
};

// REGISTER BANK DETAILS
exports.addBankDetails = async (req, res) => {
  const { account_number, bank_code, name } = req.body;

  // Step 1: Validate Inputs
  if (!account_number || !bank_code || !name) {
    return res.status(400).json({ message: 'Account number, bank code, and name are required' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Step 2: Resolve/Verify the Account
    const verifyRes = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const resolvedName = verifyRes.data.data.account_name;

    // Step 3: (Optional) Basic name match check
    // const inputName = name.toLowerCase().trim();
    // const paystackName = resolvedName.toLowerCase().trim();

    // const nameMatches = paystackName.includes(inputName) || inputName.includes(paystackName);
   // if (!nameMatches) {
 //     return res.status(400).json({
       // message: `Account name mismatch. Paystack returned "${resolvedName}". Please check and try again.`,
//      });
//    }

    // Step 4: Create Transfer Recipient
    const recipientRes = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: 'nuban',
        name: resolvedName, // use the resolved name to ensure accuracy
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

    const recipient_code = recipientRes.data.data.recipient_code;

    // Step 5: Save to DB
    user.bankDetails = {
      account_number,
      bank_code,
      account_name: resolvedName,
      recipient_code,
    };
    await user.save();

    return res.status(200).json({
      message: 'Bank details added successfully',
      bankDetails: user.bankDetails,
    });
  } catch (err) {
    console.error('Add bank error:', err.response?.data || err.message);

    // Handle Paystack validation or 422 errors better
    if (err.response?.data?.message) {
      return res.status(400).json({ message: err.response.data.message });
    }

    return res.status(500).json({
      message: 'Failed to add bank details',
      error: err.message,
    });
  }
};

// WITHDRAW FROM WALLET
exports.withdraw = async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user._id);

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  if (amount > user.wallet.balance) {
    return res.status(400).json({ message: 'Insufficient funds' });
  }

  if (!user.bankDetails?.recipient_code) {
    return res.status(400).json({ message: 'Please add your bank details first' });
  }

  try {
    const reference = `wd_${Date.now()}_${user._id}`;

    const transferRes = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: amount * 100,
        recipient: user.bankDetails.recipient_code,
        reason: 'Wallet Withdrawal',
        reference: reference,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Deduct from wallet
    user.wallet.balance -= amount;
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount,
      reference: reference,
      description: 'Wallet withdrawal to bank account',
    });

    await createNotification(
      user._id,
      'withdrawal',
      'Withdrawal Successful',
      `You withdrew ₦${amount} from your wallet.`
    );

    res.status(200).json({
      message: 'Withdrawal initiated successfully',
      reference: reference,
      transfer: transferRes.data.data,
    });
  } catch (err) {
    console.error('Withdrawal error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Withdrawal failed', error: err.message });
  }
};

// CREATE BOOKING AND SPLIT PAYMENT
exports.bookCreative = async (req, res) => {
  const { creative_id, date_time, location, total_price } = req.body;

  if (!creative_id || !date_time || !location || !total_price) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const client = await User.findById(req.user._id);
    const creative = await User.findById(creative_id);

    if (!creative || creative.role !== 'creative') {
      return res.status(404).json({ message: 'Creative not found' });
    }

    if (client.wallet.balance < total_price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const upfront = total_price * 0.25;
    const hold = total_price * 0.75;

    // Update wallet balances
    client.wallet.balance -= total_price;
    creative.wallet.balance += upfront;

    await client.save();
    await creative.save();

    // Create booking
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

    // Create transaction records
    const bookingRef = `bk_${Date.now()}_${booking._id}`;
    const payoutRef = `po_${Date.now()}_${booking._id}`;

    await Transaction.create({
      user: client._id,
      type: 'booking',
      amount: total_price,
      reference: bookingRef,
      description: `Booking payment to ${creative.userName || creative.firstName}`,
      metadata: { creativeId: creative._id, bookingId: booking._id },
    });

    await Transaction.create({
      user: creative._id,
      type: 'payout',
      amount: upfront,
      reference: payoutRef,
      description: `Upfront from ${client.userName || client.firstName} for booking`,
      metadata: { clientId: client._id, bookingId: booking._id },
    });

    // Send notifications
    await createNotification(
      client._id,
      'booking',
      'Booking Confirmed',
      `You booked ${creative.userName || creative.firstName} for ₦${total_price}.`
    );

    await createNotification(
      creative._id,
      'booking',
      'New Booking',
      `${client.userName || client.firstName} booked you. You've received ₦${upfront} upfront.`
    );

    res.status(201).json({ 
      message: 'Booking created successfully', 
      booking,
      upfront_received: upfront,
      hold_amount: hold
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
};

// COMPLETE BOOKING AND RELEASE HOLD
exports.completeBooking = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findById(bookingId)
      .populate('client_id', 'userName firstName')
      .populate('creative_id', 'userName firstName');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'ongoing') {
      return res.status(400).json({ message: 'Booking is not in ongoing status' });
    }

    const creative = await User.findById(booking.creative_id);
    
    // Release hold amount
    creative.wallet.balance += booking.holdAmount;
    await creative.save();

    // Create transaction record
    const payoutRef = `final_${Date.now()}_${booking._id}`;
    await Transaction.create({
      user: creative._id,
      type: 'payout',
      amount: booking.holdAmount,
      reference: payoutRef,
      description: `Final payout from booking completion`,
      metadata: { bookingId: booking._id },
    });

    // Update booking
    booking.holdAmount = 0;
    booking.status = 'completed';
    await booking.save();

    // Send notifications
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
      `Your booking with ${creative.userName || creative.firstName} was marked as completed.`
    );

    res.status(200).json({ 
      message: 'Booking completed successfully, payment released',
      booking
    });
  } catch (error) {
    console.error('Booking completion error:', error);
    res.status(500).json({ message: 'Failed to complete booking', error: error.message });
  }
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

    // Check if user has already rated this creative
    const existingReview = creative.reviews.find(
      review => review.client_id.toString() === clientId
    );

    if (existingReview) {
      return res.status(400).json({ message: 'You have already rated this creative.' });
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
    console.error('Rating error:', err);
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

    // Create transaction records
    const tipRefClient = `tip_out_${Date.now()}_${clientId}`;
    const tipRefCreative = `tip_in_${Date.now()}_${creativeId}`;

    await Transaction.create({
      user: clientId,
      type: 'tip',
      amount,
      reference: tipRefClient,
      description: `Tip sent to ${creative.userName || creative.firstName}`,
      metadata: { creativeId },
    });

    await Transaction.create({
      user: creative._id,
      type: 'tip',
      amount,
      reference: tipRefCreative,
      description: `Tip received from ${client.userName || client.firstName}`,
      metadata: { clientId },
    });

    // Notifications
    await createNotification(
      clientId,
      'tip',
      'You Tipped a Creative',
      `You sent ₦${amount} to ${creative.userName || creative.firstName}.`
    );

    await createNotification(
      creative._id,
      'tip',
      'You Got Tipped!',
      `You received ₦${amount} from ${client.userName || client.firstName}.`
    );

    res.status(200).json({
      message: `Successfully tipped ₦${amount} to ${creative.userName || creative.firstName}`
    });
  } catch (err) {
    console.error('Tip error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
