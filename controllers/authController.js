const bcrypt = require('bcrypt');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// Updated email transporter configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Add verification function
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    throw error;
  }
};

// Function to generate OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Updated send verification email function
const sendVerificationEmail = async (email, otp) => {
  try {
    await verifyEmailConfig(); // Verify configuration before sending

    const mailOptions = {
      from: `"Your App Name" <${process.env.EMAIL_USER}>`, // Add a proper from name
      to: email,
      subject: 'Email Verification for Your Account',
      html: `
        <h1>Email Verification</h1>
        <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
        <h2 style="color: #4CAF50; letter-spacing: 2px;">${otp}</h2>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Detailed email error:', error);
    throw error;
  }
};

// Register a new user
const registerUser = async (req, res) => {
  try {
    console.log('Registration attempt with payload:', {
      ...req.body,
      password: '[HIDDEN]',
      confirmPassword: '[HIDDEN]'
    });

    const { role, email, password } = req.body;

    // Validate required fields
    if (!role || !email || !password) {
      console.log('Missing required fields:', { 
        hasRole: !!role, 
        hasEmail: !!email, 
        hasPassword: !!password 
      });
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Hash the password
    console.log('Attempting to hash password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Create new user with verification fields
    const newUser = new User({
      role,
      email,
      password: hashedPassword,
      verificationOTP: otp,
      otpExpiry: otpExpiry,
      isVerified: false
    });

    // Save to the database
    console.log('Attempting to save user to database...');
    const savedUser = await newUser.save();
    console.log('User saved successfully with ID:', savedUser._id);

    // Send verification email
    try {
      await sendVerificationEmail(email, otp);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Delete the user if email sending fails
      await User.findByIdAndDelete(savedUser._id);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.status(201).json({ 
      message: 'Registration successful! Please check your email for verification OTP.',
      userId: savedUser._id
    });

  } catch (error) {
    console.error('Registration error details:', {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      fullError: error
    });

    if (error.code === 11000) {
      console.log('Duplicate email detected:', error.keyValue);
      return res.status(400).json({ error: 'Email already exists' });
    }

    if (error.name === 'ValidationError') {
      console.log('Validation error:', error.errors);
      return res.status(400).json({ 
        error: 'Validation error', 
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    console.error('Unhandled error during registration:', error);
    res.status(500).json({ 
      error: 'An error occurred during registration',
      details: error.message 
    });
  }
};

// Verify OTP
const verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user.verificationOTP !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'An error occurred during verification' });
  }
};

// Login a user
const loginUser = async (req, res) => {
  try {
    console.log('Login attempt for:', {
      email: req.body.email,
      hasPassword: !!req.body.password
    });

    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please provide both email and password' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    console.log('User found:', !!user);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(401).json({ 
        error: 'Please verify your email before logging in' 
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password validation:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Create user data to send back (excluding password)
    const userData = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    res.status(200).json({
      message: 'Login successful',
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'An error occurred during login',
      details: error.message 
    });
  }
};

module.exports = { registerUser, loginUser, verifyEmail };