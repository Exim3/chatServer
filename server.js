const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Connect to the database
require("./db/connection");

// Import the user model
const UserModel = require("./models/users");
const ConversationModel = require("./models/conversation");
const MessageModel = require("./models/messages");

let users = [];

io.on("connection", (socket) => {
  console.log("user Connected", socket.id);

  socket.on("addUser", (userId) => {
    const isUserExit = users.find((user) => user.userId === userId);
    console.log("otha");
    if (!isUserExit) {
      console.log("kommala");
      const user = { userId, socketId: socket.id };
      console.log("kommala", user);
      users.push(user);
      io.emit("getUsers", users);
    }
  });
  socket.on(
    "sendMessage",
    async ({ senderId, recieverId, conversationId, message }) => {
      console.log(recieverId, "recieverId");
      console.log(senderId, "senderId");
      console.log(users, "users after");
      const reciever = users.find((user) => user.userId === recieverId);
      const sender = users.find((user) => user.userId === senderId);
      const user = await UserModel.findById(senderId);
      console.log("hii");
      const newMessage = {
        senderId,
        recieverId,
        conversationId,
        message,
        user: { _id: user._id, fullname: user.fullname, email: user.email },
      };
      // console.log("Message sent to receiver:", reciever?.socketId);
      if (reciever) {
        console.log("Message sent to receiver:", reciever?.socketId);
        io.to(reciever?.socketId).emit("getMessage", newMessage);
      }
      console.log("Message sent to sender:", sender?.socketId);
      io.to(sender?.socketId).emit("getMessage", newMessage);
      // io.emit("getMessage", newMessage);
    }
  );

  socket.on("disconnect", () => {
    users = users.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", users);
  });
});

// Routes
app.get("/", (req, res) => {
  res.send("Welcome home");
});

app.post("/api/register", async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).send("Please fill all required fields");
    }

    const isAlreadyExists = await UserModel.findOne({ email });
    if (isAlreadyExists) {
      return res.status(400).send("User already exists");
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const newUser = new UserModel({
      fullname,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    res.status(200).send("User registered successfully");
  } catch (err) {
    res.status(500).send("Error registering user");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send("Please fill all required fields");
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(400).send("Invalid email or password");
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send("Invalid email or password");
    }

    const payload = {
      userId: user._id,
      email: user.email,
    };
    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "secretkey";

    jwt.sign(
      payload,
      JWT_SECRET_KEY,
      { expiresIn: 86400 },
      async (err, token) => {
        if (err) {
          return res.status(500).send("Error generating token");
        }

        user.token = token;
        await user.save();

        res.status(200).json({
          user: { id: user._id, email: user.email, fullname: user.fullname },
          token,
        });
      }
    );
  } catch (err) {
    res.status(500).send("Error logging in");
  }
});

app.post("/api/conversation", async (req, res) => {
  try {
    const { senderId, recieverId } = req.body;
    const newConversation = new ConversationModel({
      members: [senderId, recieverId],
    });
    await newConversation.save();
    res.status(200).send("Conversation created successfully");
  } catch (err) {
    console.log(err);
  }
});
app.get("/api/conversation/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await ConversationModel.find({
      members: { $in: [userId] },
    });

    const conversationUserData = await Promise.all(
      conversations.map(async (conversation) => {
        const recieverId = conversation.members.find(
          (member) => member !== userId
        );
        const userData = await UserModel.findById(recieverId, "-__v -password");
        return {
          conversationId: conversation._id,
          user: userData,
          recieverId,
        };
      })
    );

    res.status(200).json(conversationUserData);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/message", async (req, res) => {
  try {
    const { senderId, conversationId, message, recieverId = "" } = req.body;
    if (!senderId || !message) {
      return res.status(400).send("please fill all required fields");
    }

    if (conversationId === "new" && recieverId) {
      const newConversation = new ConversationModel({
        members: [senderId, recieverId],
      });
      await newConversation.save();

      const newMessage = new MessageModel({
        conversationId: newConversation._id,
        senderId,
        message,
      });
      // console.log("heyy");
      await newMessage.save();
      return res.status(200).json("message sent successfully");
    } else if (!recieverId && !conversationId) {
      return res.status(400).json("please fill all required fields");
    }
    const newMessage = new MessageModel({ conversationId, senderId, message });
    await newMessage.save();
    res.status(200).json("message sent successfully");
  } catch (error) {
    console.log(error);
  }
});
app.get("/api/message/:conversationId", async (req, res) => {
  try {
    const checkMessages = async (conversationId) => {
      const message = await MessageModel.find({ conversationId });
      // console.log(message, "message");
      const messageUserData = Promise.all(
        message.map(async (message) => {
          const user = await UserModel.findById(
            message.senderId,
            "-__v -password"
          );
          return {
            message: message.message,
            user: user,
            conversationId,
          };
        })
      );
      // console.log(await messageUserData);
      res.status(200).json(await messageUserData);
    };
    const conversationId = req.params.conversationId;
    if (conversationId === "new") {
      const checkConversation = await ConversationModel.find({
        members: { $all: [req.query.senderId, req.query.recieverId] },
      });
      if (checkConversation?.length > 0) {
        checkMessages(checkConversation[0]._id);
      } else {
        return res.status(200).json([]);
      }
    } else {
      checkMessages(conversationId);
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/api/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const users = await UserModel.find({ _id: { $ne: userId } });

    const userDataPromises = users.map(async (user) => {
      const recieverId = user._id.toString();
      const conversation = await ConversationModel.findOne({
        members: { $all: [userId, recieverId] },
      });

      if (!conversation) {
        return {
          user: {
            email: user.email,
            fullname: user.fullname,
            _id: user._id,
          },
        };
      }

      return null;
    });

    const userData = await Promise.all(userDataPromises);

    const filteredUserData = userData.filter((data) => data !== null);

    res.status(200).json(filteredUserData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
