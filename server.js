const express = require('express');
const path = require('path');
const { MercadoPagoConfig, Preapproval, Payment } = require('mercadopago'); // Importamos Preapproval para suscripciones
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

// 2. CONFIGURACIÓN MERCADO PAGO (v2)
const client = new MercadoPagoConfig({ 
    accessToken: 'TEST-5629530076938828-051213-7d63b898d055daef6f20533412bae22f-248724686' 
});

app.use(express.json());

// Desactiva el caché para evitar problemas de navegación
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// RUTA PARA CREAR LA SUSCRIPCIÓN AUTOMÁTICA
app.post('/create_subscription', async (req, res) => {
    const { idCliente, correo, nombreLocal } = req.body;
    
    // Instanciamos el plan de suscripción
    const preapproval = new Preapproval(client);

    try {
        const response = await preapproval.create({
            body: {
                reason: `Mensualidad Que No Se Venza - ${nombreLocal}`,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months", // Se cobra cada 1 mes exacto
                    transaction_amount: 15000,
                    currency_id: "CLP"
                },
                payer_email: correo,
                back_url: "https://quenosevenza.onrender.com/pago.html",
                external_reference: String(idCliente), // ID del cliente para que el Webhook lo reconozca
                status: "pending"
            }
        });
        
        // Devolvemos el link seguro de Mercado Pago donde el cliente pondrá su tarjeta
        res.json({ init_point: response.init_point });
    } catch (error) {
        console.error("Error al crear suscripción:", error);
        res.status(500).send("Error al crear la suscripción");
    }
});

// WEBHOOK: La oreja que escucha cuando los pagos recurrentes se aprueban
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
                    let nuevaF = new Date(y, parseInt(m), d); // Suma un mes automáticamente
                    const nStr = `${nuevaF.getFullYear()}-${String(nuevaF.getMonth()+1).padStart(2,'0')}-${String(nuevaF.getDate()).padStart(2,'0')}`;

                    await clienteRef.update({ fechaPago: nStr, activo: true });
                    console.log(`✅ Mensualidad cobrada con éxito. Renovado: ${idCliente} hasta ${nStr}`);
                }
            }
        } catch (e) { console.error("Error en Webhook:", e); }
    }
    res.sendStatus(200);
});

// Rutas fijas del sistema
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/pago.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pago.html')));
app.get('/reportes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reportes.html')));

app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`🚀 SERVIDOR "QUE NO SE VENZA" ACTIVO`);
    console.log(`📱 Puerto detectado: ${PORT}`);
    console.log(`===========================================`);
});