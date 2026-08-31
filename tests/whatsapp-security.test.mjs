import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  crearMensajeProductoWhatsApp,
  crearUrlInternaAbsoluta,
  crearUrlWhatsApp,
} from "../src/config/whatsapp.js";

const ORIGIN = "https://estacionverano.com";
const producto = {
  id: "violeta-urbana",
  nombre: "Violeta Urbana",
  precio: "60.000",
};
const fuccia = {
  nombre: "Fuccia degradado",
  miniatura: "/productos/violeta-urbana-fuccia-01.webp",
  imagenes: ["/productos/violeta-urbana-fuccia-02.webp"],
};
const azul = {
  nombre: "Azul océano",
  miniatura: "/productos/violeta-urbana-azul-01.webp",
  imagenes: ["/productos/violeta-urbana-azul-02.webp"],
};

function crearMensaje(sobrescribir = {}) {
  return crearMensajeProductoWhatsApp({
    producto,
    variante: fuccia,
    cantidadVariantes: 2,
    talla: "S",
    origin: ORIGIN,
    ...sobrescribir,
  });
}

test("incluye producto, variante seleccionada, talla, precio y URLs correctas", () => {
  assert.equal(
    crearMensaje(),
    `Hola 👋 Quiero consultar disponibilidad de:

Producto: Violeta Urbana
Color: Fuccia degradado
Talla: S
Precio: $60.000

Foto: https://estacionverano.com/productos/violeta-urbana-fuccia-01.webp
Producto: https://estacionverano.com/producto/violeta-urbana

¿Está disponible? 🌴`
  );
});

test("cambiar variante cambia el color y la fotografía enviados", () => {
  const mensaje = crearMensaje({ variante: azul });
  assert.match(mensaje, /Color: Azul océano/);
  assert.match(mensaje, /violeta-urbana-azul-01\.webp/);
  assert.doesNotMatch(mensaje, /violeta-urbana-fuccia/);
});

test("usa imagenes[0] cuando la variante no tiene miniatura", () => {
  const mensaje = crearMensaje({
    variante: { nombre: "Coral", imagenes: ["/productos/coral-01.webp"] },
  });
  assert.match(mensaje, /Foto: https:\/\/estacionverano\.com\/productos\/coral-01\.webp/);
});

test("omite talla en productos que no usan tallas", () => {
  const mensaje = crearMensaje({
    producto: { id: "bolso-mar-serena", nombre: "Bolso Mar Serena", precio: "45.000" },
    variante: { nombre: "Color principal", miniatura: "/productos/bolso.webp" },
    cantidadVariantes: 1,
    talla: "",
  });
  assert.doesNotMatch(mensaje, /^Talla:/m);
  assert.doesNotMatch(mensaje, /^Color:/m);
  assert.match(mensaje, /Precio: \$45\.000/);
});

test("omite un nombre de variante único igual al producto", () => {
  const mensaje = crearMensaje({
    variante: { nombre: producto.nombre, miniatura: "/productos/violeta.webp" },
    cantidadVariantes: 1,
  });
  assert.doesNotMatch(mensaje, /^Color:/m);
});

test("rechaza esquemas y rutas externas en URLs dinámicas", () => {
  assert.equal(
    crearUrlInternaAbsoluta("javascript:alert(1)", ORIGIN, "/productos/"),
    ""
  );
  assert.equal(
    crearUrlInternaAbsoluta("https://malicioso.example/foto.webp", ORIGIN, "/productos/"),
    ""
  );
  assert.equal(
    crearUrlInternaAbsoluta("/productos/foto.webp", "javascript:alert(1)", "/productos/"),
    ""
  );
});

test("la URL de WhatsApp codifica tildes, ñ, espacios y emojis", () => {
  const mensaje = "Traje caña y océano 👋";
  const url = crearUrlWhatsApp(mensaje);
  assert.equal(url, `https://wa.me/573159048807?text=${encodeURIComponent(mensaje)}`);
  assert.equal(decodeURIComponent(new URL(url).searchParams.get("text")), mensaje);
});

test("el botón usa un enlace directo y no crea pestañas provisionales", async () => {
  const fuente = await readFile(
    new URL("../src/components/WhatsAppButton.jsx", import.meta.url),
    "utf8"
  );
  assert.match(fuente, /href=\{crearUrlWhatsApp\(mensaje\)\}/);
  assert.doesNotMatch(fuente, /window\.open|about:blank/);
});
