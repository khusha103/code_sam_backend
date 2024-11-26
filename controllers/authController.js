
const User = require('../models/User');

const { asyncHandler } = require('../utils/asyncHandler');
const { validateRequiredFields, validateEmail, validatePassword, validateOTP } = require('../utils/Validation');
const ApiError = require('../utils/ApiError');

const { ApiResponse } = require('../utils/ApiResponse');
const { generateOTP, sendVerificationEmail, verifyOtp } = require('../utils/helper');
const passport = require('passport');
require('dotenv').config();





const registerUser=asyncHandler(async(req,res)=>{
  const {email,password,role}=req.body;
  const requiredFieldErrors=validateRequiredFields({
    email,password
  });

  

  const validationChecks=[
    { isValid: !requiredFieldErrors, error: requiredFieldErrors },
        { isValid: validateEmail(email), error: "Invalid email format." },
        { isValid: validatePassword(password), error: "Password must be at least 6 characters long, include uppercase and lowercase letters, a number, and a special character." },
  ];
  for (const { isValid, error } of validationChecks) {
    if (!isValid) throw new ApiError(400, error);
}


const existingUser=await User.findOne({
  email
});
if(existingUser){
  throw new ApiError(409,"User already exist");


}


const allowedRoles=['admin','user'];
const userRole = allowedRoles.includes(role) ? role : 'user';

const otpCode=generateOTP();
const otpExpiry=new Date(Date.now()+10*60*1000);  //for 10 min
try{
  await sendVerificationEmail(email,otpCode);

 }catch(err){
   throw new ApiError(500,"Error while sending email");
 }

 const newUser = new User({
  role:userRole,
  email,
  password,
  verificationOTP: otpCode,
  otpExpiry,
  isVerified: false,
});

if (!newUser) {
  throw new ApiError(500, "Error while creating user.");
}
await newUser.save();

const createdUser = await User.findOne({
  email: email
}).select('-password -otpCode');

return res.status(201).json(
  new ApiResponse(201, createdUser, "User registered successfully. Please verify your email.")
);


})




const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const requiredFieldErrors = validateRequiredFields({ email, otp });
  const validationChecks = [
      { isValid: !requiredFieldErrors, error: requiredFieldErrors },
      { isValid: validateEmail(email), error: "Invalid email format." },
      { isValid: validateOTP(otp), error: "Invalid OTP format. OTP must be a 6-digit number." },
  ];

  for (const { isValid, error } of validationChecks) {
      if (!isValid) throw new ApiError(400, error);
  }

  
  const user = await User.findOne({ email });
  if (!user) {
      throw new ApiError(404, "User not found.");
  }

  
  if (user.isVerified) {
      throw new ApiError(400, "Email is already verified.");
  }


  if (new Date() > new Date(user.otpExpiry)) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  
  let isOtpValid;
  
  try {
     isOtpValid = await user.compareHash(otp, 'verificationOTP');
  } catch (error) {
    console.log(error);
      throw new ApiError(500, "Error verifying OTP.");
  }

  if (!isOtpValid) {
      throw new ApiError(400, "Invalid OTP.");
  }

  user.verificationOTP = null;
  user.otpExpiry = null;
  user.isVerified = true;

  try {
      const updatedUser = await user.save();
      if (!updatedUser.isVerified) {
          throw new ApiError(500, "Failed to update. Something went wrong.");
      }

      const responseUser = { email: updatedUser.email };
      res.status(200).json(new ApiResponse(200, responseUser, "Email verified successfully."));
  } catch (err) {
      console.error(err);
      throw new ApiError(500, "A Server error occurred.");
  }
});




const loginUser=asyncHandler(async(req,res)=>{
  const { email, password } = req.body;
  const requiredFieldErrors = validateRequiredFields({ email, password });
  const validationChecks = [
      {
          isValid: !requiredFieldErrors,
          error: new ApiError(400, requiredFieldErrors || "Email and password are required."),
      },
      {
          isValid: validateEmail(email),
          error: new ApiError(400, "Invalid email format."),
      },
      {
          isValid: validatePassword(password),
          error: new ApiError(400, "Password must be at least 6 characters long, include uppercase and lowercase letters, a number, and a special character."),
      },
  ];

  for (const { isValid, error } of validationChecks) {
      if (!isValid) throw error;
  }
   console.log("hey");
  passport.authenticate('local',async(err,user,info)=>{
    if(err){
      console.log(err);
      return next(new ApiError(500,"Authentication failed."))

    }
    if(!user){
      return res.status(401).json(new ApiResponse(401,{},info?.message || "Invalid login credentials."))
    }

    try{
      console.log("hey1");
      const sanitizedUser = await User.findOne({
        email
    }).select('-password -otpCode');
    if (!sanitizedUser.otpVerified) { 
      return res
          .status(403)
          .json(new ApiResponse(403, {}, "Please verify your email using otp."));

  }

  await new Promise((resolve, reject) => {
    req.login(sanitizedUser, (loginErr) => {
        if (loginErr) {
            console.error("Error during session creation:", loginErr);
            return reject(new ApiError(500, "An error occurred during login."));
        }
        resolve();
    });
});


return res
    .status(200)
    .json(new ApiResponse(200, { user: sanitizedUser }, "Login successful."));


    }catch(error){
      console.error("Error during login process:", error);
            return next(new ApiError(500, "An internal server error occurred."));

    }
  })

});

const resendOtp=asyncHandler(async(req,res)=>{
  const { email } = req.body;

    
  const requiredFieldErrors = validateRequiredFields({ email });
  const validationChecks = [
      { isValid: !requiredFieldErrors, error: requiredFieldErrors },
      { isValid: validateEmail(email), error: "Invalid email format." },
  ];

  for (const { isValid, error } of validationChecks) {
      if (!isValid) throw new ApiError(400, error);
  }

  const user=await User.findOne(email);

  if (!user) {
    throw new ApiError(404, "User not found.");
}


if (user.isVerified) {
    throw new ApiError(400, "Email is already verified.");
}


const newOtp = generateOTP(); 
const newOtpExpiration = new Date(Date.now() + 10 * 60 * 1000); 


const updatedUser = await User.updateOne(
  { email }, 
  { 
      $set: { 
          otpCode: newOtp, 
          otpExpiration: newOtpExpiration 
      }
  }
);

if (updatedUser.nModified === 0) {
  throw new ApiError(400, "User OTP not updated.");
}

await sendEmail(
  email,
  "Resend OTP Code",
  `<h2>Your new OTP code is ${newOtp}</h2><p>It is valid for 10 minutes.</p>`
);

res.status(200).json(
  new ApiResponse(
      200,
      { email },
      "A new OTP has been sent to your email address."
  ));


});

module.exports = { registerUser, loginUser, verifyEmail};