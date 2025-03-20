const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Import the CORS middleware
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const fs = require('fs'); // File system for reading QR code
console.log(fs ? 'fs module loaded successfully' : 'fs module not loaded');

const app = express();
const PORT = 5000;

const mongoUrlPersonen =
  process.env.MONGO_URL || 'mongodb://localhost:27017/Personen';

// Middleware
app.use(
  cors({
    origin: '*',
  })
);
app.use(express.json());

// Connect to MongoDB (Personen and Betrieb databases)
const personenConnection = mongoose.createConnection(mongoUrlPersonen, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

personenConnection.on('connected', () => {
  console.log('Connected to MongoDB Personen Database');
});

personenConnection.on('error', (err) => {
  console.error('MongoDB Personen connection error:', err);
});

// Define User Schema and Model
const userSchema = new mongoose.Schema(
  {
    Benutzername: String,
    Passwort: String,
    Nachname: String,
    Vorname: String,
    Berechtigung: String,
  },
  {
    versionKey: false, // Disable the __v field
  }
);

// Pre-save hook to hash the password before saving
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('Passwort') || this.isNew) {
      const salt = await bcrypt.genSalt(10);
      this.Passwort = await bcrypt.hash(this.Passwort, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

const User = personenConnection.model('User', userSchema, 'Benutzer');

// Module Schema
const moduleSchema = new mongoose.Schema(
  {
    Modulname: { type: String, required: true },
    Vorlesungsstunden: { type: Number, required: true },
    ZugewieseneDozenten: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Benutzer' },
    ],
  },
  { versionKey: false }
);

const Module = personenConnection.model('Module', moduleSchema, 'Module');

// SG Schema
const sgSchema = new mongoose.Schema(
  {
    Studiengangsname: { type: String, required: true },
    ModuleSem1: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    ModuleSem2: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    ModuleSem3: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    ModuleSem4: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    ModuleSem5: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    ModuleSem6: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    FrühsteUhrzeit: { type: String, required: true },
    SpätesteUhrzeit: { type: String, required: true },
    MaximaleBlockdauerMin: { type: Number, required: true },
    DauerMittagspauseMin: { type: Number, required: true },
  },
  { versionKey: false }
);

const SG = personenConnection.model('SG', sgSchema, 'Studiengänge');

const auditTrailSchema = new mongoose.Schema(
  {
    auditTrail: {
      type: Object,
      default: {},
    },
  },
  { versionKey: false }
);

const Audit = personenConnection.model('Audit', auditTrailSchema, 'AuditTrail');

// Course Schema
const courseSchema = new mongoose.Schema(
  {
    Kursname: { type: String, required: true },
    Studiengang: { type: mongoose.Schema.Types.ObjectId, ref: 'Studiengang' },
    Semester: { type: Number, required: true },
    ZugewiesenSekretariat: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Benutzer' },
    ],
    Kalender: {
      type: Object, // oder alternativ: type: Map, of: String,
      default: {},
    },
  },
  { versionKey: false }
);

const Course = personenConnection.model('Course', courseSchema, 'Kurse');

// Export the models for use in routes
module.exports = {
  Module,
  SG,
  Course,
  Audit,
};

// JWT Secret Key
const secretKey = process.env.JWT_SECRET;
console.log(secretKey);

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const Benutzername = username;
  const Passwort = password;

  try {
    const user = await User.findOne({ Benutzername }).exec();
    if (!user) {
      return res.status(401).send('Invalid username or password');
    }
    // compare text with hashed password in MongoDB
    const isMatch = await bcrypt.compare(Passwort, user.Passwort);

    if (!isMatch) {
      return res.status(401).send('Invalid username or password');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.Benutzername,
        firstname: user.Vorname,
        lastname: user.Nachname,
        role: user.Berechtigung,
      },
      secretKey,
      { expiresIn: '1h' }
    );

    // Send token to the client
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// Middleware to authenticate token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    const decoded = jwt.verify(token, secretKey);

    // Fetch user from database using the _id from the token
    const dbUser = await User.findById(decoded.userId).lean().exec();

    if (!dbUser) {
      return res.status(401).send('Unauthorized: User not found');
    }
    // Check if user details match the database
    const detailsMatch =
      dbUser.Benutzername === decoded.username &&
      dbUser.Vorname == decoded.firstname &&
      dbUser.Nachname == decoded.lastname;

    if (!detailsMatch) {
      return res.status(401).send('Unauthorized: User details do not match');
    }

    req.user = dbUser;
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    return res.status(403).send('Forbidden: Invalid token');
  }
};

// protected API endpoint
app.get('/api/protected', authenticateToken, (req, res) => {
  res.status(200).json(req.user); // Send the user information
});

app.get('/audit/get', authenticateToken, async (req, res) => {
  try {
    const audit = await Audit.findOne({}, { auditTrail: 1, _id: 0 });
    if (!audit) {
      return res
        .status(404)
        .json({ success: false, message: 'No audit trail found' });
    }
    res.status(200).json(audit.auditTrail);
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error fetching audit trail' });
  }
});

// Import routes
const moduleRoutes = require('./routes/modules');
const sgRoutes = require('./routes/sgs');
const courseRoutes = require('./routes/courses');
//const produkteRoutes = require('./routes/produkte');
//const routenRoutes = require('./routes/routen');

// Use the routes
app.use('/modules', moduleRoutes);
app.use('/sgs', sgRoutes);
app.use('/courses', courseRoutes);
//app.use('/api/produkte', produkteRoutes);
//app.use('/api/routen', routenRoutes);

app.post('/employees/create', authenticateToken, async (req, res) => {
  try {
    console.log(req.body);

    const {
      employeeFirstname,
      employeeLastname,
      employeeEmail,
      employeePassword,
      employeeRole,
    } = req.body;

    // Check if an employee with the same employeeEmail already exists
    const existingEmployee = await User.findOne({ username: employeeEmail });

    if (existingEmployee) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Employee with this Exyte Email already exists',
        });
    }

    // Create a new device document
    const newEmployee = new User({
      Vorname: employeeFirstname,
      Nachname: employeeLastname,
      Benutzername: employeeEmail,
      Passwort: employeePassword,
      Berechtigung: employeeRole,
    });

    // Save the document to the database
    const savedEmployee = await newEmployee.save();
    res.status(201).json({ success: true, employee: savedEmployee });
  } catch (error) {
    console.error('Error creating employee:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error creating employee' });
  }
});

app.get('/employees/show', authenticateToken, async (req, res) => {
  try {
    // Fetch all employees from the database
    const employees = await User.find({});

    // Transform employees into an array of arrays
    const formattedEemployees = employees.map((employee) => [
      employee._id.toString(),
      employee.Vorname,
      employee.Nachname,
      employee.Berechtigung,
      employee.Benutzername,
    ]);

    // Send the formatted employees as the response
    res.status(200).json(formattedEemployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error fetching employees' });
  }
});

app.post('/employees/edit', authenticateToken, async (req, res) => {
  try {
    console.log(req.body);

    const {
      employeeID,
      employeeFirstname,
      employeeLastname,
      employeeEmail,
      employeeRole,
    } = req.body;

    const firstname = employeeFirstname;
    const lastname = employeeLastname;
    const role = employeeRole;
    const username = employeeEmail;

    // Check if an employee with the provided projectID exists
    const existingEmployee = await User.findById(employeeID);

    if (!existingEmployee) {
      return res
        .status(404)
        .json({
          success: false,
          message: 'Employee with this ID does not exist',
        });
    }

    // Check if the new SerialNumber already exists for a different employee (except where the id is the same)
    const employeeWithSameEmail = await User.findOne({
      username,
      _id: { $ne: employeeID },
    });

    if (employeeWithSameEmail) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Email already in use by another Employee',
        });
    }

    // Update the existing employee with the provided values
    existingEmployee.Vorname = firstname;
    existingEmployee.Nachname = lastname;
    existingEmployee.Berechtigung = role;
    existingEmployee.Benutzername = username;

    // Save the updated employee to the database
    const updatedEmployee = await existingEmployee.save();
    res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error updating employee' });
  }
});

app.delete('/employees/delete', authenticateToken, async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'No employee IDs provided' });
  }

  try {
    // Delete employees by their IDs
    const result = await User.deleteMany({ _id: { $in: ids } });

    // Für später wenn die Dozenten bei Modulen zugewiesen sind
    if (result.deletedCount > 0) {
      /*
          // Remove the deleted employee IDs from the projectAsignedEmployees array in all projects
          await Project.updateMany(
              { projectAsignedEmployees: { $in: ids } },
              { $pull: { projectAsignedEmployees: { $in: ids } } },
              { multi: true }
          );

        */

      return res
        .status(200)
        .json({
          success: true,
          message: `${result.deletedCount} Mitarbeiter wurden erfolgreich gelöscht.`,
        });
    } else {
      return res
        .status(404)
        .json({ success: false, message: 'Keinen Mitarbeiter gefunden.' });
    }
  } catch (error) {
    console.error('Error deleting employees and updating projects:', error);
    return res
      .status(500)
      .json({
        success: false,
        message:
          'An error occurred while deleting employees and updating projects',
      });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
