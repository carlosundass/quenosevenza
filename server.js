const express = require('express');
const path = require('path');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago'); // Nuevo formato v2
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CONFIGURACIÓN FIREBASE ADMIN
const serviceAccount = require(path.join(__dirname, 'llavefirebase.json')); 
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. NUEVA CONFIGURACIÓN MERCADO PAGO (v2)
const client = new MercadoPagoConfig({ 
    accessToken: 'TEST-5629530076938828-051213-7d63b898d055daef6f20533412bae22f-248724686' 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// RUTA PARA CREAR EL PAGO
app.post('/create_preference', async (req, res) => {
    const { idCliente, nombreLocal } = req.body;
    const preference = new Preference(client);

    try {
        const response = await preference.create({
            body: {
                items: [
                    {
                        title: `Mensualidad Que No Se Venza - ${nombreLocal}`,
                        unit_price: 15000,
                        quantity: 1,
                        currency_id: 'CLP'
                    }
                ],
                external_reference: String(idCliente),
                back_urls: {
                    success: "https://quenosevenza.onrender.com/pago.html",
                    failure: "https://quenosevenza.onrender.com/pago.html",
                },
                auto_return: "approved",
                notification_url: "https://quenosevenza.onrender.com/webhook", 
            }
        });
        res.json({ id: response.id });
    } catch (error) {
        console.error("Error al crear preferencia:", error);
        res.status(500).send("Error al crear la preferencia");
    }
});

// WEBHOOK ACTUALIZADO (v2)
app.post('/webhook', async (req, res) => {
    const { query } = req;
    const topic = query.topic || query.type;

    if (topic === 'payment') {
        const paymentId = query.id || query['data.id'];
        try {
            const payment = new Payment(client);
            const data = await payment.get({ id: paymentId });
            
            if (data.status === 'approved') {
                const idCliente = data.external_reference;
                const clienteRef = db.collection('clientes').doc(idCliente);
                const doc = await clienteRef.get();

                if (doc.exists) {
                    const datos = doc.data();
                    let [y, m, d] = datos.fechaPago.split('-');
                    let nuevaF = new Date(y, parseInt(m), d);
                    const nStr = `${nuevaF.getFullYear()}-${String(nuevaF.getMonth()+1).padStart(2,'0')}-${String(nuevaF.getDate()).padStart(2,'0')}`;

                    await clienteRef.update({ fechaPago: nStr, activo: true });
                }
            }
        } catch (e) { console.error("Error en Webhook:", e); }
    }
    res.sendStatus(200);
});

// Rutas fijas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/pago.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pago.html')));
app.get('/reportes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reportes.html')));

app.listen(PORT, () => console.log(`SaaS Online en puerto ${PORT}`));