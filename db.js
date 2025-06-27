const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  mobile: { type: String, unique: true },
  dob: String, // Format: YYYY-MM-DD
  groupType: { type: String, enum: ['public', 'private'], default: 'public' },
  createdBy: { type: String, default: null }, // For private group creator
});

const mongoURI = "mongodb+srv://vishnu:tvmk2006@firstsample.c9yehfj.mongodb.net/?retryWrites=true&w=majority&appName=firstsample";
const User = mongoose.model('User', userSchema);

const connectToMongo = () => {
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log("MongoDB Error: ", err));
};

module.exports = { connectToMongo, User };
