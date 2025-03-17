const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { SG } = require('../server'); // Import models from server.js

// GET all SG
router.get('/show', async (req, res) => {

  try {
    // Fetch all employees from the database
    const modules = await SG.find({});

    // Transform employees into an array of arrays
    const formattedModules = modules.map(module => [
        module._id.toString(),
        module.Studiengangsname,
        module.ModuleSem1,
        module.ModuleSem2,
        module.ModuleSem3,
        module.ModuleSem4,
        module.ModuleSem5,
        module.ModuleSem6,
        module.FrühsteUhrzeit,
        module.SpätesteUhrzeit
    ]);

    // Send the formatted employees as the response
    res.status(200).json(formattedModules);
} catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, message: 'Error fetching modules' });
}
});


// POST a new SG
router.post('/create', async (req, res) => {
  const { Studiengangsname, SemesterModule } = req.body;

  try {
    // Validate required fields
    if (!Studiengangsname || !Array.isArray(SemesterModule) || SemesterModule.length !== 6) {
      return res.status(400).json({ message: "Studiengangsname and SemesterModule (6 arrays) are required!" });
    }

    // Convert module IDs to MongoDB ObjectIds, ensuring valid format
    const validSemesterModules = SemesterModule.map(semester =>
      Array.isArray(semester)
        ? semester.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
        : []
    );
    console.log(validSemesterModules)
    // Create a new Studiengang entry
    const newSG = new SG({
      Studiengangsname,
      ModuleSem1: validSemesterModules[0],
      ModuleSem2: validSemesterModules[1],
      ModuleSem3: validSemesterModules[2],
      ModuleSem4: validSemesterModules[3],
      ModuleSem5: validSemesterModules[4],
      ModuleSem6: validSemesterModules[5],
      FrühsteUhrzeit: "7",
      SpätesteUhrzeit: "18",
      MaximaleBlockdauerMin: 180,
      DauerMittagspauseMin: 60
    });

    // Save to database
    await newSG.save();

    res.status(201).json({ success: true, employee: newSG });
  } catch (err) {
    console.error("Error saving Studiengang:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST edit a SG
router.put('/edit', async (req, res) => {
  const { id, Studiengangsname, SemesterModule } = req.body;

  try {
    // Prüfe, ob die ID gültig ist
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Ungültige ID" });
    }

    // Prüfe, ob die erforderlichen Daten vorhanden sind
    if (!Studiengangsname || !Array.isArray(SemesterModule) || SemesterModule.length !== 6) {
      return res.status(400).json({ message: "Studiengangsname und 6 Semester-Module sind erforderlich!" });
    }

    // Konvertiere Modul-IDs zu gültigen ObjectIds
    const validSemesterModules = SemesterModule.map(semester =>
      Array.isArray(semester)
        ? semester.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
        : []
    );

    // Studiengang aktualisieren
    const updatedSG = await SG.findByIdAndUpdate(
      id,
      {
        Studiengangsname,
        ModuleSem1: validSemesterModules[0],
        ModuleSem2: validSemesterModules[1],
        ModuleSem3: validSemesterModules[2],
        ModuleSem4: validSemesterModules[3],
        ModuleSem5: validSemesterModules[4],
        ModuleSem6: validSemesterModules[5],
      },
      { new: true } // Gibt das aktualisierte Dokument zurück
    );

    // Falls kein Studiengang gefunden wurde
    if (!updatedSG) {
      return res.status(404).json({ message: "Studiengang nicht gefunden!" });
    }

    res.status(200).json({ success: true, employee: updatedSG });
  } catch (err) {
    console.error("Fehler beim Bearbeiten des Studiengangs:", err);
    res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// POST edit a SG
router.put('/hours', async (req, res) => {
  const { id, earliest, latest } = req.body;
  console.log(id, earliest, latest)
  try {
    // Prüfe, ob die ID gültig ist
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Ungültige ID" });
    }

    // Studiengang aktualisieren
    const updatedSG = await SG.findByIdAndUpdate(
      id,
      {
        FrühsteUhrzeit: earliest,
        SpätesteUhrzeit: latest,
      },
      { new: true } // Gibt das aktualisierte Dokument zurück
    );

    // Falls kein Studiengang gefunden wurde
    if (!updatedSG) {
      return res.status(404).json({ message: "Studiengang nicht gefunden!" });
    }

    res.status(200).json({ success: true, employee: updatedSG });
  } catch (err) {
    console.error("Fehler beim Bearbeiten des Studiengangs:", err);
    res.status(500).json({ message: "Interner Serverfehler" });
  }
});




// DELETE a SG
router.delete('/delete', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No employee IDs provided' });
  }

  try {
      // Delete employees by their IDs
      const result = await SG.deleteMany({ _id: { $in: ids } });

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

          return res.status(200).json({ success: true, message: `${result.deletedCount} SG wurden erfolgreich gelöscht.` });
      } else {
          return res.status(404).json({ success: false, message: 'Kein Modul gefunden.' });
      }
      
  } catch (error) {
      console.error('Error deleting employees and updating projects:', error);
      return res.status(500).json({ success: false, message: 'An error occurred while deleting employees and updating projects' });
  }
});

module.exports = router;
