// dev/server.js
const express = require('express');
const app = express();

// Define a simple route to test the dev server
app.get('/', (req, res) => {
  res.send('Welcome to the Dev App!');
});

// Start the server
const PORT = 3001;  // You can choose any available port
app.listen(PORT, () => {
  console.log(`Dev server is running on http://localhost:${PORT}`);
});
