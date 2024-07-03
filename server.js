const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to the database
require("./db/connection");

// Import the user model
const UserModel = require("./models/users");

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

    res.status(201).send("User registered successfully");
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

        res
          .status(200)
          .json({
            user: { email: user.email, fullname: user.fullname },
            token,
          });
      }
    );
  } catch (err) {
    res.status(500).send("Error logging in");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
