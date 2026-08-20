# Landing Page de Préstamos

## Funcionalidades
- Landing responsive + formulario
- Guardado en Supabase
- Panel admin (`/admin`)
- Validación teléfono argentino
- Términos y Política de Privacidad
- WhatsApp del cliente configurado
- Notificación email opcional (Resend)

## Local
```bash
cp .env.example .env
# completar .env con tus claves
npm install
npm start
```

- Landing: http://localhost:3000
- Admin: http://localhost:3000/admin
- Términos: http://localhost:3000/terminos
- Privacidad: http://localhost:3000/privacidad

## Deploy en Render
1. Subir este código a GitHub (sin .env)
2. New → Web Service
3. Build: `npm install`
4. Start: `npm start`
5. Variables de entorno (ver .env.example)
