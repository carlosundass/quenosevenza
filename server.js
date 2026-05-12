const express = require('express');
const path = require('path');
const app = express();

// CAMBIO CLAVE: Render asigna el puerto dinámicamente
const PORT = process.env.PORT || 3000;

// Desactiva el caché del navegador para evitar errores de navegación
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Sirve archivos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Mapa exacto de rutas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/pago.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pago.html')));
app.get('/reportes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reportes.html')));

app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`🚀 SERVIDOR "QUE NO SE VENZA" ACTIVO EN LA NUBE`);
    console.log(`📱 Puerto detectado: ${PORT}`);
    console.log(`===========================================`);
});