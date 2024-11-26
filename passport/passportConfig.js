const passport=require("passport");

const LocalStrategy = require('passport-local');

const User = require('../models/User');

const { asyncHandler } = require("../utils/asyncHandler");
const { ApiResponse } = require("../utils/ApiResponse");


passport.serializeUser((user,done)=>{
    done(null,user.id);
});



passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user); 
    } catch (error) {
      done(error);
    }
  });

passport.use(
    new LocalStrategy(
        { usernameField: 'email', passwordField: 'password' },
        asyncHandler(async(email,password,done)=>{
            const user=await User.findOne({
                email
            });

            if(!user){
                return done(null, false, new ApiResponse(400, null, "Email and password are required"));
                

            }
            const isPasswordValid = await user.compareHash(password, "password");
            if (!isPasswordValid) {
                return done(null, false, new ApiResponse(400, null, "Incorrect email or password"));
            }

            if (!user.otpVerified) {
                return done(null, false, new ApiResponse(403, null, "Please verify your email to login."));
            }

            return done(null, user);
        })
    )
)


module.exports=passport;