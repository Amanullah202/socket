const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://16.171.22.112", // Replace with your public IP
    methods: ["GET", "POST"],
  },
});

// Serve the index.html file from the public folder
app.use(express.static("public"));

// Handle WebSocket connections
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Listen for button press from client and send random number
  socket.on("requestNumber", () => {
    const randomNumber = Math.floor(Math.random() * 100) + 1; // Generate random number
    console.log(
      `Received 'requestNumber' from ${socket.id}, sending number: ${randomNumber}`
    );
    socket.emit("receiveNumber", randomNumber); // Send the number back to client
  });
});

// Start the server
const PORT = process.env.PORT || 4040;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
