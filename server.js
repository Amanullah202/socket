const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://16.171.22.112", // Your public IP
      "https://next22-eight.vercel.app/", // Vercel app URL
    ],
    methods: ["GET", "POST"],
  },
});

// Serve the index.html file from the public folder
app.use(express.static("public"));

// Array to hold all numbers requested by users
let userNumbers = [];

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current user numbers to newly connected user
  socket.emit("updateNumbers", userNumbers);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  socket.on("requestNumber", () => {
    const randomNumber = Math.floor(Math.random() * 100) + 1; // Generate random number
    console.log(
      `Received 'requestNumber' from ${socket.id}, sending number: ${randomNumber}`
    );

    // Store the user's number request
    userNumbers.push({ userId: socket.id, number: randomNumber });

    // Emit the new number to all clients
    io.emit("receiveNumber", { userId: socket.id, number: randomNumber });
  });
});

// Start the server
const PORT = process.env.PORT || 4040;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
