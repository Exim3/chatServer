const moongoose = require("mongoose");

const url =
  "mongodb+srv://exim3:MaatMari04@cluster0.mty1n3d.mongodb.net/?appName=Cluster0";

moongoose
  .connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Successfully connected to MongoDB with Mongoose!");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
