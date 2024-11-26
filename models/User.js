const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['admin', 'user']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationOTP: String,
  otpExpiry: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});


userSchema.methods.compareHash = async function (input, type) {
  if (type !== 'password' && type !== 'verificationOTP') {
      throw new Error(`Invalid type specified: ${type}`);
  }

  const hashToCompare = type === 'password' ? this.password : this.verificationOTP;
  
  if (!hashToCompare) {
      throw new Error(`Hash not found for type: ${type}`);
  }

  return await bcrypt.compare(input, hashToCompare);  
};
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
      try {
          const salt = await bcrypt.genSalt(10);
          this.password = await bcrypt.hash(this.password, salt);
      } catch (error) {
          return next(error);
      }
  }

  if (this.isModified('verificationOTP') && this.verificationOTP) {
      try {
          const salt = await bcrypt.genSalt(10);
          this.verificationOTP = await bcrypt.hash(this.verificationOTP, salt);
      } catch (error) {
          return next(error);
      }
  }

  next();
});


module.exports = mongoose.model('User', userSchema);
