const moongoose = require("mongoose");

const url = "mongodb://localhost:27017/chatBox";

moongoose
  .connect(url)
  .then(() => {
    console.log("Successfully connected to MongoDB with Mongoose!");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
