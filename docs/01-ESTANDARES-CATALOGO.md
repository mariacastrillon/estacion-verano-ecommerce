# Estándares del Catálogo

**Proyecto:** Estación Verano  
**Documento:** Estándares oficiales para productos, variantes e imágenes  
**Última actualización:** 05 de agosto de 2026

---

## 1. Propósito del documento

Este documento define las reglas oficiales para crear, modificar y mantener los productos del catálogo de Estación Verano.

Su objetivo es asegurar que todos los productos:

- tengan una estructura consistente;
- sean fáciles de encontrar y modificar;
- funcionen correctamente en el catálogo;
- mantengan compatibilidad con las variantes de color;
- conserven una calidad visual uniforme;
- sean fáciles de escalar a medida que crezca la tienda.

Estas reglas deben aplicarse cada vez que se agregue un producto nuevo, una variante, una talla o una imagen.

---

## 2. Estructura general de un producto

Cada producto debe contener como mínimo las siguientes propiedades:

```js
{
  id: "nombre-del-producto",

  activo: true,
  favorito: false,

  categoria: "trajes",

  nombre: "Nombre del Producto",
  precio: "80.000",

  palabrasClave: [],
  etiquetas: [],

  descripcion: "",

  variantes: []
}
```

### Propiedades obligatorias

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | String | Identificador único del producto |
| `activo` | Boolean | Indica si el producto aparece en la tienda |
| `favorito` | Boolean | Indica si aparece entre los favoritos destacados |
| `categoria` | String | Categoría principal del producto |
| `nombre` | String | Nombre comercial visible |
| `precio` | String | Precio mostrado en pesos colombianos |
| `palabrasClave` | Array | Términos usados en búsqueda |
| `etiquetas` | Array | Indicadores visuales como nuevo o favorito |
| `descripcion` | String | Texto descriptivo del producto |
| `variantes` | Array | Colores o versiones disponibles |

---

## 3. Convención para el ID

El `id` debe ser único y no debe repetirse entre productos.

### Reglas

- Usar letras minúsculas.
- No usar espacios.
- Separar palabras con guiones.
- No usar tildes.
- No usar emojis.
- No usar caracteres especiales.
- Mantener el mismo ID aunque cambie el nombre visible.

### Correcto

```js
id: "noche-de-verano"
```

```js
id: "brisa-orquidea"
```

```js
id: "palma-blanca"
```

### Incorrecto

```js
id: "Noche de Verano"
```

```js
id: "noche_de_verano"
```

```js
id: "Noche-de-Verano🖤"
```

El ID se utiliza en las rutas de la aplicación, por ejemplo:

```text
/producto/noche-de-verano
```

Por esta razón, no debe modificarse después de publicar el producto, salvo que exista una razón técnica importante.

---

## 4. Estado del producto

### Producto activo

```js
activo: true
```

El producto aparece en el catálogo y puede ser encontrado por las clientas.

### Producto inactivo

```js
activo: false
```

El producto permanece guardado en el archivo, pero no aparece en la tienda.

Se recomienda desactivar un producto en lugar de borrarlo cuando:

- está agotado temporalmente;
- volverá a estar disponible;
- se quiere conservar su información;
- se necesita mantener su historial.

---

## 5. Producto favorito

La propiedad `favorito` determina si el producto aparece en la sección destacada de la página de inicio.

```js
favorito: true
```

Debe utilizarse solo para productos que realmente se quieran destacar.

No se recomienda marcar demasiados productos como favoritos, porque perdería valor la sección principal.

Cantidad recomendada:

```text
3 a 6 productos destacados
```

---

## 6. Categorías permitidas

Cada producto debe pertenecer a una categoría válida.

Ejemplo:

```js
categoria: "trajes"
```

Categorías actuales o recomendadas:

```text
trajes
salidas
gafas
accesorios
bolsos
```

Las categorías deben escribirse:

- en minúsculas;
- sin tildes;
- sin espacios innecesarios;
- siempre de la misma manera.

### Correcto

```js
categoria: "trajes"
```

### Incorrecto

```js
categoria: "Trajes de baño"
```

```js
categoria: "TRAjES"
```

No se debe inventar una nueva categoría sin revisar primero cómo afecta los filtros y las rutas del catálogo.

---

## 7. Nombre comercial del producto

El nombre visible debe ser:

- corto;
- fácil de recordar;
- coherente con la identidad de Estación Verano;
- diferente a otros nombres existentes;
- relacionado con verano, mar, naturaleza, feminidad o vacaciones.

### Ejemplos

```text
Noche de Verano
Brisa Orquídea
Luna Negra
Fuccia Tropical
Mar de Cristal
Palma Blanca
Costa Verde
```

### Reglas de escritura

- Usar mayúscula inicial en palabras importantes.
- No escribir todo en mayúsculas.
- Evitar nombres demasiado largos.
- Evitar nombres difíciles de pronunciar.
- Evitar repetir palabras usadas en demasiados productos.

### Recomendación

Preferir nombres de dos o tres palabras.

```text
Brisa Orquídea
Noche de Verano
Mar Celeste
```

---

## 8. Precio

El precio se guarda como texto.

Ejemplo:

```js
precio: "80.000"
```

No debe incluir:

```text
$
COP
pesos
```

La interfaz agrega el símbolo de moneda automáticamente.

### Correcto

```js
precio: "80.000"
```

### Incorrecto

```js
precio: "$80.000"
```

```js
precio: 80000
```

```js
precio: "80.000 COP"
```

Todos los precios deben mantener el mismo formato.

---

## 9. Descripción del producto

La descripción debe explicar:

- qué tipo de producto es;
- cuántas piezas incluye;
- qué lo hace especial;
- en qué ocasiones puede usarse;
- qué sensación o estilo transmite.

### Extensión recomendada

Entre 25 y 60 palabras.

### Ejemplo

```js
descripcion:
  "Un set de 4 piezas que incluye bikini, blusa y falda. Su diseño combina comodidad y presencia para disfrutar de la playa, la piscina o un beach club."
```

### Reglas

- No exagerar beneficios.
- No usar afirmaciones falsas.
- No describir materiales que no estén confirmados.
- No repetir el nombre del producto demasiadas veces.
- Evitar palabras vacías como “perfecto”, “premium” o “lujoso” si no aportan información real.
- Mantener un tono fresco, femenino y directo.

---

## 10. Palabras clave

Las palabras clave permiten encontrar productos mediante la búsqueda interna.

Ejemplo:

```js
palabrasClave: [
  "4 piezas",
  "cuatro piezas",
  "salida",
  "falda",
  "blusa",
  "negro"
]
```

### Reglas

- Incluir sinónimos útiles.
- Incluir formas numéricas y escritas si aplica.
- Incluir colores.
- Incluir tipo de producto.
- Incluir piezas que contiene.
- No repetir palabras.
- No agregar palabras que no describan el producto.

### Ejemplo

Para un set de tres piezas:

```js
palabrasClave: [
  "3 piezas",
  "tres piezas",
  "bikini",
  "pareo",
  "salida"
]
```

---

## 11. Etiquetas

Las etiquetas se usan para destacar información visible del producto.

Ejemplo:

```js
etiquetas: [
  "nuevo"
]
```

Etiquetas recomendadas:

```text
nuevo
favorito
mas-vendido
pocas-unidades
nuevo-color
oferta
```

### Reglas

- Usar minúsculas.
- Separar palabras con guiones.
- No agregar demasiadas etiquetas.
- Usar solo etiquetas que sean verdaderas.
- No marcar un producto como nuevo durante demasiado tiempo.

Cantidad recomendada:

```text
1 o 2 etiquetas por producto
```

---

## 12. Estructura de variantes

Las variantes representan los colores o versiones disponibles de un mismo producto.

Ejemplo:

```js
variantes: [
  {
    id: "negro",
    nombre: "Negro",
    codigo: "#111111",
    miniatura: "/productos/nochedv-frontal.webp",
    imagenes: [
      "/productos/nochedv-frontal.webp",
      "/productos/nochedv-detalle.webp",
      "/productos/nochedv-producto.webp"
    ],
    tallas: ["S", "L", "XL"]
  }
]
```

Cada producto debe tener al menos una variante.

Si el producto solo existe en un color, igualmente debe tener una variante.

---

## 13. Propiedades de una variante

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | String | Identificador interno del color |
| `nombre` | String | Nombre visible del color |
| `codigo` | String | Color de la variante en formato hexadecimal |
| `miniatura` | String | Imagen usada en el selector de variantes |
| `imagenes` | Array | Galería completa de esa variante |
| `tallas` | Array | Tallas disponibles para ese color |

### Ejemplo con dos colores

```js
variantes: [
  {
    id: "negro",
    nombre: "Negro",
    codigo: "#111111",
    miniatura: "/productos/nochedv-frontal.webp",
    imagenes: [
      "/productos/nochedv-frontal.webp",
      "/productos/nochedv-detalle.webp",
      "/productos/nochedv-producto.webp"
    ],
    tallas: ["S", "L", "XL"]
  },
  {
    id: "azul",
    nombre: "Azul",
    codigo: "#1E5EFF",
    miniatura: "/productos/nochedv-azul-frontal.webp",
    imagenes: [
      "/productos/nochedv-azul-frontal.webp",
      "/productos/nochedv-azul-detalle.webp",
      "/productos/nochedv-azul-producto.webp"
    ],
    tallas: ["L", "XL"]
  }
]
```

---

## 14. Convención para IDs de variantes

El ID de la variante debe representar el color.

### Correcto

```js
id: "negro"
```

```js
id: "azul-rey"
```

```js
id: "rosa-fuccia"
```

### Incorrecto

```js
id: "color1"
```

```js
id: "variante-azul-noche-de-verano"
```

```js
id: "Azul"
```

Los IDs deben mantenerse simples y reutilizables.

---

## 15. Código hexadecimal de la variante

El campo `codigo` guarda directamente el color hexadecimal usado por la variante.
No representa un SKU ni una referencia de inventario.

Ejemplo:

```js
codigo: "#111111"
```

Formato requerido:

```text
#RRGGBB
```

Ejemplos:

```text
#111111
#1E5EFF
#608963
#D10073
```

El código debe:

- comenzar con `#`;
- contener seis dígitos hexadecimales;
- representar visualmente el color de la variante;
- guardarse siempre en `codigo`, sin crear un campo `colorHex` separado.

---

## 16. Tallas

Las tallas se guardan dentro de cada variante.

Ejemplo:

```js
tallas: ["S", "M", "L", "XL"]
```

Esto permite que cada color tenga disponibilidad diferente.

### Orden oficial

```text
XS
S
M
L
XL
XXL
```

No se deben mezclar formatos como:

```text
Pequeña
S
Small
```

Debe utilizarse siempre el mismo sistema.

---

## 17. Convención para nombres de imágenes

Los nombres de archivo deben ser:

- en minúsculas;
- sin tildes;
- sin espacios;
- separados por guiones;
- fáciles de relacionar con el producto.

Formato recomendado:

```text
producto-color-tipo.webp
```

Ejemplos:

```text
noche-de-verano-negro-frontal.webp
noche-de-verano-negro-detalle.webp
noche-de-verano-negro-producto.webp

noche-de-verano-azul-frontal.webp
noche-de-verano-azul-detalle.webp
noche-de-verano-azul-trasera.webp
```

En productos antiguos pueden existir nombres abreviados como:

```text
nochedv-frontal.webp
```

Se pueden conservar, pero para productos nuevos se recomienda utilizar nombres más descriptivos.

---

## 18. Tipos de imagen

Se recomienda utilizar estas palabras:

```text
frontal
trasera
lateral
detalle
producto
top
pantye
pareo
```

Ejemplo:

```text
brisa-orquidea-azul-frontal.webp
brisa-orquidea-azul-trasera.webp
brisa-orquidea-azul-detalle.webp
```

---

## 19. Orden de las imágenes

El orden recomendado de la galería es:

1. Frontal.
2. Trasera.
3. Lateral.
4. Detalle.
5. Producto completo.
6. Piezas individuales.

Ejemplo:

```js
imagenes: [
  "/productos/noche-de-verano-azul-frontal.webp",
  "/productos/noche-de-verano-azul-trasera.webp",
  "/productos/noche-de-verano-azul-lateral.webp",
  "/productos/noche-de-verano-azul-detalle.webp"
]
```

La primera imagen debe ser siempre la mejor fotografía principal del producto.

---

## 20. Formato de imagen

Formato oficial:

```text
WebP
```

Ventajas:

- menor peso;
- buena calidad;
- compatible con navegadores modernos;
- mejora el rendimiento.

No se recomienda usar directamente en el catálogo:

```text
JPG
JPEG
PNG
```

salvo en casos especiales de branding o transparencia.

---

## 21. Imágenes responsivas

El proyecto genera versiones optimizadas de las imágenes:

```text
480w
768w
```

Ejemplo:

```text
noche-de-verano-azul-frontal-480w.webp
noche-de-verano-azul-frontal-768w.webp
```

Estas versiones permiten que el navegador descargue una imagen adecuada según el dispositivo.

Cuando se agreguen imágenes nuevas, debe ejecutarse el script correspondiente:

```bash
node herramientas/generar-variantes-responsivas.js
```

Después se debe comprobar que las nuevas versiones fueron creadas correctamente.

---

## 22. Reglas antes de publicar un producto

Antes de activar un producto, verificar:

- [ ] El ID es único.
- [ ] `activo` está configurado correctamente.
- [ ] La categoría existe.
- [ ] El precio tiene el formato correcto.
- [ ] La descripción está completa.
- [ ] Las palabras clave son útiles.
- [ ] Las etiquetas son verdaderas.
- [ ] Existe al menos una variante.
- [ ] Cada variante tiene un ID único.
- [ ] Cada variante tiene una miniatura.
- [ ] Las rutas de las imágenes funcionan.
- [ ] Las tallas están en orden.
- [ ] Las imágenes están en WebP.
- [ ] Se generaron las versiones responsivas.
- [ ] El producto abre correctamente en la tienda.
- [ ] El mensaje de WhatsApp incluye la variante correcta.

---

## 23. Regla principal

El producto contiene la información común.

La variante contiene la información que cambia entre colores.

### Información común

```text
nombre
precio
descripcion
categoria
palabras clave
etiquetas
```

### Información variable

```text
color
codigo
miniatura
imagenes
tallas
```

No se debe duplicar el mismo producto únicamente porque cambie de color.

Ejemplo incorrecto:

```text
Noche de Verano Negro
Noche de Verano Azul
```

Ejemplo correcto:

```text
Noche de Verano

- Negro
- Azul
```

---

## 24. Mantenimiento del documento

Este documento debe actualizarse cuando cambie:

- la estructura de los productos;
- la arquitectura de variantes;
- el sistema de imágenes;
- las categorías;
- las etiquetas;
- las reglas del catálogo.

Toda modificación importante debe quedar registrada también en el archivo:

```text
CHANGELOG.md
```
