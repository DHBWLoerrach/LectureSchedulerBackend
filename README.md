1. Projekt klonen
2. Im Projektverzeichnis `npm install` ausführen
3. Lokale Mongo-DB bereitstellen, z.B. als Docker-Container:
- `docker pull mongo`
- `docker run --name mongodb -d -p 27017:27017 mongo`
4. Mit der Mongo-DB verbinden, z.B. mit `mongosh`:
- `mongosh "mongodb://localhost:27017"`
5. Im Projekt Passwort-Hash in Node.js erstellen (wird gleich für Admin-User benötigt): 
```js
const bcrypt = require('bcryptjs');
bcrypt.hash("enter_password", 10).then(console.log); // z.B. 123 als Passwort 
```
- Das in der Konsole ausgegebene gehashte Passwort kopieren (gleich für den Admin-User)
5. In der Mongo-DB einen Admin-User erstellen, hier in der Shell von `mongosh`:
```mongo
use Personen
db.Benutzer.insertOne({
  Benutzername: "admin",
  Passwort: "enter_password_hash",  // <-- Hash für das Passwort (siehe oben)
  Nachname: "Admin",
  Vorname: "Arnold",
  Berechtigung: "Admin"
})
```
6. Datei `.env` erstelle und `JWT_SECRET` eintragen: 
```
JWT_SECRET=mylocaltestsecret123
```
- Achtung: Dieses Beispiel für `JWT_SECRET` ist nur für lokale Test- und Entwicklungsumgebungen, nicht für produktive Server!
7. `node server.js` startet den Webserver für das Backend 

