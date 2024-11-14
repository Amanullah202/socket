const express = require('express');
const router = express.Router();

// Create a basic Express app inside the dev folder
const app = express();

// Handle a simple GET request for now
app.get('/', (req, res) => {
  res.send('Welcome to the Dev App!');
});

// Export the app for use in the main server
module.exports = app;
