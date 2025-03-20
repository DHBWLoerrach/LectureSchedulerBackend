const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { Module } = require('../server'); // Import models from server.js

// GET all Module
router.get('/show', async (req, res) => {
  try {
    // Fetch all employees from the database
    const modules = await Module.find({});

    // Transform employees into an array of arrays
    const formattedModules = modules.map((module) => [
      module._id.toString(),
      module.Modulname,
      module.Vorlesungsstunden,
      module.ZugewieseneDozenten,
    ]);

    // Send the formatted employees as the response
    res.status(200).json(formattedModules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, message: 'Error fetching modules' });
  }
});

// POST a new Module
router.post('/create', async (req, res) => {
  const { Modulname, Vorlesungsstunden, ZugewieseneDozenten } = req.body;
  console.log(Modulname);
  console.log(Vorlesungsstunden);
  console.log(ZugewieseneDozenten);

  try {
    if (!Modulname || !Vorlesungsstunden) {
      return res
        .status(400)
        .json({ message: 'Modulname and Vorlesungsstunden are required!' });
    }

    // Convert string IDs to MongoDB ObjectIds
    const validDozenten = Array.isArray(ZugewieseneDozenten)
      ? ZugewieseneDozenten.filter((id) => mongoose.Types.ObjectId.isValid(id)) // Filter out invalid IDs
          .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    const newModule = new Module({
      Modulname,
      Vorlesungsstunden,
      ZugewieseneDozenten: validDozenten, // Store as ObjectId array
    });

    await newModule.save();

    res.status(201).json({ success: true, employee: newModule });
  } catch (err) {
    console.error('Error saving module:', err);
    res.status(400).json({ message: err.message });
  }
});

// POST edit a Module
router.put('/edit', async (req, res) => {
  console.log(req.body);
  const { id, Modulname, Vorlesungsstunden, ZugewieseneDozenten } = req.body;

  try {
    // Convert string IDs to MongoDB ObjectIds
    const validDozenten = Array.isArray(ZugewieseneDozenten)
      ? ZugewieseneDozenten.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        ).map((id) => new mongoose.Types.ObjectId(id))
      : [];

    // Find and update the module
    const updatedModule = await Module.findByIdAndUpdate(
      id,
      {
        Modulname,
        Vorlesungsstunden,
        ZugewieseneDozenten: validDozenten,
      },
      { new: true, runValidators: true }
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Module not found!' });
    }

    res.status(200).json({ success: true, employee: updatedModule });
  } catch (err) {
    console.error('Error updating module:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a Module
router.delete('/delete', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'No employee IDs provided' });
  }

  try {
    // Delete employees by their IDs
    const result = await Module.deleteMany({ _id: { $in: ids } });

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
          message: `${result.deletedCount} Module wurden erfolgreich gelöscht.`,
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
