const nodemailer=require("nodemailer");
const crypto=require("crypto");

const bcrypt = require('bcrypt');

require('dotenv').config(); 

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


  const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
  };

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


// const verifyOtp=async(inputOtp,storedOtp)=>{
//     try {
       
//         const isMatch = await bcrypt.compare(inputOtp, storedOtp);
//         return isMatch;  
//       } catch (error) {
//         throw new Error('Error during OTP verification');
//       }

// }
// Updated email transporter configuration


module.exports={sendVerificationEmail,generateOTP}