const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { Course } = require('../server'); // Import models from server.js
const { Audit } = require('../server'); // Import models from server.js

// GET: Kalender abrufen (verwenden hier POST, um die courseId im Body zu erhalten)
router.post('/calendar', async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: 'Course not found' });
    }
    // Kalender wird als Mapping (Zeitfenster -> Modul-ID) gespeichert
    res.status(200).json({ schedule: course.Kalender || {} });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error fetching calendar' });
  }
});

router.post('/calendar/update', async (req, res) => {
  try {
    const { courseId, Kalender, user, crs, module, userLevel, userID } =
      req.body;

    // Fetch the current course and its Kalender object
    const currentCourse = await Course.findById(courseId);
    if (!currentCourse) {
      return res
        .status(404)
        .json({ success: false, message: 'Course not found' });
    }

    const currentKalender = currentCourse.Kalender || {};
    let modificationDetected = false;

    // Check for modifications in keys that already exist in currentKalender
    for (const key in Kalender) {
      if (Kalender.hasOwnProperty(key)) {
        if (
          currentKalender.hasOwnProperty(key) &&
          currentKalender[key] !== Kalender[key]
        ) {
          modificationDetected = true;
          break;
        }
      }
    }

    // Also check for removals of keys that exist in the current calendar
    if (!modificationDetected) {
      for (const key in currentKalender) {
        if (currentKalender.hasOwnProperty(key) && !(key in Kalender)) {
          modificationDetected = true;
          break;
        }
      }
    }

    console.log(userID);
    // Check if userID is inside ZugewiesenSekretariat
    const isUserAssigned =
      currentCourse.ZugewiesenSekretariat &&
      Array.isArray(currentCourse.ZugewiesenSekretariat) &&
      currentCourse.ZugewiesenSekretariat.some(
        (assignedId) => assignedId.toString() === userID
      );

    // If a modification is detected, only allow if the userLevel is 3 or the user is assigned (i.e. userID is in ZugewiesenSekretariat)
    if (modificationDetected && !(userLevel === 3 || isUserAssigned)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient privileges to modify existing calendar entries',
      });
    }

    // Proceed with the update (new keys will be added, and no changes to existing keys if not allowed)
    currentCourse.Kalender = Kalender;
    const updatedCourse = await currentCourse.save();

    // Create the audit record string and log it with a unique timestamp
    const auditRecord = `${user} | ${crs.label} | ${module.label}`;
    const timestamp = new Date().toISOString();
    await Audit.findOneAndUpdate(
      {},
      { $set: { [`auditTrail.${timestamp}`]: auditRecord } },
      { new: true }
    );

    res.status(200).json({ success: true, Kalender: updatedCourse.Kalender });
  } catch (error) {
    console.error('Error updating calendar:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error updating calendar' });
  }
});

// GET all Course
router.get('/show', async (req, res) => {
  try {
    // Fetch all employees from the database
    const modules = await Course.find({});

    // Transform employees into an array of arrays
    const formattedModules = modules.map((module) => [
      module._id.toString(),
      module.Kursname,
      module.Studiengang,
      module.Semester,
      module.ZugewiesenSekretariat,
      module.Kalender,
    ]);

    // Send the formatted employees as the response
    res.status(200).json(formattedModules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, message: 'Error fetching modules' });
  }
});

// POST a new Course
router.post('/create', async (req, res) => {
  const { Kursname, Studiengang, Semester, ZugewieseneSekretariat } = req.body;
  console.log(Kursname, Studiengang, Semester, ZugewieseneSekretariat);
  try {
    if (!Kursname || !Studiengang || !Semester) {
      return res
        .status(400)
        .json({ message: 'Modulname and Vorlesungsstunden are required!' });
    }

    // Convert string IDs to MongoDB ObjectIds
    const validDozenten = Array.isArray(ZugewieseneSekretariat)
      ? ZugewieseneSekretariat.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        ) // Filter out invalid IDs
          .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    const newModule = new Course({
      Kursname,
      Studiengang,
      Semester,
      ZugewiesenSekretariat: validDozenten, // Store as ObjectId array
      Kalender: new Object(),
      Audittrail: new Object(),
    });

    await newModule.save();

    res.status(201).json({ success: true, employee: newModule });
  } catch (err) {
    console.error('Error saving module:', err);
    res.status(400).json({ message: err.message });
  }
});

// POST edit a Course
router.put('/edit', async (req, res) => {
  const { id, Kursname, Studiengang, Semester, ZugewieseneSekretariat } =
    req.body;
  console.log(id, Kursname, Studiengang, Semester, ZugewieseneSekretariat);

  try {
    // Überprüfen, ob alle erforderlichen Felder vorhanden sind
    if (!id || !Kursname || !Studiengang || !Semester) {
      return res
        .status(400)
        .json({
          message: 'ID, Modulname, Studiengang und Semester sind erforderlich!',
        });
    }

    // Konvertiere die string IDs zu MongoDB ObjectIds
    const validDozenten = Array.isArray(ZugewieseneSekretariat)
      ? ZugewieseneSekretariat.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        ) // Filtere ungültige IDs heraus
          .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    // Modul anhand der ID finden und aktualisieren
    const updatedModule = await Course.findByIdAndUpdate(
      id, // ID des Moduls
      {
        Kursname,
        Studiengang,
        Semester,
        ZugewiesenSekretariat: validDozenten, // Array von ObjectIds
        //Kalender: new Object(),
        Audittrail: new Object(),
      },
      { new: true } // gibt das aktualisierte Dokument zurück
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Modul nicht gefunden!' });
    }

    res.status(200).json({ success: true, employee: updatedModule });
  } catch (err) {
    console.error('Fehler beim Bearbeiten des Moduls:', err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE a Course
router.delete('/delete', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'No employee IDs provided' });
  }

  try {
    // Delete employees by their IDs
    const result = await Course.deleteMany({ _id: { $in: ids } });

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
          message: `${result.deletedCount} Course wurden erfolgreich gelöscht.`,
        });
    } else {
      return res
        .status(404)
        .json({ success: false, message: 'Kein Modul gefunden.' });
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

module.exports = router;
