# Generador de QR

Generador de QR con exportación de PNG/SVG. Los QR estáticos se generan en el navegador. Los QR dinámicos usan funciones de Vercel y Redis de Upstash.

## QR dinámicos

En la pestaña **Texto / URL**, abre **QR dinámico**, introduce una URL `https://` o `http://` y pulsa **Crear QR dinámico**. El código apunta a `/r/<id>`; puedes cambiar su URL con **Editar** y el QR impreso seguirá siendo el mismo. La clave permite administrar todos los QR dinámicos del proyecto.

Para activarlos en Vercel:

1. Instala una base Redis desde Vercel Marketplace y conecta la integración al proyecto. Debe proporcionar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
2. Configura `QR_ADMIN_TOKEN` en las variables de entorno del proyecto Vercel. Usa una clave larga y aleatoria, igual en producción, preview y desarrollo según los entornos donde quieras habilitar la administración.
3. Vuelve a desplegar. El despliegue incluye las funciones `/api/dynamic` y `/r/[id]`.

La clave de administración nunca se guarda en el navegador. Los datos de destino se guardan en Redis. En desarrollo local también hacen falta las tres variables anteriores (por ejemplo, mediante `vercel env pull`). Sin Redis y la clave, la generación estática sigue disponible, pero la administración dinámica no.

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
- `app.js`: interfaz y generación de códigos QR
- `api/`: funciones Vercel para crear, editar, listar, eliminar y resolver destinos dinámicos
- `vendor/qrcode.js`: librería QR (versión con soporte UTF-8)