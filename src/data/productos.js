const productos = [

  {
    id: "fleur-limon",
    
    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Fleur Limón",
    precio: "60.000",

    tallas: ["M", "L"],
    color: ["amarillo biche"],

    etiquetas: [
      "nuevo",
      "edicion-limitada"
    ],

    descripcion:
      "Bikini de dos piezas en tono Limón Chiffon con delicadas flores bordadas en lentejuelas y pedrería. Su tejido acanalado con brillo sutil aporta un acabado elegante y femenino, ideal para destacar durante los días de verano.",

    imagenes: [
      "/productos/fleur-limon-frontal.webp",
      "/productos/fleur-limon-producto.webp",
      "/productos/fleur-limon-lateral.webp",
      "/productos/fleur-limon-trasera.webp",
      "/productos/fleur-limon-detalle.webp",
    ],
  },


  {
    id: "jardin-capri",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Jardín de Capri",
    precio: "60.000",

    tallas: ["M"],
    color: ["rosa viejo"],

    etiquetas: [
      "nuevo",
      "3-piezas",
      "pareo"
    ],

    descripcion:
      "Conjunto floral romántico con bikini triangular y pareo translúcido a juego. Inspirado en los jardines mediterráneos y las vacaciones de lujo.",

    imagenes: [
      "/productos/jardinDC-frontal.webp",
      "/productos/jardinDC-trasera.webp",
      "/productos/jardinDC-producto.webp",
    ],
  },

  {
    id: "brisa-orquidea",

    activo: true,
    favorito: true,

    categoria: "trajes",

    nombre: "Set Brisa de Orquídea",
    precio: "80.000",

    tallas: ["S", "M", "L"],
    color: ["rosa"],

    etiquetas: [
      "nuevo",
      "3-piezas",
      "pareo",
      "flores-removibles",
      "edicion-limitada"
    ],

    descripcion:
      "Set de 3 piezas con bikini, pareo y orquídeas removibles para un look versátil y sofisticado.",

    imagenes: [
      "/productos/brisa-orquidea-frontal.webp",
      "/productos/brisa-orquidea-lateral.webp",
      "/productos/brisa-orquidea-trasera.webp",
      "/productos/brisa-orquidea-detalle.webp",
      "/productos/brisa-orquidea-producto.webp",
    ],
  },

{
    id: "concha-nacar",

    activo: false,
    favorito: false,

    categoria: "trajes",

    nombre: "Concha de Nácar",
    precio: "60.000",

    tallas: ["L"],
    color: ["tornasol"],

    etiquetas: [
      "nuevo",
      "tornasol"
    ],

    descripcion:
      "Bikini de 2 piezas. Inspirado en el brillo del mar. Un diseño exclusivo con acabado tornasol y detalles en perlas que realzan tu elegancia bajo el sol.",

    imagenes: [
      "/productos/concha-nacar-frontal.webp",
      "/productos/concha-nacar-lateral.webp",
      "/productos/concha-nacar-trasera.webp",
      "/productos/concha-nacar-detalle.webp",
      "/productos/concha-nacar-producto.webp",
    ],
  },

  {
    id: "marina",

    activo: false,
    favorito: false,

    categoria: "trajes",

    nombre: "Brisa Marina",
    precio: "80.000",

    tallas: ["S"],
    color: ["azul" , "cielo" , "rey"],

    etiquetas: [
      "nuevo",
      
    ],

    descripcion:
      "✨ Uno de nuestros favoritos. Set de 3 piezas con bikini de diseño exclusivo y salida de baño en malla translúcida a juego. Una combinación sofisticada, fresca y perfecta para quienes buscan destacar con estilo en cada destino.💙 Incluye: top, panty y salida de baño",

    imagenes: [
      "/productos/marina-frontal.webp",
      "/productos/marina-lateral.webp",
      "/productos/marina-detalle.webp",
      "/productos/marina-producto.webp",
    ],
  },

  {
    id: "luna-negra",

    activo: true,
    favorito: true,

    categoria: "trajes",

    nombre: "Luna Negra",
    precio: "40.000",

    tallas: ["s"],
    color: ["negro"],

    etiquetas: [
      "nuevo",
      "detalles dorados"
    ],

    descripcion:
      "Bikini de 2 piezas Su color negro estiliza la figura, mientras que los herrajes dorados le aportan un toque sofisticado y exclusivo. El top con excelente soporte y la panty de corte favorecedor crean un equilibrio perfecto entre elegancia y comodidad. 🌊 Ideal para playa, piscina o tus vacaciones.✨ Un básico premium que combina con cualquier salida de baño o accesorio. ",

    imagenes: [
      "/productos/luna-negra-frontal.webp",
      "/productos/luna-negra-lateral.webp",
      "/productos/luna-negra-trasera.webp",
      "/productos/luna-negra-detalle.webp",
      
    ],
  },

  {
    id: "concha-rosa",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Concha Rosa",
    precio: "80.000",

    tallas: ["S"],
    color: ["rosado degradado"],

    palabrasClave: [
    "rosado",
    "dorado",
    "difuminado",
    "degradado",
    "desvanecido",
    ],

    etiquetas: [
      "nuevo",
      "detalles dorados"
    ],

      descripcion:
        "Set de 3 piezas con pareo incluido. Un diseño elegante en tonos rosa degradado con detalles dorados que realzan tu estilo en cada destino.",
      imagenes: [

      "/productos/concha-rosa-frontal.webp",
      "/productos/concha-rosa-lateral.webp",
      "/productos/concha-rosa-trasera.webp",
      "/productos/concha-rosa-detalle.webp",
      "/productos/concha-rosa-detalle1.webp",
      
    ],
  },

  {
    id: "arena-dorada",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Arena Dorada",
    precio: "40.000",

    tallas: ["M"],
    color: ["dorado"],

    etiquetas: [
      "nuevo"
    ],

    descripcion:
      "Bikini de acabado metálico con cadenas doradas para un look exclusivo y sofisticado",

    imagenes: [
      "/productos/arena-dorada-frontal.webp",
      "/productos/arena-dorada-trasera.webp",
      "/productos/arena-dorada-lateral.webp",
      "/productos/arena-dorada-detalle.webp",
    ],
  },
  
  {
    id: "oro-del-mar",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Oro Del Mar",
    precio: "60.000",

    tallas: ["M" , "L"],
    color: ["dorado"],

    etiquetas: [
      "nuevo"
    ],

    descripcion:
      "Inspirado en la luz del atardecer, este enterizo combina lujo, comodidad y un brillo sutil para hacerte sentir única.",

    imagenes: [
      "/productos/oro-del-mar-frontal.webp",
      "/productos/oro-del-mar-trasera.webp",
      "/productos/oro-del-mar-detalle.webp",
    ],
  },

  {
    id: "alba",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Alba",
    precio: "40.000",

    tallas: ["M"],
    color: ["blanco"],

    palabrasClave: [
    "lentejuelas",
    ],

    etiquetas: [
      "nuevo" , "lentejuelas"
    ],

    descripcion:
      "Un bikini blanco con delicados detalles plateados que refleja frescura, elegancia y un brillo sutil para destacar en cada verano.",

    imagenes: [
      "/productos/alba-frontal.webp",
      "/productos/alba-trasera.webp",
      "/productos/alba-detalle.webp",
    ],
  },

  {
    id: "flamenco",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Flamenco",
    precio: "40.000",

    tallas: ["L"],
    color: ["rosado"],

    palabrasClave: [
    "alto",
    "estampado",
    "boleros",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Un diseño vibrante con volantes delicados y cintura alta que combina frescura, comodidad y elegancia para brillar bajo el sol.",

    imagenes: [
      "/productos/flamenco-frontal.webp",
      "/productos/flamenco-trasera.webp",
      "/productos/flamenco-detalle.webp",
    ],
  },

  {
    id: "cielo",

    activo: false,
    favorito: false,

    categoria: "trajes",

    nombre: "Cielo",
    precio: "40.000",

    tallas: ["L"],
    color: ["azul"],

    palabrasClave: [
    "flor",
    "enterizo",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Un diseño de líneas elegantes y tono azul cielo que combina frescura, sofisticación y comodidad para brillar en cada día de verano.",

    imagenes: [
      "/productos/cielo-frontal.webp",
      "/productos/cielo-producto.webp",
      "/productos/cielo-detalle.webp",
    ],
  },

  {
    id: "flor-de-fuego",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Flor de Fuego",
    precio: "60.000",

    tallas: ["M" , "L"],
    color: ["negro"],

    palabrasClave: [
    "escote",
    "naranja",
    "lazo",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Enterizo con escote profundo y estampado floral vibrante, diseñado para resaltar tu estilo con elegancia y frescura tropical.",

    imagenes: [
      "/productos/flor-de-fuego-frontal.webp",
      "/productos/flor-de-fuego-producto.webp",
      "/productos/flor-de-fuego-trasera.webp",
      "/productos/flor-de-fuego-detalle.webp",
    ],
  },

  {
    id: "mar-celeste",

    activo: false,
    favorito: false,

    categoria: "trajes",

    nombre: "Mar Celeste",
    precio: "60.000",

    tallas: ["XS" , "S"],
    color: ["azul"],

    palabrasClave: [
    "almeja",
    "concha",
    "perlas"
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Bikini en tono azul celeste con delicados detalles de perlas, inspirado en la calma y belleza del mar.",

    imagenes: [
      "/productos/mar-celeste-frontal.webp",
      "/productos/mar-celeste-trasera.webp",
      "/productos/mar-celeste-producto.webp",
      "/productos/mar-celeste-detalle.webp",
    ],
  },

  {
    id: "mar-de-cristal",

    activo: false,
    favorito: false,

    categoria: "trajes",

    nombre: "Mar de Cristal",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["azul"],

    palabrasClave: [
    "brillos",
    "tornazol",
    "trenzado",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Bikini con acabado brillante y cordones trenzados, inspirado en el brillo del mar cristalino. ",

    imagenes: [
      "/productos/mar-de-cristal-frontal.webp",
      "/productos/mar-de-cristal-trasera.webp",
      "/productos/mar-de-cristal-producto.webp",
      "/productos/mar-de-cristal-detalle.webp",
    ],
  },

  {
    id: "golden-hour",

    activo: true,
    favorito: false,

    categoria: "salidas",

    nombre: "Golden Hour",
    precio: "80.000",

    tallas: ["unica"],
    color: ["dorado"],

    palabrasClave: [
    "salida",
    "malla",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "✨ Salida de playa dorada en malla con lentejuelas. Ligera, sofisticada y perfecta para elevar cualquier look de verano.",

    imagenes: [
      "/productos/golden-hour-frontal.webp",
      "/productos/golden-hour-trasera.webp",
      "/productos/golden-hour-lateral.webp",
      "/productos/golden-hour-detalle.webp",
    ],
  },

  {
    id: "palma-blanca",

    activo: true,
    favorito: false,

    categoria: "bolsos",

    nombre: "Palma Blanca",
    precio: "40.000",

    color: ["blanco"],

    medidas: "27 x 43 cm",

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "🤍 Palma Blanca 🏝️ El bolso perfecto para acompañar tus días de sol. Amplio, elegante y fácil de combinar con cualquier look de playa.",

    imagenes: [
      "/productos/palma-blanca-frontal.webp",
      "/productos/palma-blanca-lateral.webp",
      "/productos/palma-blanca-detalle.webp",
    ],
  },

  {
    id: "gafas-solea",

    activo: true,
    favorito: false,

    categoria: "accesorios",

    nombre: "Gafas Solea",
    precio: "20.000",

    color: ["negras , dorado"],

    medidas: "14 x 28 cm",

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Ligeras, elegantes y versátiles. Las gafas Brisa combinan con cualquier outfit y son el complemento ideal para disfrutar del verano con estilo.",

    imagenes: [
      "/productos/gafas-solea-ambas.webp",
      "/productos/gafas-solea-doradas.webp",
      "/productos/gafas-solea-detalle.webp",
      "/productos/gafas-solea-negras.webp",
    ],
  },

  {
    id: "bahia",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Bahía",
    precio: "40.000",

    tallas: ["L" , "XL"],
    color: "azul" ,

    palabrasClave: [
    "marfil",
    "detalles",
    "dorado",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Femenino, delicado y atemporal. Un bikini diseñado para acompañarte en los mejores días de verano.",

    imagenes: [
      "/productos/bahia-azul-frontal.webp",
      "/productos/bahia-azul-trasera.webp",
      "/productos/bahia-azul-detalle.webp",
    ],
  },

  {
    id: "fuccia-tropical",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Fuccia Tropical",
    precio: "60.000",

    tallas: ["M" , "L"],

    color: "Fucsia",

    palabrasClave: [
    "rosado",
    "malla"
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Color, brillo y actitud en un solo conjunto. Ideal para disfrutar el verano con un estilo fresco y lleno de personalidad.",

    imagenes: [
      "/productos/fuccia-tropical-frontal.webp",
      "/productos/fuccia-tropical-trasera.webp",
      "/productos/fuccia-tropical-detalle.webp",
    ],
  },

   {
    id: "terracota",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Enterizo Terracota 🤎",
    precio: "40.000",

    tallas: ["L"],
    color: ["negro" , "terracota"],

    color: ["Terracota con negro"],

    palabrasClave: [
    "textura",
    "flor",
    "enterizo",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Inspirado en los tonos cálidos del atardecer. Un diseño moderno que combina sofisticación y comodidad en cada detalle.",

    imagenes: [
      "/productos/terracota-frontal.webp",
      "/productos/terracota-trasera.webp",
      "/productos/terracota-lateral.webp",
      "/productos/terracota-detalle.webp",
      
    ],
  },

  {
    id: "selva",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Selva 🌿",
    precio: "40.000",

    tallas: ["L" , "XL"],
    color: ["verde"],

    palabrasClave: [
    "estampado",
    "combinado",
    "tres piezas",
    "3 piezas",
    "salida"
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Con estampados inspirados en la naturaleza, tonos oliva y un pareo a juego, este conjunto ofrece el equilibrio perfecto entre frescura, comodidad y elegancia.",

    imagenes: [
      "/productos/selva-frontal.webp",
      "/productos/selva-top.webp",
      "/productos/selva-pantye.webp",
      "/productos/selva-detalle.webp",
      
    ],
  },

  {
    id: "Amazona",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Set Amazona 🌿",
    precio: "60.000",

    tallas: ["L"],
    color: ["verde con blanco"],

    palabrasClave: [
    "estampado",
    "combinado",
    "rayas",
    "detlles dorados",
    "entero",
    "enterizo",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "nspirado en la fuerza y belleza de la naturaleza. Un diseño exclusivo que combina elegancia y frescura. ",

    imagenes: [
      "/productos/amazona-frontal.webp",
      "/productos/amazona-top.webp",
      "/productos/amazona-pantye.webp",
      "/productos/amazona-trasera.webp",
      
    ],
  },

  {
    id: "jade",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "💚 Set Jade",
    precio: "40.000",

    tallas: ["L" , "XL"],
    color: ["verde"],

    palabrasClave: [
    "lentejuelas",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Un bikini que combina un vibrante tono verde con delicados destellos para crear un look fresco, elegante y lleno de luz.",

    imagenes: [
      "/productos/jade-frontal.webp",
      "/productos/jade-detalle.webp",
      "/productos/jade-trasera.webp",
      "/productos/jade-lateral.webp",
      
    ],
  },

  {
    id: "marfil",

    activo: true,
    favorito: true,

    categoria: "trajes",

    nombre: "🐚 Enterizo Marfil",
    precio: "80.000",

    tallas: ["L" , "XL"],
    color: ["Marfil"],

    palabrasClave: [
    "textura",
    "detalle dorado",
    "entero",
    "enterizo",
    ],

    etiquetas: [
      "nuevo" ,
    ],

    descripcion:
      "Un diseño moderno en tono marfil con acabado texturizado y herraje dorado que realza tu estilo con delicadeza",

    imagenes: [
      "/productos/marfil-frontal.webp",
      "/productos/marfil-detalle.webp",
      "/productos/marfil-trasera.webp",
      
    ],
  },


  {
    id: "serena",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Serena",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["fuccia"],

    palabrasClave: [
    "textura",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Inspirado en el azul cristalino del Caribe. Un conjunto ligero, moderno y lleno de detalles que evocan la tranquilidad y el lujo de los días frente al mar.",

    imagenes: [
      "/productos/serena-frontal.webp",
      "/productos/serena-detalle.webp",
      "/productos/serena-trasera.webp",
      
    ],
  },

  {
    id: "perla-rosa",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Perla Rosa",
    precio: "60.000",

    tallas: ["XS" , "S"],
    color: ["rosado"],

    palabrasClave: [
    "perlado",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Conjunto de tres piezas en un delicado tono rosa perlado. Diseñado para realzar la silueta con un toque femenino y sofisticado.",

    imagenes: [
      "/productos/perla-frontal.webp",
      "/productos/perla-detalle.webp",
      "/productos/perla-trasera.webp",
      
    ],
  },

  {
    id: "cielo-marino",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Cielo Marino",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["azul"],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Un bikini inspirado en el azul del océano y la calma del verano. Un diseño fresco y atemporal que roba miradas.",

    imagenes: [
      "/productos/cielo-frontal.webp",
      "/productos/cielo-detalle.webp",
      "/productos/cielo-trasera.webp",
      "/productos/cielo-producto.webp",
      
    ],
  },

  {
  id: "noche-de-verano",

  nombre: "Noche de Verano",

  precio: "80.000",

  variantes: [

    {
      id: "negro",

      nombre: "Negro",

      codigo: "#111111",

      miniatura:
        "/productos/nochedv-frontal.webp",

      imagenes: [
        "/productos/nochedv-frontal.webp",
        "/productos/nochedv-detalle.webp",
        "/productos/nochedv-producto.webp",
      ],

      tallas:["S","L","XL"]
    }

  ]
},

  {
    id: "marea-turquesa",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Marea Turquesa 💎",
    precio: "80.000",

    tallas: ["M"],
    color: ["azul"],

    palabrasClave: [
    "3 piezas",
    "tres piezas",
    "malla",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Set de 3 piezas inspirado en la intensidad del mar Caribe. Incluye bikini, falda de malla y detalles que realzan la silueta con un estilo elegante, fresco y sofisticado.",

    imagenes: [
      "/productos/marea-frontal.webp",
      "/productos/marea-trasera.webp",
      "/productos/marea-detalle.webp",
      "/productos/marea-producto.webp",
      
    ],
  },

  {
    id: "sol-dorado",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "✨ Sol Dorado",
    precio: "60.000",

    tallas: ["S" , "M"],
    color: ["dorado"],

    palabrasClave: [
    "enterizo",
    "entero",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Enterizo de acabado brillante inspirado en los destellos del sol sobre el mar. Un diseño sofisticado que realza la silueta con un toque de lujo para disfrutar el verano con estilo.",

    imagenes: [
      "/productos/sol-frontal.webp",
      "/productos/sol-trasera.webp",
      "/productos/sol-producto.webp",
      
    ],
  },

  {
    id: "vino-tropical",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🍷Vino Tropical",
    precio: "60.000",

    tallas: ["S" , "M"],
    color: ["vinotinto"],

    palabrasClave: [
    "3 piezas",
    "tres piezas",
    "malla",
    "flor",
    "orquidea",
    ],

    etiquetas: [
      "nuevo",
      "3-piezas",
      "pareo",
      "edicion-limitada"
    ],

    descripcion:
      "Set de 3 piezas en tono vino con delicados detalles florales y falda de malla translúcida. Un diseño romántico que resalta la silueta con un toque de sofisticación tropical.",

    imagenes: [
      "/productos/vino-frontal.webp",
      "/productos/vino-trasera.webp",
      "/productos/vino-detalle.webp",
      "/productos/vino-producto.webp",
      
    ],
  },


  {
    id: "jardin-azul",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🌼 Jardín Azul",
    precio: "40.000",

    tallas: ["S" , "M"],
    color: ["Azul floral"],

    etiquetas: [
      "nuevo",
      "edicion-limitada"
    ],

    descripcion:
      "Un bikini ligero y romántico, perfecto para días de playa y piscina.",

    imagenes: [
      "/productos/jardinA-frontal.webp",
      "/productos/jardinA-trasera.webp",
      
    ],
  },

  {
    id: "palmeras",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🌴 Palmeras",
    precio: "60.000",

    tallas: ["M"],
    color: ["marfil"],

    palabrasClave: [
    "mostazillas",
    ],

    etiquetas: [
      "nuevo",
      "edicion-limitada"
    ],

    descripcion:
      "Bikini de dos piezas en tono blanco con delicadas palmeras bordadas en mostacilla.",

    imagenes: [
      "/productos/palmera-frontal.webp",
      "/productos/palmera-trasera.webp",
      "/productos/palmera-detalle.webp",
      
    ],
  },

  {
    id: "doble-encanto",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🌸 Doble Encanto",
    precio: "40.000",

    tallas: ["M"],
    color: ["amarillo y rojo"],

    palabrasClave: [
    "doble",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini reversible de dos piezas con doble estampado floral y cuadros vichy. Dos looks en un solo diseño para combinar frescura, color y versatilidad",

    imagenes: [
      "/productos/dobleE-frontal.webp",
      "/productos/dobleE-trasera.webp",
      
    ],
  },

  {
    id: "Fiera-dorada",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🐆 Fiera Dorada",
    precio: "60.000",

    tallas: ["M"],
    color: ["café"],

    palabrasClave: [
    "lentejuela",
    "3 piezas",
    "tres piezas",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Set de 3 piezas con bikini de lentejuelas, pareo estampado animal print y detalles dorados. Un diseño sofisticado que combina el espíritu salvaje de la selva con el lujo del verano.",

    imagenes: [
      "/productos/fiera-frontal.webp",
      "/productos/fiera-trasera.webp",
      "/productos/fiera-detalle.webp",
      
    ],
  },

  {
    id: "isla-blanca",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Isla Blanca",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["Estampado azul, fondo blanco"],

    palabrasClave: [
    "hilo",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Un bikini fresco, cómodo y fácil de combinar. Su estampado azul le da un toque especial para disfrutar del verano.",

    imagenes: [
      "/productos/islaB-frontal.webp",
      "/productos/islaB-trasera.webp",
      
    ],
  },

  {
    id: "brisa-de-coco",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🥥 Brisa de Coco",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["Azul"],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini de amarre con contraste en azul marino y celeste. Ligero, cómodo y perfecto para acompañarte en cualquier plan bajo el sol.",

    imagenes: [
      "/productos/brisadC-frontal.webp",
      "/productos/brisadC-trasera.webp",
      
    ],
  },

  {
    id: "nube-de-mar",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Nube de Mar",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["azul cielo"],

    palabrasClave: [
    "hilo",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini strapless en tono azul cielo con detalle de estrella de mar en el top. Un diseño fresco y fácil de combinar para tus días de verano. Incluye tira removible para usarlo también con soporte al cuello.",

    imagenes: [
      "/productos/nubedM-frontal.webp",
      "/productos/nubedM-trasera.webp",
      
    ],
  },

  {
    id: "red-de-mar",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Red de Mar",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["azul rey con beige"],

    palabrasClave: [
    "tejido",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini de tejido artesanal en tonos azul y crema. Un diseño fresco y cómodo, ideal para disfrutar de la playa con un estilo natural.",

    imagenes: [
      "/productos/reddM-frontal.webp",
      "/productos/reddM-trasera.webp",
      "/productos/reddM-detalle.webp",
      
    ],
  },

  {
    id: "tierra-viva",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Tierra Viva 🌾",
    precio: "40.000",

    tallas: ["XS" , "S"],
    color: ["mezcla de colores: verde, tierra y mostaza"],

    palabrasClave: [
    "tejido",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini tejido con detalles artesanales y una combinación de colores inspirada en la naturaleza. Ligero, cómodo y perfecto para disfrutar de la playa o la piscina.",

    imagenes: [
      "/productos/tierraV-frontal.webp",
      "/productos/tierraV-trasera.webp",
      "/productos/tierraV-detalle.webp",
      
    ],
  },

  {
    id: "mango-biche",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "🥭 Mango Biche",
    precio: "40.000",

    tallas: ["L"],
    color: ["verde degradado"],

    palabrasClave: [
    "degradado",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini con degradado en tonos azul y verde limón, detalle de caballito de mar y panty ajustable con recogido posterior. Un diseño fresco, alegre y perfecto para disfrutar los días de sol.",

    imagenes: [
      "/productos/mangoB-frontal.webp",
      "/productos/mangoB-trasera.webp",
      "/productos/mangoB-detalle.webp",
      "/productos/mangoB-bra.webp",
      
    ],
  },

  {
    id: "jardin-costero",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Jardín Costero",
    precio: "40.000",

    tallas: ["M"],
    color: ["verde"],

    palabrasClave: [
    "encaje",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini en tono verde oliva con delicado encaje y detalles de perlas. Un diseño fresco y cómodo para disfrutar de la playa o la piscina con un estilo natural.",

    imagenes: [
      "/productos/jardinC-frontal.webp",
      "/productos/jardinC-trasera.webp",
      "/productos/jardinC-detalle.webp",
      
      
    ],
  },

  {
    id: "agua-de-coco",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Agua de Coco",
    precio: "40.000",

    tallas: ["L"],
    color: ["verde"],

    palabrasClave: [
    "textura",
    "enterizo",
    "entero",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Enterizo de silueta moderna con abertura frontal y detalle de aro dorado. Su diseño estiliza la figura y combina fácilmente con salidas de baño, shorts o una falda para un look de playa completo.",

    imagenes: [
      "/productos/aguadC-frontal.webp",
      "/productos/aguadC-trasera.webp",
      "/productos/aguadC-detalle.webp",
      
      
    ],
  },

  {
    id: "playa-madera",

    activo: true,
    favorito: false,

    categoria: "trajes",

    nombre: "Playa Madera",
    precio: "60.000",

    tallas: ["M"],
    color: ["café"],

    palabrasClave: [
    "salida",
    "tres piezas",
    "3 piezas",
    ],

    etiquetas: [
      "nuevo",
    ],

    descripcion:
      "Bikini de estampado en tonos tierra con detalles de cuentas decorativas y pareo a juego. Un diseño cómodo y versátil para disfrutar de la playa o la piscina con un estilo natural.",

    imagenes: [
      "/productos/playaM-frontal.webp",
      "/productos/playaM-trasera.webp",
      "/productos/playaM-detalle.webp",
      
      
    ],
  },



];

// Future colors for Brisa Orquidea, Luna Negra, Fuccia Tropical and Noche de
// Verano should be added to their respective `variantes` arrays only after
// their real image assets are available.
const crearVariantePredeterminada = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  codigo: "",
  miniatura: producto.imagenes?.[0] ?? "",
  imagenes: producto.imagenes ?? [],
  tallas: producto.tallas ?? [],
});

const productosConVariantes = productos.map((producto) => ({
  ...producto,
  variantes:
    Array.isArray(producto.variantes) && producto.variantes.length > 0
      ? producto.variantes
      : [crearVariantePredeterminada(producto)],
}));

export const obtenerVariantes = (producto) => producto.variantes ?? [];

export const obtenerTallas = (producto) => [
  ...new Set(
    obtenerVariantes(producto).flatMap((variante) => variante.tallas ?? [])
  ),
];

export default productosConVariantes;
