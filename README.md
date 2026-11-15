# Generador de QR

Web estática, sin build ni dependencias de npm en producción. La librería (`qrcode-generator`, MIT) está incluida en `vendor/`.

## Despliegue en Vercel
https://qr-generator-swart-phi.vercel.app/
**Opción A: CLI**

```bash
cd qr-generator
npx vercel        # primera vez: acepta los valores por defecto
npx vercel --prod
```

Cuando pregunte por el framework, deja "Other". No hay build command ni output directory.

**Opción B: GitHub**

1. Sube la carpeta a un repositorio.
2. En vercel.com → Add New → Project → importa el repo.
3. Framework Preset: Other. Deploy.

## Estructura

- `index.html`: interfaz
- `style.css`: estilos (modo claro/oscuro automático)
- `app.js`: lógica (tipos de contenido, render en canvas, export PNG/SVG)
- `vendor/qrcode.js`: librería QR (versión con soporte UTF-8)
