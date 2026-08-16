/* ============================================================
   Euskaltxo — Contenido del curso de euskera (ES → EU)
   Nivel A1 alineado con el HEOC (Currículo Básico de HABE):
   ámbitos temáticos, funciones comunicativas y gramática del
   nivel "usuario inicial" (A1 MCER).
   Cada unidad tiene words {eu, es}, phrases {eu, es} y grammar.
   Los ejercicios se generan automáticamente a partir de aquí.
   ============================================================ */

const LEVELS = [
  {
    id: "A1",
    title: "Nivel A1 — Usuario básico",
    desc: "Currículo HEOC/HABE: comprender y usar expresiones sencillas de la vida cotidiana, presentarte, dar información personal y desenvolverte en situaciones inmediatas.",
    locked: false,
  },
  {
    id: "A2",
    title: "Nivel A2 — Usuario básico avanzado",
    desc: "Pasado y futuro, planes, comparaciones, experiencias. Se desbloqueará próximamente.",
    locked: true,
  },
  {
    id: "B1",
    title: "Nivel B1 — Usuario independiente",
    desc: "Opiniones, narraciones, textos más largos. Se desbloqueará próximamente.",
    locked: true,
  },
];

const COURSE = [
  {
    id: "agurrak",
    title: "Agurrak · Saludos",
    subtitle: "Fórmulas de saludo y cortesía",
    icon: "👋",
    color: "#58cc02",
    grammar: [
      {
        title: "Saludos según el momento del día",
        body: "En euskera el saludo cambia con el momento del día. «Kaixo» vale siempre; «egun on» por la mañana, «arratsalde on» por la tarde y «gabon» por la noche.",
        examples: [
          { eu: "Egun on!", es: "¡Buenos días!" },
          { eu: "Gabon, gero arte!", es: "¡Buenas noches, hasta luego!" },
        ],
      },
      {
        title: "Cortesía básica",
        body: "«Eskerrik asko» (gracias) se responde con «ez horregatik» (de nada). Para disculparse: «barkatu».",
        examples: [
          { eu: "— Eskerrik asko! — Ez horregatik.", es: "— ¡Gracias! — De nada." },
        ],
      },
    ],
    words: [
      { eu: "kaixo", es: "hola" },
      { eu: "agur", es: "adiós" },
      { eu: "egun on", es: "buenos días" },
      { eu: "arratsalde on", es: "buenas tardes" },
      { eu: "gabon", es: "buenas noches" },
      { eu: "gero arte", es: "hasta luego" },
      { eu: "bihar arte", es: "hasta mañana" },
      { eu: "ongi etorri", es: "bienvenido" },
      { eu: "mesedez", es: "por favor" },
      { eu: "eskerrik asko", es: "gracias" },
      { eu: "ez horregatik", es: "de nada" },
      { eu: "barkatu", es: "perdón" },
    ],
    phrases: [
      { eu: "Kaixo zer moduz", es: "Hola qué tal" },
      { eu: "Ondo eskerrik asko", es: "Bien gracias" },
      { eu: "Egun on eta ongi etorri", es: "Buenos días y bienvenido" },
      { eu: "Gero arte laguna", es: "Hasta luego amigo" },
      { eu: "Barkatu ez dut ulertzen", es: "Perdón no entiendo" },
      { eu: "Ongi etorri gure etxera", es: "Bienvenido a nuestra casa" },
    ],
  },
  {
    id: "aurkezpenak",
    title: "Aurkezpenak · Presentarse",
    subtitle: "Quién eres y de dónde eres",
    icon: "🙋",
    color: "#1cb0f6",
    grammar: [
      {
        title: "El verbo izan (ser) en presente",
        body: "ni naiz (yo soy), zu zara (tú eres), bera da (él/ella es), gu gara (nosotros somos), zuek zarete (vosotros sois), haiek dira (ellos son).",
        examples: [
          { eu: "Ni Ane naiz.", es: "Yo soy Ane." },
          { eu: "Gu ikasleak gara.", es: "Nosotros somos estudiantes." },
        ],
      },
      {
        title: "Origen con -koa",
        body: "Para decir de dónde eres se añade -koa al lugar: Bilbokoa (de Bilbao), Donostiakoa (de San Sebastián).",
        examples: [
          { eu: "Nongoa zara? Ni Bilbokoa naiz.", es: "¿De dónde eres? Yo soy de Bilbao." },
        ],
      },
    ],
    words: [
      { eu: "ni", es: "yo" },
      { eu: "zu", es: "tú" },
      { eu: "bera", es: "él", alt: ["ella"] },
      { eu: "gu", es: "nosotros" },
      { eu: "zuek", es: "vosotros" },
      { eu: "haiek", es: "ellos" },
      { eu: "izena", es: "nombre" },
      { eu: "abizena", es: "apellido" },
      { eu: "euskalduna", es: "vasco" },
      { eu: "ikaslea", es: "estudiante" },
      { eu: "irakaslea", es: "profesor" },
      { eu: "laguna", es: "amigo" },
    ],
    phrases: [
      { eu: "Ni Ane naiz", es: "Yo soy Ane" },
      { eu: "Nola duzu izena", es: "Cómo te llamas" },
      { eu: "Nire izena Jon da", es: "Mi nombre es Jon" },
      { eu: "Nongoa zara zu", es: "De dónde eres tú" },
      { eu: "Ni Donostiakoa naiz", es: "Yo soy de San Sebastián" },
      { eu: "Bera nire laguna da", es: "Él es mi amigo" },
    ],
  },
  {
    id: "zenbakiak",
    title: "Zenbakiak · Números",
    subtitle: "Del 0 al 100 y la edad",
    icon: "🔢",
    color: "#ff9600",
    grammar: [
      {
        title: "Sistema vigesimal",
        body: "El euskera cuenta de veinte en veinte: hogei (20), hogeita hamar (30 = 20+10), berrogei (40 = 2×20), berrogeita hamar (50), hirurogei (60 = 3×20).",
        examples: [
          { eu: "hogeita bost", es: "veinticinco (20 y 5)" },
        ],
      },
      {
        title: "La edad con ukan (tener)",
        body: "Urte ditut = tengo años. Zenbat urte dituzu? (¿cuántos años tienes?) — Hogei urte ditut (tengo veinte años).",
        examples: [
          { eu: "Hamar urte ditu.", es: "Tiene diez años." },
        ],
      },
    ],
    words: [
      { eu: "zero", es: "cero" },
      { eu: "bat", es: "uno" },
      { eu: "bi", es: "dos" },
      { eu: "hiru", es: "tres" },
      { eu: "lau", es: "cuatro" },
      { eu: "bost", es: "cinco" },
      { eu: "sei", es: "seis" },
      { eu: "zazpi", es: "siete" },
      { eu: "zortzi", es: "ocho" },
      { eu: "bederatzi", es: "nueve" },
      { eu: "hamar", es: "diez" },
      { eu: "hamaika", es: "once" },
      { eu: "hogei", es: "veinte" },
      { eu: "berrogei", es: "cuarenta" },
      { eu: "ehun", es: "cien" },
    ],
    phrases: [
      { eu: "Zenbat urte dituzu", es: "Cuántos años tienes" },
      { eu: "Hogei urte ditut", es: "Tengo veinte años" },
      { eu: "Bi eta hiru bost dira", es: "Dos y tres son cinco" },
      { eu: "Hamar euro dira", es: "Son diez euros" },
      { eu: "Ehun urte ditu amonak", es: "La abuela tiene cien años" },
    ],
  },
  {
    id: "familia",
    title: "Familia",
    subtitle: "Ama, aita y compañía",
    icon: "👨‍👩‍👧‍👦",
    color: "#ff4b4b",
    grammar: [
      {
        title: "Posesivos",
        body: "nire (mi), zure (tu), bere (su), gure (nuestro), zuen (vuestro), haien (su, de ellos). Van delante del nombre.",
        examples: [
          { eu: "Nire ama eta zure aita.", es: "Mi madre y tu padre." },
        ],
      },
      {
        title: "Vivir en: bizi izan + -n",
        body: "Bilbon bizi naiz = vivo en Bilbao. El lugar lleva el sufijo -n (inesivo).",
        examples: [
          { eu: "Gasteizen bizi gara.", es: "Vivimos en Vitoria." },
        ],
      },
    ],
    words: [
      { eu: "ama", es: "madre" },
      { eu: "aita", es: "padre" },
      { eu: "gurasoak", es: "padres" },
      { eu: "semea", es: "hijo" },
      { eu: "alaba", es: "hija" },
      { eu: "anaia", es: "hermano" },
      { eu: "ahizpa", es: "hermana (de una chica)" },
      { eu: "arreba", es: "hermana (de un chico)" },
      { eu: "amona", es: "abuela" },
      { eu: "aitona", es: "abuelo" },
      { eu: "osaba", es: "tío" },
      { eu: "izeba", es: "tía" },
    ],
    phrases: [
      { eu: "Nire ama irakaslea da", es: "Mi madre es profesora" },
      { eu: "Bi anaia ditut", es: "Tengo dos hermanos" },
      { eu: "Aitona eta amona Bilbon bizi dira", es: "El abuelo y la abuela viven en Bilbao" },
      { eu: "Nire familia handia da", es: "Mi familia es grande" },
      { eu: "Osaba eta izeba etorri dira", es: "El tío y la tía han venido" },
    ],
  },
  {
    id: "deskribapenak",
    title: "Deskribapenak · Describir",
    subtitle: "Cómo son las cosas y las personas",
    icon: "🪞",
    color: "#ce82ff",
    grammar: [
      {
        title: "El adjetivo va detrás",
        body: "En euskera el adjetivo se coloca después del nombre y lleva el artículo -a: etxe handia (la casa grande), mutil altua (el chico alto).",
        examples: [
          { eu: "txakur txikia", es: "el perro pequeño" },
        ],
      },
      {
        title: "Demostrativos",
        body: "hau (este), hori (ese), hura (aquel). Van detrás del nombre: etxe hau (esta casa), mutil hori (ese chico).",
        examples: [
          { eu: "Liburu hau berria da.", es: "Este libro es nuevo." },
        ],
      },
    ],
    words: [
      { eu: "handia", es: "grande" },
      { eu: "txikia", es: "pequeño" },
      { eu: "polita", es: "bonito" },
      { eu: "itsusia", es: "feo" },
      { eu: "altua", es: "alto" },
      { eu: "baxua", es: "bajo" },
      { eu: "gaztea", es: "joven" },
      { eu: "zaharra", es: "viejo" },
      { eu: "berria", es: "nuevo" },
      { eu: "ona", es: "bueno" },
      { eu: "txarra", es: "malo" },
      { eu: "alaia", es: "alegre" },
    ],
    phrases: [
      { eu: "Nire laguna oso altua da", es: "Mi amigo es muy alto" },
      { eu: "Etxe hau berria da", es: "Esta casa es nueva" },
      { eu: "Mutil hori alaia da", es: "Ese chico es alegre" },
      { eu: "Neska gaztea da", es: "La chica es joven" },
      { eu: "Txakurra handia eta ona da", es: "El perro es grande y bueno" },
    ],
  },
  {
    id: "koloreak",
    title: "Koloreak · Colores",
    subtitle: "El mundo en colores",
    icon: "🎨",
    color: "#f7c948",
    grammar: [
      {
        title: "Singular y plural",
        body: "El artículo singular es -a y el plural -ak: gorria (el rojo) → gorriak (los rojos). El verbo también cambia: da → dira.",
        examples: [
          { eu: "Lorea polita da. Loreak politak dira.", es: "La flor es bonita. Las flores son bonitas." },
        ],
      },
    ],
    words: [
      { eu: "gorria", es: "rojo" },
      { eu: "urdina", es: "azul" },
      { eu: "berdea", es: "verde" },
      { eu: "horia", es: "amarillo" },
      { eu: "beltza", es: "negro" },
      { eu: "zuria", es: "blanco" },
      { eu: "laranja", es: "naranja" },
      { eu: "morea", es: "morado" },
      { eu: "arrosa", es: "rosa" },
      { eu: "grisa", es: "gris" },
      { eu: "marroia", es: "marrón" },
      { eu: "iluna", es: "oscuro" },
    ],
    phrases: [
      { eu: "Zerua urdina da", es: "El cielo es azul" },
      { eu: "Ikurrina gorria zuria eta berdea da", es: "La ikurriña es roja blanca y verde" },
      { eu: "Nire autoa beltza da", es: "Mi coche es negro" },
      { eu: "Lore horiak politak dira", es: "Las flores amarillas son bonitas" },
    ],
  },
  {
    id: "etxea",
    title: "Etxea · La casa",
    subtitle: "Habitaciones y objetos",
    icon: "🏠",
    color: "#2ec748",
    grammar: [
      {
        title: "El verbo egon (estar)",
        body: "ni nago, zu zaude, bera dago, gu gaude, zuek zaudete, haiek daude. Se usa para lugares y estados.",
        examples: [
          { eu: "Sukaldean nago.", es: "Estoy en la cocina." },
        ],
      },
      {
        title: "Dónde: el sufijo -n / -an",
        body: "El caso inesivo indica lugar: sukaldean (en la cocina), mahaian (en la mesa), Bilbon (en Bilbao).",
        examples: [
          { eu: "Giltza atean dago.", es: "La llave está en la puerta." },
        ],
      },
    ],
    words: [
      { eu: "etxea", es: "casa" },
      { eu: "sukaldea", es: "cocina" },
      { eu: "logela", es: "dormitorio" },
      { eu: "komuna", es: "baño" },
      { eu: "egongela", es: "salón" },
      { eu: "atea", es: "puerta" },
      { eu: "leihoa", es: "ventana" },
      { eu: "mahaia", es: "mesa" },
      { eu: "aulkia", es: "silla" },
      { eu: "ohea", es: "cama" },
      { eu: "giltza", es: "llave" },
      { eu: "lorategia", es: "jardín" },
    ],
    phrases: [
      { eu: "Non dago komuna", es: "Dónde está el baño" },
      { eu: "Sukaldean nago", es: "Estoy en la cocina" },
      { eu: "Mahaia egongelan dago", es: "La mesa está en el salón" },
      { eu: "Nire etxeak lau logela ditu", es: "Mi casa tiene cuatro dormitorios" },
      { eu: "Giltza atean dago", es: "La llave está en la puerta" },
    ],
  },
  {
    id: "egunerokoa",
    title: "Eguneroko bizitza · Rutinas",
    subtitle: "Qué haces cada día",
    icon: "⏰",
    color: "#00b8a9",
    grammar: [
      {
        title: "Presente habitual: -t(z)en + dut/naiz",
        body: "Las acciones habituales se forman con la raíz + -t(z)en y el auxiliar: gosaldu → gosaltzen dut (desayuno), jaiki → jaikitzen naiz (me levanto).",
        examples: [
          { eu: "Egunero euskara ikasten dut.", es: "Todos los días aprendo euskera." },
        ],
      },
      {
        title: "Momentos del día",
        body: "goizean (por la mañana), arratsaldean (por la tarde), gauean (por la noche), egunero (todos los días).",
        examples: [
          { eu: "Goizean kafea hartzen dut.", es: "Por la mañana tomo café." },
        ],
      },
    ],
    words: [
      { eu: "esnatu", es: "despertarse" },
      { eu: "jaiki", es: "levantarse" },
      { eu: "gosaldu", es: "desayunar" },
      { eu: "bazkaldu", es: "comer al mediodía", alt: ["comer"] },
      { eu: "afaldu", es: "cenar" },
      { eu: "lan egin", es: "trabajar" },
      { eu: "ikasi", es: "aprender", alt: ["estudiar"] },
      { eu: "lo egin", es: "dormir" },
      { eu: "dutxatu", es: "ducharse" },
      { eu: "irakurri", es: "leer" },
      { eu: "idatzi", es: "escribir" },
      { eu: "hitz egin", es: "hablar" },
    ],
    phrases: [
      { eu: "Goizean gosaltzen dut", es: "Por la mañana desayuno" },
      { eu: "Zortzietan jaikitzen naiz", es: "Me levanto a las ocho" },
      { eu: "Gauean liburu bat irakurtzen dut", es: "Por la noche leo un libro" },
      { eu: "Egunero euskara ikasten dut", es: "Todos los días aprendo euskera" },
      { eu: "Ondo lo egiten dut", es: "Duermo bien" },
    ],
  },
  {
    id: "ordua",
    title: "Ordua eta astea · La hora",
    subtitle: "Días de la semana y la hora",
    icon: "📅",
    color: "#8549ba",
    grammar: [
      {
        title: "¿Qué hora es?",
        body: "Zer ordu da? — Ordu bata da (es la una), hirurak dira (son las tres), hiru eta erdiak (las tres y media). De la una en adelante se usa el plural dira.",
        examples: [
          { eu: "Bostak dira.", es: "Son las cinco." },
        ],
      },
      {
        title: "Los días no llevan mayúscula",
        body: "astelehena, asteartea… se escriben en minúscula. «El fin de semana» es asteburua.",
        examples: [
          { eu: "Gaur ostirala da.", es: "Hoy es viernes." },
        ],
      },
    ],
    words: [
      { eu: "astelehena", es: "lunes" },
      { eu: "asteartea", es: "martes" },
      { eu: "asteazkena", es: "miércoles" },
      { eu: "osteguna", es: "jueves" },
      { eu: "ostirala", es: "viernes" },
      { eu: "larunbata", es: "sábado" },
      { eu: "igandea", es: "domingo" },
      { eu: "gaur", es: "hoy" },
      { eu: "bihar", es: "mañana" },
      { eu: "atzo", es: "ayer" },
      { eu: "asteburua", es: "fin de semana" },
      { eu: "ordua", es: "hora" },
    ],
    phrases: [
      { eu: "Gaur astelehena da", es: "Hoy es lunes" },
      { eu: "Zer ordu da", es: "Qué hora es" },
      { eu: "Ordu bata da", es: "Es la una" },
      { eu: "Hirurak dira", es: "Son las tres" },
      { eu: "Asteburuan hondartzara noa", es: "El fin de semana voy a la playa" },
    ],
  },
  {
    id: "janaria",
    title: "Janaria · Comida",
    subtitle: "Comer, beber y pedir en el bar",
    icon: "🍎",
    color: "#e53838",
    grammar: [
      {
        title: "Querer algo: nahi dut",
        body: "Nahi dut = quiero. El objeto va delante: kafe bat nahi dut (quiero un café), pintxo bat nahi dut (quiero un pintxo).",
        examples: [
          { eu: "Ura nahi dut mesedez.", es: "Quiero agua por favor." },
        ],
      },
      {
        title: "Comer y beber en presente",
        body: "jan → jaten dut (como), edan → edaten dut (bebo). Con varios objetos: ditut (jaten ditut).",
        examples: [
          { eu: "Ogia jaten dut eta ura edaten dut.", es: "Como pan y bebo agua." },
        ],
      },
    ],
    words: [
      { eu: "ogia", es: "pan" },
      { eu: "ura", es: "agua" },
      { eu: "esnea", es: "leche" },
      { eu: "ardoa", es: "vino" },
      { eu: "garagardoa", es: "cerveza" },
      { eu: "kafea", es: "café" },
      { eu: "sagarra", es: "manzana" },
      { eu: "gazta", es: "queso" },
      { eu: "arraina", es: "pescado" },
      { eu: "haragia", es: "carne" },
      { eu: "arrautza", es: "huevo" },
      { eu: "barazkia", es: "verdura" },
    ],
    phrases: [
      { eu: "Kafesne bat nahi dut mesedez", es: "Quiero un café con leche por favor" },
      { eu: "Ogia eta gazta jaten ditut", es: "Como pan y queso" },
      { eu: "Ura edaten dut", es: "Bebo agua" },
      { eu: "Pintxo bat nahi dut", es: "Quiero un pintxo" },
      { eu: "Zer nahi duzu jateko", es: "Qué quieres para comer" },
    ],
  },
  {
    id: "erosketak",
    title: "Erosketak · Compras",
    subtitle: "Tiendas, precios y ropa",
    icon: "🛍️",
    color: "#ff86d0",
    grammar: [
      {
        title: "Preguntar el precio",
        body: "Zenbat balio du? = ¿cuánto cuesta? Respuesta: hamar euro balio du (cuesta diez euros).",
        examples: [
          { eu: "Zenbat balio du alkandorak?", es: "¿Cuánto cuesta la camisa?" },
        ],
      },
      {
        title: "Ir a un sitio: el sufijo -ra",
        body: "El caso adlativo indica destino: dendara noa (voy a la tienda), merkatura (al mercado), etxera (a casa).",
        examples: [
          { eu: "Merkatura noa.", es: "Voy al mercado." },
        ],
      },
    ],
    words: [
      { eu: "denda", es: "tienda" },
      { eu: "merkatua", es: "mercado" },
      { eu: "dirua", es: "dinero" },
      { eu: "euroa", es: "euro" },
      { eu: "garestia", es: "caro" },
      { eu: "merkea", es: "barato" },
      { eu: "arropa", es: "ropa" },
      { eu: "alkandora", es: "camisa" },
      { eu: "prakak", es: "pantalones" },
      { eu: "oinetakoak", es: "zapatos" },
      { eu: "poltsa", es: "bolso" },
      { eu: "saltzailea", es: "vendedor" },
    ],
    phrases: [
      { eu: "Zenbat balio du", es: "Cuánto cuesta" },
      { eu: "Hamar euro balio du", es: "Cuesta diez euros" },
      { eu: "Oso garestia da", es: "Es muy caro" },
      { eu: "Alkandora urdin bat nahi dut", es: "Quiero una camisa azul" },
      { eu: "Merkatura noa", es: "Voy al mercado" },
    ],
  },
  {
    id: "herria",
    title: "Herria · La ciudad",
    subtitle: "Lugares y direcciones",
    icon: "🏙️",
    color: "#1cb0f6",
    grammar: [
      {
        title: "¿Dónde está…?",
        body: "Non dago…? = ¿dónde está…? Respuestas con hemen (aquí), hor (ahí), han (allí), gertu (cerca), urrun (lejos).",
        examples: [
          { eu: "Geltokia gertu dago.", es: "La estación está cerca." },
        ],
      },
      {
        title: "Izquierda y derecha",
        body: "ezkerra (izquierda), eskuina (derecha). Para indicar dirección: ezkerrera (a la izquierda), eskuinera (a la derecha).",
        examples: [
          { eu: "Eskuinera eta gero ezkerrera.", es: "A la derecha y luego a la izquierda." },
        ],
      },
    ],
    words: [
      { eu: "kalea", es: "calle" },
      { eu: "plaza", es: "plaza" },
      { eu: "jatetxea", es: "restaurante" },
      { eu: "taberna", es: "bar" },
      { eu: "eskola", es: "escuela" },
      { eu: "ospitalea", es: "hospital" },
      { eu: "geltokia", es: "estación" },
      { eu: "parkea", es: "parque" },
      { eu: "hondartza", es: "playa" },
      { eu: "mendia", es: "monte" },
      { eu: "eskuina", es: "derecha" },
      { eu: "ezkerra", es: "izquierda" },
    ],
    phrases: [
      { eu: "Non dago geltokia", es: "Dónde está la estación" },
      { eu: "Eskuinera eta gero ezkerrera", es: "A la derecha y luego a la izquierda" },
      { eu: "Plaza herriko erdian dago", es: "La plaza está en el centro del pueblo" },
      { eu: "Jatetxe on bat dago hemen", es: "Hay un buen restaurante aquí" },
      { eu: "Hondartza gertu dago", es: "La playa está cerca" },
    ],
  },
  {
    id: "garraioa",
    title: "Garraioa · Transporte",
    subtitle: "Moverse y viajar",
    icon: "🚌",
    color: "#ff9600",
    grammar: [
      {
        title: "En qué medio: el sufijo -z",
        body: "El caso instrumental indica el medio: autobusez (en autobús), trenez (en tren), oinez (a pie).",
        examples: [
          { eu: "Autobusez noa lanera.", es: "Voy al trabajo en autobús." },
        ],
      },
      {
        title: "El verbo joan (ir) sintético",
        body: "ni noa (voy), zu zoaz (vas), bera doa (va), gu goaz (vamos). No necesita auxiliar.",
        examples: [
          { eu: "Etxera noa.", es: "Voy a casa." },
        ],
      },
    ],
    words: [
      { eu: "autobusa", es: "autobús" },
      { eu: "trena", es: "tren" },
      { eu: "autoa", es: "coche" },
      { eu: "bizikleta", es: "bicicleta" },
      { eu: "oinez", es: "a pie" },
      { eu: "hegazkina", es: "avión" },
      { eu: "itsasontzia", es: "barco" },
      { eu: "txartela", es: "billete" },
      { eu: "bidaia", es: "viaje" },
      { eu: "aireportua", es: "aeropuerto" },
      { eu: "metroa", es: "metro" },
      { eu: "taxia", es: "taxi" },
    ],
    phrases: [
      { eu: "Autobusez noa lanera", es: "Voy al trabajo en autobús" },
      { eu: "Trena zortzietan ateratzen da", es: "El tren sale a las ocho" },
      { eu: "Oinez noa eskolara", es: "Voy a pie a la escuela" },
      { eu: "Txartel bat mesedez", es: "Un billete por favor" },
      { eu: "Bidaia luzea da", es: "El viaje es largo" },
    ],
  },
  {
    id: "eguraldia",
    title: "Eguraldia · El tiempo",
    subtitle: "Lluvia, sol y estaciones",
    icon: "🌦️",
    color: "#00a5c4",
    grammar: [
      {
        title: "Está lloviendo: ari du",
        body: "Los fenómenos meteorológicos usan «ari du»: euria ari du (está lloviendo), elurra ari du (está nevando).",
        examples: [
          { eu: "Bilbon euria ari du.", es: "En Bilbao está lloviendo." },
        ],
      },
      {
        title: "Hace frío / calor",
        body: "Hotza egiten du (hace frío), beroa egiten du (hace calor). Con intensidad: hotz handia egiten du.",
        examples: [
          { eu: "Neguan hotz handia egiten du.", es: "En invierno hace mucho frío." },
        ],
      },
    ],
    words: [
      { eu: "eguraldia", es: "tiempo (clima)" },
      { eu: "euria", es: "lluvia" },
      { eu: "eguzkia", es: "sol" },
      { eu: "haizea", es: "viento" },
      { eu: "elurra", es: "nieve" },
      { eu: "hodeia", es: "nube" },
      { eu: "hotza", es: "frío" },
      { eu: "beroa", es: "calor" },
      { eu: "uda", es: "verano" },
      { eu: "negua", es: "invierno" },
      { eu: "udaberria", es: "primavera" },
      { eu: "udazkena", es: "otoño" },
    ],
    phrases: [
      { eu: "Euria ari du", es: "Está lloviendo" },
      { eu: "Gaur eguzkia dago", es: "Hoy hace sol" },
      { eu: "Hotz handia egiten du neguan", es: "Hace mucho frío en invierno" },
      { eu: "Bihar elurra egingo du", es: "Mañana nevará" },
      { eu: "Haizea dabil", es: "Hace viento" },
    ],
  },
  {
    id: "aisialdia",
    title: "Aisialdia · Ocio",
    subtitle: "Gustos, deporte y tiempo libre",
    icon: "⚽",
    color: "#58cc02",
    grammar: [
      {
        title: "Me gusta: gustatzen zait",
        body: "Gustatzen zait = me gusta (una cosa); gustatzen zaizkit = me gustan (varias). Lo que gusta va delante.",
        examples: [
          { eu: "Musika gustatzen zait.", es: "Me gusta la música." },
          { eu: "Liburuak gustatzen zaizkit.", es: "Me gustan los libros." },
        ],
      },
      {
        title: "Jugar a un deporte: jokatu",
        body: "Futbolean jokatzen dut (juego al fútbol), pilotan jokatzen dut (juego a pelota). El deporte lleva -n.",
        examples: [
          { eu: "Larunbatetan futbolean jokatzen dut.", es: "Los sábados juego al fútbol." },
        ],
      },
    ],
    words: [
      { eu: "kirola", es: "deporte" },
      { eu: "futbola", es: "fútbol" },
      { eu: "pilota", es: "pelota vasca" },
      { eu: "musika", es: "música" },
      { eu: "dantza", es: "baile" },
      { eu: "liburua", es: "libro" },
      { eu: "zinema", es: "cine" },
      { eu: "jokoa", es: "juego" },
      { eu: "igeri egin", es: "nadar" },
      { eu: "abestu", es: "cantar" },
      { eu: "jolastu", es: "jugar" },
      { eu: "gustatu", es: "gustar" },
    ],
    phrases: [
      { eu: "Musika entzutea gustatzen zait", es: "Me gusta escuchar música" },
      { eu: "Futbolean jokatzen dut", es: "Juego al fútbol" },
      { eu: "Zinemara joaten gara larunbatetan", es: "Vamos al cine los sábados" },
      { eu: "Euskal pilota gustatzen zait", es: "Me gusta la pelota vasca" },
      { eu: "Mendira joatea gustatzen zait", es: "Me gusta ir al monte" },
    ],
  },
  {
    id: "lana",
    title: "Lana · El trabajo",
    subtitle: "Profesiones y estudios",
    icon: "💼",
    color: "#8549ba",
    grammar: [
      {
        title: "¿En qué trabajas?",
        body: "Zertan egiten duzu lan? = ¿en qué trabajas? Respuesta con la profesión + izan: medikua naiz (soy médico).",
        examples: [
          { eu: "Erizaina naiz eta ospitalean lan egiten dut.", es: "Soy enfermera y trabajo en el hospital." },
        ],
      },
      {
        title: "Trabajar y estudiar",
        body: "lan egin → lan egiten dut (trabajo); ikasi → ikasten dut (estudio). El lugar lleva -n o -an: bulegoan (en la oficina).",
        examples: [
          { eu: "Unibertsitatean ikasten dut.", es: "Estudio en la universidad." },
        ],
      },
    ],
    words: [
      { eu: "lana", es: "trabajo" },
      { eu: "lanbidea", es: "profesión" },
      { eu: "medikua", es: "médico" },
      { eu: "erizaina", es: "enfermera" },
      { eu: "sukaldaria", es: "cocinero" },
      { eu: "langilea", es: "trabajador" },
      { eu: "bulegoa", es: "oficina" },
      { eu: "enpresa", es: "empresa" },
      { eu: "ordenagailua", es: "ordenador" },
      { eu: "telefonoa", es: "teléfono" },
      { eu: "ikasketak", es: "estudios" },
      { eu: "unibertsitatea", es: "universidad" },
    ],
    phrases: [
      { eu: "Zertan egiten duzu lan", es: "En qué trabajas" },
      { eu: "Medikua naiz", es: "Soy médico" },
      { eu: "Bulegoan lan egiten dut", es: "Trabajo en la oficina" },
      { eu: "Nire ahizpa erizaina da", es: "Mi hermana es enfermera" },
      { eu: "Unibertsitatean ikasten dut", es: "Estudio en la universidad" },
    ],
  },
];

// Examen final del nivel A1 (simulacro tipo prueba oficial):
// 20 preguntas de todas las unidades, máximo 3 fallos para aprobar.
const EXAM_A1 = {
  id: "azterketa-a1",
  title: "Azterketa A1",
  subtitle: "Examen final del nivel",
  size: 20,
  maxErrors: 3,
  xp: 50,
  gems: 50,
};

/* ------------------------------------------------------------
   Ejercicios de gramática por unidad (completar el hueco).
   Practican exactamente las estructuras del A1: izan, egon,
   ukan, casos, demostrativos, presente habitual, gustatzen…
   ------------------------------------------------------------ */
const DRILLS = {
  agurrak: [
    { q: "— Eskerrik asko! — ___", hint: "de nada", options: ["Ez horregatik", "Gero arte", "Egun on", "Bai"], answer: "Ez horregatik" },
    { q: "Goizean ___ esaten dugu", hint: "saludo de la mañana", options: ["egun on", "gabon", "agur", "gero arte"], answer: "egun on" },
    { q: "Gauean ___ esaten dugu", hint: "saludo de la noche", options: ["gabon", "egun on", "kaixo", "mesedez"], answer: "gabon" },
    { q: "___ ez dut ulertzen", hint: "disculpa", options: ["Barkatu", "Agur", "Bai", "Gabon"], answer: "Barkatu" },
  ],
  aurkezpenak: [
    { q: "Ni Ane ___", hint: "izan: yo", options: ["naiz", "zara", "da", "gara"], answer: "naiz" },
    { q: "Zu Jon ___", hint: "izan: tú", options: ["zara", "naiz", "da", "dira"], answer: "zara" },
    { q: "Bera irakaslea ___", hint: "izan: él/ella", options: ["da", "naiz", "zara", "gara"], answer: "da" },
    { q: "Gu ikasleak ___", hint: "izan: nosotros", options: ["gara", "naiz", "da", "zarete"], answer: "gara" },
    { q: "Haiek euskaldunak ___", hint: "izan: ellos", options: ["dira", "da", "gara", "zara"], answer: "dira" },
  ],
  zenbakiak: [
    { q: "Hogei urte ___", hint: "tener: yo", options: ["ditut", "dut", "dira", "da"], answer: "ditut" },
    { q: "Zenbat urte ___?", hint: "tener: tú", options: ["dituzu", "ditut", "duzu", "dira"], answer: "dituzu" },
    { q: "Bost eta bost ___ dira", hint: "5 + 5", options: ["hamar", "bost", "hogei", "lau"], answer: "hamar" },
    { q: "30 euskaraz ___ da", hint: "20 + 10", options: ["hogeita hamar", "hogei", "berrogei", "hamar"], answer: "hogeita hamar" },
  ],
  familia: [
    { q: "___ ama Miren da", hint: "posesivo: mi", options: ["Nire", "Zure", "Bere", "Gure"], answer: "Nire" },
    { q: "___ aita medikua da", hint: "posesivo: tu", options: ["Zure", "Nire", "Haien", "Bere"], answer: "Zure" },
    { q: "Gu Bilbon bizi ___", hint: "izan: nosotros", options: ["gara", "naiz", "dira", "zara"], answer: "gara" },
    { q: "Aitona etxean bizi ___", hint: "izan: él", options: ["da", "naiz", "gara", "zarete"], answer: "da" },
  ],
  deskribapenak: [
    { q: "Liburu ___ berria da", hint: "demostrativo: este", options: ["hau", "hori", "hura", "haiek"], answer: "hau" },
    { q: "Mutil ___ altua da", hint: "demostrativo: ese", options: ["hori", "hau", "hura", "horiek"], answer: "hori" },
    { q: "Neska ___ gaztea da", hint: "demostrativo: aquella", options: ["hura", "hau", "hori", "hauek"], answer: "hura" },
    { q: "Etxe ___ polita da", hint: "grande + artículo", options: ["handia", "handi", "handiak", "txiki"], answer: "handia" },
  ],
  koloreak: [
    { q: "Loreak ___ dira", hint: "bonitas (plural)", options: ["politak", "polita", "polit", "politen"], answer: "politak" },
    { q: "Sagarrak ___ dira", hint: "rojas (plural)", options: ["gorriak", "gorria", "gorri", "gorriren"], answer: "gorriak" },
    { q: "Katua ___ da", hint: "negro (singular)", options: ["beltza", "beltzak", "beltz", "zuriak"], answer: "beltza" },
    { q: "Etxeak ___ dira", hint: "blancas (plural)", options: ["zuriak", "zuria", "zuri", "beltza"], answer: "zuriak" },
  ],
  etxea: [
    { q: "Ni sukaldean ___", hint: "egon: yo", options: ["nago", "dago", "zaude", "gaude"], answer: "nago" },
    { q: "Zu etxean ___", hint: "egon: tú", options: ["zaude", "nago", "dago", "daude"], answer: "zaude" },
    { q: "Giltza atean ___", hint: "egon: ella (la llave)", options: ["dago", "nago", "gaude", "zaudete"], answer: "dago" },
    { q: "Liburua ___ dago", hint: "en la mesa (-an)", options: ["mahaian", "mahaia", "mahaira", "mahaitik"], answer: "mahaian" },
  ],
  egunerokoa: [
    { q: "Goizean kafea ___ dut", hint: "tomar (habitual)", options: ["hartzen", "hartu", "hartuko", "hartzea"], answer: "hartzen" },
    { q: "Egunero euskara ___ dut", hint: "aprender (habitual)", options: ["ikasten", "ikasi", "ikasiko", "ikastea"], answer: "ikasten" },
    { q: "Zortzietan ___ naiz", hint: "levantarse (habitual)", options: ["jaikitzen", "jaiki", "jaikiko", "jaikitzea"], answer: "jaikitzen" },
    { q: "Gauean liburua ___ dut", hint: "leer (habitual)", options: ["irakurtzen", "irakurri", "irakurriko", "irakurtzea"], answer: "irakurtzen" },
  ],
  ordua: [
    { q: "Ordu ___ da", hint: "la una", options: ["bata", "bat", "batak", "batean"], answer: "bata" },
    { q: "___ dira", hint: "las tres", options: ["Hirurak", "Hiru", "Hiruan", "Hirutan"], answer: "Hirurak" },
    { q: "Gaur ___ da", hint: "lunes", options: ["astelehena", "igandea", "larunbata", "atzo"], answer: "astelehena" },
    { q: "Atzo ___ zen", hint: "domingo", options: ["igandea", "astelehena", "bihar", "gaur"], answer: "igandea" },
  ],
  janaria: [
    { q: "Kafe bat ___ dut", hint: "querer", options: ["nahi", "jaten", "edaten", "hartzen"], answer: "nahi" },
    { q: "Ogia ___ dut", hint: "comer (habitual)", options: ["jaten", "edaten", "jan", "jateko"], answer: "jaten" },
    { q: "Ura ___ dut", hint: "beber (habitual)", options: ["edaten", "jaten", "edan", "edateko"], answer: "edaten" },
    { q: "Zer nahi duzu ___?", hint: "para comer", options: ["jateko", "jaten", "jan", "jatea"], answer: "jateko" },
  ],
  erosketak: [
    { q: "___ balio du?", hint: "cuánto", options: ["Zenbat", "Non", "Nor", "Zer"], answer: "Zenbat" },
    { q: "___ noa", hint: "al mercado (-ra)", options: ["Merkatura", "Merkatuan", "Merkatutik", "Merkatua"], answer: "Merkatura" },
    { q: "Alkandora hau oso ___ da", hint: "caro", options: ["garestia", "merkea", "garesti", "merkeak"], answer: "garestia" },
    { q: "Hamar euro ___ du", hint: "costar", options: ["balio", "nahi", "behar", "hartzen"], answer: "balio" },
  ],
  herria: [
    { q: "___ dago geltokia?", hint: "dónde", options: ["Non", "Nor", "Zer", "Zenbat"], answer: "Non" },
    { q: "Jatetxea ___ dago", hint: "aquí", options: ["hemen", "hor", "han", "urrun"], answer: "hemen" },
    { q: "Hondartza ___ dago", hint: "cerca", options: ["gertu", "urrun", "han", "hor"], answer: "gertu" },
    { q: "Eskuinera eta gero ___", hint: "a la izquierda (-ra)", options: ["ezkerrera", "ezkerra", "ezkerrean", "ezkerretik"], answer: "ezkerrera" },
  ],
  garraioa: [
    { q: "___ noa lanera", hint: "en autobús (-z)", options: ["Autobusez", "Autobusa", "Autobusean", "Autobusera"], answer: "Autobusez" },
    { q: "Ni etxera ___", hint: "joan: yo", options: ["noa", "zoaz", "doa", "goaz"], answer: "noa" },
    { q: "Zu eskolara ___", hint: "joan: tú", options: ["zoaz", "noa", "doa", "doaz"], answer: "zoaz" },
    { q: "Gu hondartzara ___", hint: "joan: nosotros", options: ["goaz", "noa", "zoaz", "doa"], answer: "goaz" },
  ],
  eguraldia: [
    { q: "Euria ari ___", hint: "está lloviendo", options: ["du", "da", "dago", "dira"], answer: "du" },
    { q: "Hotz handia egiten ___", hint: "hace mucho frío", options: ["du", "da", "dago", "ari"], answer: "du" },
    { q: "Gaur eguzkia ___", hint: "hay sol (egon)", options: ["dago", "du", "da", "ari"], answer: "dago" },
    { q: "Neguan ___ egiten du", hint: "frío", options: ["hotza", "beroa", "euria", "eguzkia"], answer: "hotza" },
  ],
  aisialdia: [
    { q: "Musika gustatzen ___", hint: "me gusta (una cosa)", options: ["zait", "zaizkit", "dut", "naiz"], answer: "zait" },
    { q: "Liburuak gustatzen ___", hint: "me gustan (varias)", options: ["zaizkit", "zait", "ditut", "gara"], answer: "zaizkit" },
    { q: "Futbolean ___ dut", hint: "jugar (a un deporte)", options: ["jokatzen", "jolasten", "jokatu", "jokatuko"], answer: "jokatzen" },
    { q: "Zinemara joaten ___ larunbatetan", hint: "izan: nosotros", options: ["gara", "naiz", "dira", "zara"], answer: "gara" },
  ],
  lana: [
    { q: "___ egiten duzu lan?", hint: "en qué", options: ["Zertan", "Non", "Nor", "Zenbat"], answer: "Zertan" },
    { q: "Medikua ___", hint: "izan: yo", options: ["naiz", "dut", "nago", "da"], answer: "naiz" },
    { q: "Bulegoan lan egiten ___", hint: "auxiliar: yo", options: ["dut", "naiz", "nago", "da"], answer: "dut" },
    { q: "Unibertsitatean ___ dut", hint: "estudiar (habitual)", options: ["ikasten", "ikasi", "ikasiko", "ikastea"], answer: "ikasten" },
  ],
};

/* ------------------------------------------------------------
   Curiosidades culturales para las pantallas de resultados.
   ------------------------------------------------------------ */
const TIPS = [
  "El euskera es una lengua aislada: no está emparentada con ninguna otra lengua viva del mundo.",
  "El euskera batua (unificado) se creó en 1968 sobre la base de los dialectos centrales.",
  "En euskera se cuenta en base 20: cuarenta es «berrogei» (dos veintes), como el «quatre-vingts» francés.",
  "Muchos apellidos vascos describen el caserío: Etxeberria significa «la casa nueva».",
  "Palabras castellanas como «izquierda» (de ezkerra) o «chatarra» (de txatarra) vienen del euskera.",
  "Los bertsolaris improvisan versos cantados en euskera en campeonatos que llenan estadios.",
  "El pintxo, la tapa vasca, se llama así por el palillo que lo sujeta al pan.",
  "En euskera no hay género gramatical: «polita» vale para «bonito» y «bonita».",
  "La ikurriña, la bandera vasca, fue diseñada por los hermanos Arana en 1894.",
  "El lauburu («cuatro cabezas») es el símbolo tradicional vasco.",
  "El caserío (baserria) es la unidad tradicional de la vida rural vasca.",
  "«Agur» hoy es despedida, pero antiguamente era también un saludo solemne.",
  "El euskera tiene más de 700.000 hablantes entre Euskadi, Navarra e Iparralde.",
  "Los euskaltegis son las escuelas donde las personas adultas aprenden euskera: ¡hay más de 100!",
];

// Nº de lecciones por unidad (la última es el repaso/examen de la unidad)
const LESSONS_PER_UNIT = 4;
const EXERCISES_PER_LESSON = 10;
const DAILY_GOAL_XP = 30;
