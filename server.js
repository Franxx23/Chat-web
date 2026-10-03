const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. Configuración de la Base de Datos con Variables de Entorno
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chat_db',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

// Verificar conexión a la BD
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar a MySQL:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos MySQL');
        connection.release();
    }
});

// Crear la carpeta 'uploads' si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configuración de almacenamiento Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Servir archivos estáticos
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta principal abre automáticamente Estructura.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Estructura.html'));
});

// Ruta para subir fotos y videos
app.post('/upload', upload.single('archivo'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No se subió ningún archivo.');
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;
    res.json({ url: fileUrl, type: fileType });
});

// Websockets
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Enviar historial
    db.query('SELECT * FROM mensajes ORDER BY fecha ASC', (err, resultados) => {
        if (!err) {
            socket.emit('historial', resultados);
        } else {
            console.error('Error al obtener historial:', err);
        }
    });

    // Guardar y transmitir mensajes
    socket.on('mensaje', (datos) => {
        const sql = 'INSERT INTO mensajes (emisor_id, tipo, contenido, texto) VALUES (?, ?, ?, ?)';
        const valores = [datos.usuarioId, datos.tipo, datos.contenido, datos.texto || null];

        db.query(sql, valores, (err, resultado) => {
            if (err) {
                console.error('Error al guardar en BD:', err);
                return;
            }
            io.emit('mensaje', datos);
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// Puerto asignado por el servidor de la nube o 3000 en local
const PUERTO = process.env.PORT || 3000;
server.listen(PUERTO, () => {
    console.log(`Servidor corriendo en el puerto: ${PUERTO}`);
});
// Verificar conexión a la BD y crear tabla si no existe
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar a MySQL:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos MySQL');
        
        const sqlTabla = `
            CREATE TABLE IF NOT EXISTS mensajes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emisor_id VARCHAR(100) NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                contenido TEXT NOT NULL,
                texto TEXT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        connection.query(sqlTabla, (errTabla) => {
            if (errTabla) {
                console.error('Error al crear la tabla:', errTabla.message);
            } else {
                console.log('✅ Tabla "mensajes" verificada/creada con éxito.');
            }
            connection.release();
        });
    }
});
