// Contenido institucional inicial, tomado del PEI de la I.E. El Guineo.
// Todo esto se puede editar desde el panel de administración (/admin).

export const DEFAULT_SITE = {
  identidad: {
    nombre: "Institución Educativa El Guineo",
    nombreCorto: "I.E. El Guineo",
    lema: "Estudio y Progreso",
    eslogan: "Formando con sentido humano y empresarial",
    presentacion:
      "Establecimiento educativo oficial del corregimiento El Guineo, en Canalete, Córdoba. Ofrecemos educación inclusiva desde preescolar hasta la media.",
    corregimiento: "El Guineo",
    municipio: "Canalete",
    departamento: "Córdoba",
    caracter: "Oficial",
    rector: "Carlos Saltaren Acosta",
    dane: "223090000283",
    nit: "900043687-9",
    nucleo: "021-A",
    jornada: "Mañana",
    niveles: [
      "Preescolar",
      "Básica primaria, de primero a quinto",
      "Básica secundaria, de sexto a noveno",
      "Media vocacional, décimo y undécimo",
    ],
    resoluciones: [
      "Aprobada mediante Resolución 00642 del 23 de octubre de 2012",
      "Resolución de integración 0001357 del 20 de septiembre de 2002",
    ],
  },

  aviso: {
    activo: false,
    texto: "",
    enlace: "",
  },

  mision:
    "Somos un establecimiento educativo de carácter oficial ubicado en el corregimiento El Guineo, municipio de Canalete, Córdoba, que garantiza una educación inclusiva y orienta su acción pedagógica hacia el desarrollo integral de sus educandos en los niveles de preescolar, básica primaria, básica secundaria y media, a través de una propuesta metodológica que permita el respeto por las diferencias, en espacios apropiados para niños, niñas y jóvenes íntegros y participativos, conscientes de su realidad social y capaces de transformarla y aportar, como agentes críticos y activos, con sus conocimientos al desarrollo y mejoramiento de la calidad de vida de los habitantes de su región.",

  vision:
    "Para el año 2030, la Institución Educativa El Guineo será reconocida como un referente en educación rural de calidad, formando seres humanos íntegros, capaces de convivir en armonía, respetando la diversidad, los derechos humanos, el medio ambiente y los valores que fortalecen la vida en comunidad. Con instalaciones físicas seguras y adecuadas para el desarrollo integral de la comunidad educativa, contará con un equipo docente altamente cualificado, comprometido con la formación de estudiantes críticos, creativos y con sólidos valores, lo cual permitirá que nuestros egresados accedan con éxito a la educación superior y sean líderes comprometidos con el desarrollo social, económico y ambiental de su comunidad, generando un impacto positivo y sostenible en el corregimiento El Guineo y el municipio de Canalete.",

  filosofia: [
    "La Institución Educativa El Guineo está orientada hacia la realidad misma del educando, para responder a las expectativas y necesidades de la comunidad local, regional y nacional. Busca la formación integral del estudiante para que asuma una actitud positiva ante su entorno, el ser humano y la sociedad, dotado de un espíritu crítico, analítico y creativo, en un ambiente de respeto, solidaridad y tolerancia.",
    "Busca que el estudiante se prepare en forma responsable ante su comunidad y, para ello, facilita los medios para que se socialice, exprese sus ideas y conceptos y exponga sus creaciones artísticas y culturales, en armonía con el manual de convivencia, la Constitución Nacional y las leyes del Estado colombiano.",
    "Convencidos de que el interés por el bien común, la moral y la responsabilidad ciudadana son fundamentales para una adecuada convivencia y para el desarrollo familiar y social, formulamos los siguientes principios.",
  ],

  principios: [
    "Respeto por la dignidad humana.",
    "Fomento de valores auténticos que prevalezcan ante cualquier forma de manipulación.",
    "Orientación para el desarrollo de la personalidad y la capacidad de asumir con responsabilidad y autodominio los derechos y deberes, con base en el afecto y la igualdad entre las personas.",
    "Formación de una conciencia educativa para el estudio y el trabajo como medio de enriquecimiento del ser más que del tener.",
    "Desarrollo de un ambiente que favorezca las relaciones interpersonales.",
    "Desarrollo de la autonomía y de la capacidad para la toma de decisiones.",
  ],

  pilares: [
    "En todas las circunstancias, los integrantes de la comunidad educativa orientan sus acciones bajo el pleno respeto de los derechos humanos.",
    "La institución es un punto de encuentro de iguales, donde se reconoce la individualidad y el derecho a ser diferentes.",
    "Los bienes y servicios de la institución son patrimonio de todos y se usan procurando que sirvan a nuevas generaciones de estudiantes.",
    "El diálogo, la sinceridad y la solidaridad son instrumentos básicos para la convivencia y la solución de conflictos.",
    "La voluntad y la capacidad de trabajo son el fundamento para crecer ética e intelectualmente.",
    "Los integrantes de la comunidad educativa dedican su tiempo, energía y saber al compromiso de formación humana y a la construcción de la nación.",
  ],

  valores: {
    introduccion:
      "Los estudiantes guineístas deben ser ciudadanos comprensivos, líderes, dinámicos, emprendedores y justos, que demuestren principios universales en su vida diaria.",
    sociales: [
      "Autoestima",
      "Afectividad",
      "Sensibilidad",
      "Liderazgo",
      "Autenticidad",
      "Generosidad",
      "Amor",
      "Amistad",
      "Amabilidad",
      "Servicio",
      "Patriotismo",
    ],
    espirituales: ["Fe", "Caridad", "Templanza"],
    intelectuales: ["Conocimiento", "Sabiduría", "Abstracción", "Creatividad"],
  },

  perfilEstudiante: [
    "Respetuoso",
    "Responsable",
    "Puntual",
    "Afectuoso",
    "Autónomo",
    "Comunicativo",
    "Estudioso",
    "Crítico y analítico",
    "Emprendedor",
    "Con sentido de pertenencia y espíritu de superación",
  ],

  proyectos: [
    {
      nombre: "Club de Lectores",
      detalle: "Proyecto de lectura que, desde 2012, crea en toda la comunidad educativa el hábito de leer en público con fluidez y seguridad.",
    },
    {
      nombre: "Proyecto ambiental escolar (PRAE)",
      detalle: "Huertas, jardines y manejo de residuos sólidos para cuidar el entorno de la institución.",
    },
    {
      nombre: "Tienda saludable",
      detalle: "Promueve una alimentación sana dentro de la institución.",
    },
    {
      nombre: "Festival del Barrilete",
      detalle: "Actividad física y uso del tiempo libre que integra a las familias con los estudiantes.",
    },
    {
      nombre: "Proyecto de vida y valores humanos",
      detalle: "Acompaña a estudiantes y docentes en la reflexión sobre su historia, su presente y sus metas.",
    },
    {
      nombre: "Pitos y tambores",
      detalle: "Fomenta el gusto por la música folclórica de la región, la integración y el sentido de pertenencia.",
    },
    {
      nombre: "Movilidad segura",
      detalle: "Señalización de velocidad y educación vial en el entorno escolar.",
    },
    {
      nombre: "Escuela de padres",
      detalle: "Sesiones de formación con las familias para fortalecer las relaciones en el hogar.",
    },
  ],

  historia: {
    introduccion:
      "La institución está ubicada a doce kilómetros de la cabecera municipal, sobre la carretera que conduce de Canalete a Chaparral, al nororiente del municipio. Su historia es la de una comunidad que decidió educar a sus hijos aun antes de tener escuela.",
    hitos: [
      {
        anio: "1953",
        texto: "Las primeras clases se dictan en casas de familias de la comunidad, como las familias Ospino Morales y Ortega Ospino, con maestros contratados por los padres: Narciso Talavera, Ernesto Henao y Juan Barro.",
      },
      {
        anio: "1961",
        texto: "Los padres compran un terreno y construyen la escuela. Se oficializa la Escuela Rural Mixta El Guineo, primera del corregimiento, con la maestra Georgina Ramos Blanquiceth.",
      },
      {
        anio: "1972",
        texto: "Asume la dirección el profesor Luis Marino Lloreda Rentería.",
      },
      {
        anio: "1976",
        texto: "Se gradúa la primera promoción de básica primaria.",
      },
      {
        anio: "1987",
        texto: "La profesora Georgina Ortega Ospino asume la dirección. Más adelante, la comunidad consigue un terreno más amplio con el señor Luciano Ospino y el municipio construye la nueva sede.",
      },
      {
        anio: "2002",
        texto: "La escuela se integra con la Escuela Santa Teresita y nace el Centro Educativo El Guineo (Resolución 0001357 del 20 de septiembre).",
      },
      {
        anio: "2012",
        texto: "La Resolución 00642 del 23 de octubre aprueba los niveles de preescolar, básica y media.",
      },
      {
        anio: "2020",
        texto: "Se unifica el Proyecto Educativo Institucional de la sede El Guineo y sus sedes anexas.",
      },
    ],
  },

  simbolos: {
    escudoUrl: "assets/img/escudo.webp",
    escudoElementos: [
      {
        nombre: "La cinta roja",
        texto: "Lleva el lema institucional, Estudio y Progreso, que resume el camino que la institución propone a sus estudiantes.",
      },
      {
        nombre: "La mata de guineo",
        texto: "Con su racimo, recuerda el nombre del corregimiento y la vocación agrícola de la región.",
      },
      {
        nombre: "El campo y el ganado",
        texto: "Los árboles y el ganado en la llanura representan la vida rural de Canalete y del departamento de Córdoba.",
      },
      {
        nombre: "El libro abierto",
        texto: "Simboliza el estudio y el conocimiento como base del progreso de la comunidad.",
      },
    ],
    banderaUrl: "",
    banderaDescripcion: "",
    himno: {
      titulo: "",
      autor: "",
      letra: "",
      audioUrl: "",
    },
  },

  contacto: {
    direccion: "Corregimiento El Guineo, a 12 km de la cabecera municipal de Canalete, Córdoba",
    telefono: "",
    whatsapp: "",
    correo: "",
    horario: "Jornada de la mañana",
    facebook: "",
    mapa: "https://www.google.com/maps/search/?api=1&query=El%20Guineo%2C%20Canalete%2C%20C%C3%B3rdoba",
    sedes: [
      { nombre: "Sede principal El Guineo", detalle: "Corregimiento El Guineo, Canalete" },
    ],
  },

  documentos: {
    categorias: [
      "Documentos institucionales",
      "Circulares",
      "Horarios y calendario",
      "Formatos",
      "Resultados y logros",
    ],
  },

  noticias: {
    categorias: ["Noticias", "Eventos", "Comunicados", "Logros"],
  },
};

// Une el contenido guardado con los valores por defecto, para que un campo
// nuevo en el código aparezca aunque el contenido guardado sea más antiguo.
export function mergeDefaults(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (defaults && typeof defaults === "object") {
    const out = {};
    const src = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    for (const k of Object.keys(defaults)) out[k] = mergeDefaults(defaults[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return saved === undefined || saved === null ? defaults : saved;
}
