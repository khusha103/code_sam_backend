// const express = require('express');
// const connectDB = require('./config/db');
// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// const { errorHandler } = require('./middleware/errorHandler');

// const app = express();

// // Connect to database
// connectDB();

// // Middleware
// app.use(express.json());

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

// // Error handling middleware
// app.use(errorHandler);

// module.exports = app;

// const express = require("express");
// const env = require("./config/env");
// const connectDB = require("./config/db");

// const app = express();

// // Connect to MongoDB
// connectDB();

// // Use environment constants
// const PORT = env.PORT;

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


const express = require("express");
const app = express();
const authRoutes = require("./routes/authRoutes");
const connectDB = require("./config/db");
const cors = require("cors"); // Import CORS

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

// CORS Middleware
app.use(
  cors({
    origin: "http://localhost:3000", // Allow requests from the frontend React app
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    credentials: true, // Allow cookies to be sent
  })
);

// Example root route
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// Use authentication routes
app.use("/api/auth", authRoutes);

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "An error occurred", error: err.message });
});

module.exports = app; // Export the app instance

