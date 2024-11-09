const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const loginHandler = require("./login");
const crypto = require("crypto");
const Redis = require("ioredis");

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "https://next22-eight.vercel.app", // Vercel app URL
  "https://steller-grid-1.vercel.app", // Vercel app URL
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true); // Allow the request
      } else {
        callback(new Error("Not allowed by CORS")); // Block the request
      }
    },
    methods: ["GET", "POST"],
  },
});

// Initialize Redis client now
const redis = new Redis();

const millisecondsInASecond = 1000;
const ExpirationTimeDifference = 86400; // 24 hours

// Middleware to handle JSON requests
app.use(express.json());

// Serve a basic HTML page for testing
app.get("/", async (req, res) => {
  try {
    const keys = await redis.keys("session:*");
    const sessions = await Promise.all(keys.map((key) => redis.hgetall(key)));

    const currentTime = Math.floor(Date.now() / millisecondsInASecond);
    const sessionInfoHTML = sessions
      .map((session, index) => {
        const expirationTime = parseInt(session.expirationTime);
        const remainingTimeInSeconds = expirationTime - currentTime;

        const minutesLeft = Math.floor(remainingTimeInSeconds / 60);
        const secondsLeft = remainingTimeInSeconds % 60;

        return `
          <div>
            <h3>User ${index + 1}</h3>
            <p>Address: ${session.userAddress || "Unknown"}</p>
            <p>Remaining Time: ${minutesLeft} minutes, ${secondsLeft} seconds</p>
          </div>
          <hr>
        `;
      })
      .join("");

    res.send(`
      <h1>Welcome to the Chat Server</h1>
      <h2>Currently Logged-In Users: ${sessions.length}</h2>
      ${sessionInfoHTML}
    `);
  } catch (error) {
    console.error("Error fetching session data:", error.message);
    res.status(500).send("Error fetching session data.");
  }
});

// Function to generate a unique session ID
const generateSessionId = () => crypto.randomBytes(16).toString("hex");

// Handle socket connections
io.on("connection", (socket) => {
  const request = socket.request;
  const origin = request.headers.origin || request.headers.referer || "Unknown";

  console.log(
    `Socket connected (test text in log itself): ${socket.id} from ${origin}`
  );
  console.log(`do this log shows?`);

  // Emit the current client count to all clients
  const clientCount = io.engine.clientsCount;
  io.emit("clientCount", clientCount);

  socket.on("loginRequest", async ({ userAddress, transactionID }) => {
    const currentTime = Math.floor(Date.now() / millisecondsInASecond);
    const sessionKey = `session:${userAddress}`;

    try {
      const existingSession = await redis.hgetall(sessionKey);

      if (existingSession.sessionId) {
        if (currentTime < parseInt(existingSession.expirationTime)) {
          console.log(`User already logged in:`, existingSession);
          socket.emit("login", {
            success: true,
            sessionId: existingSession.sessionId,
            userAddress,
            loginTime: existingSession.loginTime,
            expirationTime: existingSession.expirationTime,
            message: "Login successful! (Already logged in)",
            code: 2,
          });
          return;
        } else {
          console.log(
            `Session expired for user: ${userAddress}. Updating session ID and expiration.`
          );
          const loginResponse = await loginHandler({
            body: { transactionID, userAddress },
          });
          const response = loginResponse.data;

          if (response.message === "Login successful!") {
            const newSessionId = generateSessionId();
            const newExpirationTime = currentTime + ExpirationTimeDifference;

            await redis.hmset(sessionKey, {
              sessionId: newSessionId,
              expirationTime: newExpirationTime,
              loginTime: currentTime,
            });

            console.log(
              `Updated session ID and expiration time for user: ${userAddress}`
            );

            socket.emit("login", {
              success: true,
              sessionId: newSessionId,
              userAddress,
              loginTime: currentTime,
              expirationTime: newExpirationTime,
              message: "Login successful! (Session updated)",
            });
          } else {
            socket.emit("login", { success: false, message: "Login Failed!" });
          }
          return;
        }
      }

      const loginResponse = await loginHandler({
        body: { transactionID, userAddress },
      });
      const response = loginResponse.data;

      if (response.message === "Login successful!") {
        const sessionId = generateSessionId();
        const expirationTime = currentTime + ExpirationTimeDifference;

        await redis.hmset(sessionKey, {
          userAddress,
          sessionId,
          loginTime: currentTime,
          expirationTime,
        });

        console.log(
          `New user ${userAddress} logged in, session stored in Redis:`,
          { sessionId, userAddress, expirationTime }
        );

        socket.emit("login", {
          success: true,
          sessionId,
          userAddress,
          loginTime: currentTime,
          expirationTime,
          message: "Login successful!",
        });
      } else {
        socket.emit("login", { success: false, message: "Login Failed!" });
      }
    } catch (error) {
      console.error("Login error:", error.message);
      socket.emit("login", { success: false, message: error.message });
    }
  });

  socket.on("chatMessage", async ({ sender, sessionId, msg, ...rest }) => {
    console.log("Received chatMessage event:", {
      sender,
      sessionId,
      msg,
      ...rest,
    });

    try {
      const sessionKey = `session:${sender}`;
      const loggedInUser = await redis.hgetall(sessionKey);

      if (!loggedInUser.sessionId) {
        socket.emit("error", {
          message: "You must be logged in to send messages.",
        });
        console.log(
          `Unauthorized message attempt from ${socket.id} as ${sender} - Reason: user is not logged in`
        );
        return;
      }

      const currentTime = Math.floor(Date.now() / millisecondsInASecond);

      if (
        loggedInUser.sessionId !== sessionId ||
        currentTime >= parseInt(loggedInUser.expirationTime)
      ) {
        console.log(
          `Session mismatch for ${sender}. Sent session ID: ${sessionId}, current session ID: ${loggedInUser.sessionId}`
        );

        socket.emit("error", {
          message:
            "Incorrect session ID or session expired. Please log in again.",
        });
        return;
      }

      console.log(`Message received from ${sender}: ${msg}`);

      // Send the standard fields (sender and msg) plus any dynamic "rest" fields
      io.emit("chatMessage", { sender, msg, ...rest });
    } catch (error) {
      console.error("Error handling chatMessage:", error.message);
    }
  });

  socket.on("clientCountRequest", () => {
    const clientCount = io.engine.clientsCount;
    socket.emit("clientCount", clientCount);
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const sessions = await redis.keys("session:*");

    for (const sessionKey of sessions) {
      const userSession = await redis.hgetall(sessionKey);
      if (userSession.socketId === socket.id) {
        await redis.del(sessionKey);
        console.log(`Logged out user: ${userSession.userAddress}`);
      }
    }

    const updatedClientCount = io.engine.clientsCount;
    io.emit("clientCount", updatedClientCount);
  });
});
io.engine.on("connection_error", (err) => {
  // console.log(err.req); // the request object
  // console.log(err.code); // the error code, for example 1
  console.log(err.message); // the error message, for example "Session ID unknown"
});
// Start the server
const PORT = process.env.PORT || 4040;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
// If this line shows it means vps is fetching on each commit.2
