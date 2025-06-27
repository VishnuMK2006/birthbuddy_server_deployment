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
    const { name, mobile, dob, groupType = "public", createdBy = null } = req.body;

    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ error: "User with this mobile already exists" });
    }

    user = await User.create({ name, mobile, dob, groupType, createdBy });

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

// 🎉 Get Today's Birthdays (both public and private if created by user)
app.get('/api/today/:mobile', async (req, res) => {
  try {
    const today = new Date();
    const mmdd = `${today.getMonth() + 1}`.padStart(2, '0') + '-' + `${today.getDate()}`.padStart(2, '0');

    const all = await User.find();

    const birthdaysToday = all.filter(user => {
      const [year, month, day] = user.dob.split('-');
      return `${month}-${day}` === mmdd;
    });

    res.json({ success: true, data: birthdaysToday });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// 🟢 Public Group Birthdays
app.get('/api/public', async (req, res) => {
  try {
    const users = await User.find({ groupType: 'public' });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// 🔒 Private Group (based on createdBy = user's mobile)
app.get('/api/private/:mobile', async (req, res) => {
  try {
    const { mobile } = req.params;
    const users = await User.find({ groupType: 'private', createdBy: mobile });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
