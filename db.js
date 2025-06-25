const mongoose = require('mongoose');

const mongoURI = "mongodb+srv://vishnu:tvmk2006@firstsample.c9yehfj.mongodb.net/?retryWrites=true&w=majority&appName=firstsample";

//connect with db
const connectToMongo = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

//schema define
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    dob: { type: String, required: true },
    mobile: { type: Number, required: true }
});

const User = mongoose.model('user', UserSchema);

module.exports = {
  connectToMongo,
  User
};
