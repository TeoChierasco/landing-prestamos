require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ACTIVAR TRUST PROXY PARA RENDER
app.set('trust proxy', 1);

console.log('DEBUG trust proxy:', app.get('trust proxy'));
console.log(
    'DEBUG express-rate-limit:',
    require('express-rate-limit/package.json').version
);

// ========== Middlewares ==========
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (con validación deshabilitada para Render)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
    validate: { xForwardedForHeader: false }
});
app.use('/api/', limiter);

// ========== Auth Admin ==========
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acceso denegado' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
}

// ========== Validación de teléfono argentino ==========
function normalizarTelefono(tel) {
    let digits = tel.replace(/\D/g, '');

    if (digits.startsWith('54') && digits.length >= 12) {
        digits = digits.slice(2);
    }

    if (digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    if (digits.length === 10 && !digits.startsWith('9')) {
        digits = '9' + digits;
    }

    return digits;
}

function validarTelefonoArgentino(tel) {
    const digits = normalizarTelefono(tel);
    return /^9\d{9,12}$/.test(digits);
}

function validarSolicitud(body) {
    const errores = [];

    if (!body.nombre_completo || body.nombre_completo.trim().length < 3) {
        errores.push('El nombre completo es obligatorio (mínimo 3 caracteres).');
    }

    if (!body.telefono || !validarTelefonoArgentino(body.telefono)) {
        errores.push('Ingresá un teléfono / WhatsApp argentino válido (ej: +54 9 299 328-7480).');
    }

    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        errores.push('El email no es válido.');
    }

    const monto = Number(body.monto_aproximado);
    if (!monto || isNaN(monto) || monto < 1000) {
        errores.push('El monto aproximado debe ser un número mayor o igual a 1000.');
    }

    return errores;
}

// ========== Notificación por email (Resend) ==========
async function enviarNotificacionEmail(solicitud) {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!apiKey || !adminEmail) {
        console.log('Notificación por email desactivada (falta RESEND_API_KEY o ADMIN_EMAIL)');
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Solicitudes <onboarding@resend.dev>',
                to: [adminEmail],
                subject: `Nueva solicitud de préstamo - $${Number(solicitud.monto_aproximado).toLocaleString('es-AR')}`,
                html: `
          <h2>Nueva solicitud de préstamo</h2>
          <p><strong>Nombre:</strong> ${solicitud.nombre_completo}</p>
          <p><strong>Teléfono / WhatsApp:</strong> ${solicitud.telefono}</p>
          <p><strong>Email:</strong> ${solicitud.email}</p>
          <p><strong>Monto solicitado:</strong> $${Number(solicitud.monto_aproximado).toLocaleString('es-AR')}</p>
          <p><strong>Horario preferido:</strong> ${solicitud.horario_preferido || 'Sin preferencia'}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
          <hr>
          <p>Entrá al panel de admin para gestionarla.</p>
        `
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Error enviando email:', err);
        } else {
            console.log('Notificación enviada a', adminEmail);
        }
    } catch (err) {
        console.error('Error en notificación:', err.message);
    }
}

// ========== Endpoint público: crear solicitud ==========
app.post('/api/solicitudes', async (req, res) => {
    try {
        const errores = validarSolicitud(req.body);
        if (errores.length > 0) {
            return res.status(400).json({ success: false, errors: errores });
        }

        const { nombre_completo, telefono, email, monto_aproximado, horario_preferido } = req.body;
        const telefonoLimpio = normalizarTelefono(telefono);

        const { data, error } = await supabase
            .from('solicitudes_prestamos')
            .insert([
                {
                    nombre_completo: nombre_completo.trim(),
                    telefono: telefonoLimpio,
                    email: email.trim().toLowerCase(),
                    monto_aproximado: Number(monto_aproximado),
                    horario_preferido: horario_preferido?.trim() || null,
                    estado: 'pendiente'
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error Supabase:', error);
            return res.status(500).json({
                success: false,
                error: 'No se pudo guardar la solicitud. Intenta nuevamente.'
            });
        }

        console.log('Nueva solicitud recibida:', data.id);
        enviarNotificacionEmail(data).catch(() => { });

        return res.status(201).json({
            success: true,
            message: 'Solicitud recibida correctamente. Te contactaremos pronto.',
            id: data.id
        });
    } catch (err) {
        console.error('Error interno:', err);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor.'
        });
    }
});

// ========== ADMIN: Login ==========
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );

    return res.json({ success: true, token });
});

// ========== ADMIN: Listar solicitudes ==========
app.get('/api/admin/solicitudes', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('solicitudes_prestamos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error Supabase:', error);
            return res.status(500).json({ success: false, error: 'Error al obtener solicitudes' });
        }

        return res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ========== ADMIN: Actualizar estado ==========
app.patch('/api/admin/solicitudes/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const estadosValidos = ['pendiente', 'contactado', 'aprobado', 'rechazado', 'completado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ success: false, error: 'Estado no válido' });
        }

        const { data, error } = await supabase
            .from('solicitudes_prestamos')
            .update({ estado })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error Supabase:', error);
            return res.status(500).json({ success: false, error: 'Error al actualizar' });
        }

        return res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Rutas de páginas
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/terminos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terminos.html'));
});
app.get('/privacidad', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacidad.html'));
});

// Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== Arranque ==========
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});