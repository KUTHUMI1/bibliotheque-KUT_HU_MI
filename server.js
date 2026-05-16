const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Base de données SQLite
const db = new sqlite3.Database('./bibliotheque.db');

// Création des tables
db.serialize(() => {
    // Table des livres
    db.run(`
        CREATE TABLE IF NOT EXISTS livres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titre TEXT NOT NULL,
            auteur TEXT,
            editeur TEXT,
            theme TEXT,
            statut TEXT DEFAULT 'Disponible'
        )
    `);
    
    // Table des emprunts
    db.run(`
        CREATE TABLE IF NOT EXISTS emprunts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            email TEXT,
            livre_id INTEGER,
            livre_titre TEXT,
            montant INTEGER,
            date_emprunt TEXT,
            statut TEXT DEFAULT 'en_cours',
            FOREIGN KEY (livre_id) REFERENCES livres(id)
        )
    `);
});

// ========== ROUTES API ==========

// GET tous les livres
app.get('/api/books', (req, res) => {
    db.all('SELECT * FROM livres ORDER BY id', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST ajouter un livre
app.post('/api/books', (req, res) => {
    const { titre, auteur, editeur, theme, statut } = req.body;
    db.run(
        'INSERT INTO livres (titre, auteur, editeur, theme, statut) VALUES (?, ?, ?, ?, ?)',
        [titre, auteur || '', editeur || '', theme || 'Divers', statut || 'Disponible'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

// PUT modifier un livre
app.put('/api/books/:id', (req, res) => {
    const { titre, auteur, editeur, theme, statut } = req.body;
    db.run(
        'UPDATE livres SET titre=?, auteur=?, editeur=?, theme=?, statut=? WHERE id=?',
        [titre, auteur, editeur, theme, statut, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// DELETE supprimer un livre
app.delete('/api/books/:id', (req, res) => {
    db.run('DELETE FROM livres WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run('UPDATE emprunts SET statut="rendu" WHERE livre_id=? AND statut="en_cours"', [req.params.id]);
        res.json({ deleted: this.changes });
    });
});

// GET tous les emprunts
app.get('/api/borrowers', (req, res) => {
    db.all('SELECT * FROM emprunts ORDER BY id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST ajouter un emprunt
app.post('/api/borrowers', (req, res) => {
    const { nom, affiliation, email, livre_id, livre_titre, montant, date_emprunt } = req.body;
    db.run(
        'INSERT INTO emprunts (nom, affiliation, email, livre_id, livre_titre, montant, date_emprunt, statut) VALUES (?, ?, ?, ?, ?, ?, ?, "en_cours")',
        [nom, affiliation, email, livre_id, livre_titre, montant || 0, date_emprunt],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run('UPDATE livres SET statut="Emprunté" WHERE id=?', [livre_id]);
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

// PUT retourner un livre
app.put('/api/borrowers/:id/return', (req, res) => {
    db.get('SELECT livre_id FROM emprunts WHERE id=?', [req.params.id], (err, emprunt) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('UPDATE emprunts SET statut="rendu" WHERE id=?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (emprunt) {
                db.run('UPDATE livres SET statut="Disponible" WHERE id=?', [emprunt.livre_id]);
            }
            res.json({ returned: true });
        });
    });
});

// DELETE supprimer un emprunt
app.delete('/api/borrowers/:id', (req, res) => {
    db.run('DELETE FROM emprunts WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Servir l'application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});