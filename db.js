const mongoose = require('mongoose');

const connectToMongo = async () => {
  const mongoURI = "mongodb+srv://vishnu:tvmk2006@firstsample.c9yehfj.mongodb.net/?retryWrites=true&w=majority&appName=firstsample";
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectToMongo;
