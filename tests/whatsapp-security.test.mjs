import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  crearMensajeProductoWhatsApp,
  crearUrlWhatsApp,
} from "../src/config/whatsapp.js";

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
    ...sobrescribir,
  });
}

test("incluye únicamente producto, variante seleccionada, talla y precio", () => {
  assert.equal(
    crearMensaje(),
    `Hola 👋 Quiero consultar disponibilidad de:

Producto: Violeta Urbana
Color: Fuccia degradado
Talla: S
Precio: $60.000

¿Está disponible? 🌴`
  );
});

test("cambiar variante cambia el color enviado", () => {
  const mensaje = crearMensaje({ variante: azul });
  assert.match(mensaje, /Color: Azul océano/);
  assert.doesNotMatch(mensaje, /Fuccia degradado/);
  assert.doesNotMatch(mensaje, /Foto:|https?:\/\//);
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

test("no incluye foto ni URL de producto", () => {
  const mensaje = crearMensaje();
  assert.doesNotMatch(mensaje, /^Foto:/m);
  assert.doesNotMatch(mensaje, /^Producto: https?:\/\//m);
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
