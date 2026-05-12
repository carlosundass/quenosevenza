const express = require('express');
const path = require('path');
const mercadopago = require('mercadopago');
const admin = require('firebase-admin');

const app = express();
// Render asigna el puerto dinámicamente
const PORT = process.env.PORT || 3000;

// 1. CONFIGURACIÓN FIREBASE ADMIN (Para actualizar la base desde el servidor)
// Asegúrate de poner el nombre exacto de tu archivo json
const serviceAccount = require("./llavefirebase.json"); 
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. CONFIGURACIÓN MERCADO PAGO (Con tu Access Token de prueba)
mercadopago.configure({
    access_token: 'TEST-5629530076938828-051213-7d63b898d055daef6f20533412bae22f-248724686'
});

app.use(express.json());
// Desactiva el caché del navegador para evitar errores de navegación
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// RUTA PARA CREAR LA ORDEN DE PAGO (Llamada desde pago.html)
app.post('/create_preference', async (req, res) => {
    const { idCliente, nombreLocal } = req.body;

    let preference = {
        items: [
            {
                title: `Mensualidad Que No Se Venza - ${nombreLocal}`,
                unit_price: 15000,
                quantity: 1,
                currency_id: 'CLP'
            }
        ],
        external_reference: String(idCliente), // ID del cliente para saber a quién activar
        back_urls: {
            success: "https://quenosevenza.onrender.com/pago.html",
            failure: "https://quenosevenza.onrender.com/pago.html",
        },
        auto_return: "approved",
        // ESTA ES LA RUTA QUE MERCADO PAGO LLAMARÁ AUTOMÁTICAMENTE (WEBHOOK)
        notification_url: "https://quenosevenza.onrender.com/webhook", 
    };

    try {
        const response = await mercadopago.preferences.create(preference);
        res.json({ id: response.body.id });
    } catch (error) {
        console.error("Error al crear preferencia:", error);
        res.status(500).send("Error al crear la preferencia");
    }
});

// EL WEBHOOK: La oreja que escucha cuando el pago es real
app.post('/webhook', async (req, res) => {
    const { query } = req;
    const topic = query.topic || query.type;

    if (topic === 'payment') {
        const paymentId = query.id || query['data.id'];
        try {
            // Buscamos los detalles del pago en Mercado Pago
            const data = await mercadopago.payment.findById(paymentId);
            const status = data.body.status;
            const idCliente = data.body.external_reference;

            // Si Mercado Pago nos dice que está aprobado...
            if (status === 'approved') {
                console.log(`✅ ¡Dinero recibido! Activando cliente: ${idCliente}`);
                
                // Entramos a Firebase como administradores y lo actualizamos
                const clienteRef = db.collection('clientes').doc(idCliente);
                const doc = await clienteRef.get();

                if (doc.exists) {
                    const datos = doc.data();
                    let [y, m, d] = datos.fechaPago.split('-');
                    let nuevaF = new Date(y, parseInt(m), d); // JS suma un mes automáticamente
                    
                    const nStr = `${nuevaF.getFullYear()}-${String(nuevaF.getMonth()+1).padStart(2,'0')}-${String(nuevaF.getDate()).padStart(2,'0')}`;

                    await clienteRef.update({
                        fechaPago: nStr,
                        activo: true
                    });
                    console.log(`Suscripción renovada hasta: ${nStr}`);
                }
            }
        } catch (e) { 
            console.error("Error en Webhook:", e); 
        }
    }
    // SIEMPRE hay que responderle 200 a Mercado Pago para que sepa que recibimos el aviso
    res.sendStatus(200);
});

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