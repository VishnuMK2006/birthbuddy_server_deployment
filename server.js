const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToMongo, User } = require('./db');

connectToMongo();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { name, mobile, dob } = req.body;

    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ error: "User with this mobile already exists" });
    }

    user = await User.create({ name, mobile, dob });

    res.status(200).json({ success: true, message: 'Signup successful' });

  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { mobile, dob } = req.body;

  try {
    let user = await User.findOne({ mobile });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    if (dob !== user.dob) {
      return res.status(400).json({ error: "Invalid date of birth" });
    }

    res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
