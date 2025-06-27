const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToMongo, User } = require('./db');

connectToMongo();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

/* -------------------------- SIGNUP -------------------------- */
app.post('/api/signup', async (req, res) => {
  try {
    const { name, mobile, dob, groupType = "public", createdBy = null } = req.body;

    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ error: "User with this mobile already exists" });
    }

    user = await User.create({ name, mobile, dob, groupType, createdBy });

    res.status(200).json({ success: true, message: 'Signup successful', user });

  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

/* -------------------------- LOGIN -------------------------- */
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

    res.json({ success: true, message: "Login successful", user });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

/* ---------------------- ADD TO PRIVATE GROUP ---------------------- */
app.post('/api/private/add', async (req, res) => {
  try {
    const { name, mobile, dob, createdBy } = req.body;

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name,
      mobile,
      dob,
      groupType: 'private',
      createdBy
    });

    res.json({ success: true, message: 'User added to private group', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

/* ---------------------- JOIN PUBLIC GROUP ---------------------- */
app.post('/api/public/join', async (req, res) => {
  try {
    const { name, mobile, dob, invitedBy } = req.body;

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name,
      mobile,
      dob,
      groupType: 'public',
      createdBy: invitedBy
    });

    res.json({ success: true, message: 'Joined public group successfully', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

/* ---------------------- TODAY'S BIRTHDAYS ---------------------- */
app.get('/api/today/:mobile', async (req, res) => {
  try {
    const today = new Date();
    const mmdd = `${today.getMonth() + 1}`.padStart(2, '0') + '-' + `${today.getDate()}`.padStart(2, '0');

    const all = await User.find();

    const birthdaysToday = all.filter(user => {
      if (!user.dob || typeof user.dob !== 'string' || !user.dob.includes('-')) return false;
      const [year, month, day] = user.dob.split('-');
      return `${month}-${day}` === mmdd;
    });

    res.json({ success: true, data: birthdaysToday });
  } catch (error) {
    console.error("Error in /api/today:", error.message);
    res.status(500).send("Server Error");
  }
});

/* ---------------------- GET PUBLIC GROUP USERS ---------------------- */
app.get('/api/public', async (req, res) => {
  try {
    const users = await User.find({ groupType: 'public' });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

/* ---------------------- GET PRIVATE GROUP USERS ---------------------- */
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
