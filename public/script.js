const form = document.getElementById('form-solicitud');
const btnEnviar = document.getElementById('btn-enviar');
const mensajeExito = document.getElementById('mensaje-exito');
const mensajeError = document.getElementById('mensaje-error');
const montoInput = document.getElementById('monto_aproximado');

// Formatear miles con punto (estilo argentino: 50.000)
function formatMiles(value) {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function unformatMiles(value) {
    return value.replace(/\D/g, '');
}

montoInput.addEventListener('input', (e) => {
    const cursor = e.target.selectionStart;
    const oldLength = e.target.value.length;
    e.target.value = formatMiles(e.target.value);
    const newLength = e.target.value.length;
    // Ajustar cursor al agregar/quitar puntos
    const diff = newLength - oldLength;
    e.target.setSelectionRange(cursor + diff, cursor + diff);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    mensajeExito.classList.add('hidden');
    mensajeError.classList.add('hidden');
    mensajeError.textContent = '';

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    const montoRaw = unformatMiles(montoInput.value);

    const formData = {
        nombre_completo: document.getElementById('nombre_completo').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        email: document.getElementById('email').value.trim(),
        monto_aproximado: montoRaw,
        horario_preferido: document.getElementById('horario_preferido').value
    };

    try {
        const response = await fetch('/api/solicitudes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            mensajeExito.classList.remove('hidden');
            form.reset();
        } else {
            const errorMsg = data.errors
                ? data.errors.join(' ')
                : (data.error || 'Ocurrió un error. Intenta nuevamente.');
            mensajeError.textContent = errorMsg;
            mensajeError.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        mensajeError.textContent = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
        mensajeError.classList.remove('hidden');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar solicitud';
    }
});
