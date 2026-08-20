const form = document.getElementById('form-solicitud');
const btnEnviar = document.getElementById('btn-enviar');
const mensajeExito = document.getElementById('mensaje-exito');
const mensajeError = document.getElementById('mensaje-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Limpiar mensajes anteriores
  mensajeExito.classList.add('hidden');
  mensajeError.classList.add('hidden');
  mensajeError.textContent = '';

  // Deshabilitar botón
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  const formData = {
    nombre_completo: document.getElementById('nombre_completo').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    email: document.getElementById('email').value.trim(),
    monto_aproximado: document.getElementById('monto_aproximado').value,
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
