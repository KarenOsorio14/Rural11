'use strict';
// Preguntas de Verdadero/Falso. Solo se usan en la Práctica libre (el simulacro ICFES es solo de selección múltiple).
// "tema" coincide con el "id" de TOPICS. correctIndex: 0 = Verdadero, 1 = Falso.

const VF = ['Verdadero', 'Falso'];

export const VF_QUESTIONS = [
  { id: 'vf-h1', tema: 'historia', text: 'La Constitución de 1886 estableció en Colombia un Estado federal con gran autonomía para los estados.', options: VF, correctIndex: 1, explanation: 'La Constitución de 1886 creó una república centralista y unitaria, no federal.' },
  { id: 'vf-h2', tema: 'historia', text: 'El Virreinato de la Nueva Granada se creó durante el siglo XVIII.', options: VF, correctIndex: 0, explanation: 'Se creó en 1717 (y se restableció en 1739), es decir, en el siglo XVIII.' },
  { id: 'vf-g1', tema: 'geografia', text: 'El río Magdalena nace en el Macizo Colombiano y desemboca en el mar Caribe.', options: VF, correctIndex: 0, explanation: 'El Magdalena nace en el Macizo Colombiano y desemboca en Bocas de Ceniza, en el Caribe.' },
  { id: 'vf-g2', tema: 'geografia', text: 'Colombia limita con Brasil, Perú, Ecuador, Venezuela y Panamá.', options: VF, correctIndex: 0, explanation: 'Esos son los cinco países con los que Colombia tiene frontera terrestre.' },
  { id: 'vf-c1', tema: 'constitucion', text: 'La acción de tutela sirve para proteger los derechos fundamentales de las personas.', options: VF, correctIndex: 0, explanation: 'La tutela (art. 86) protege los derechos fundamentales cuando son vulnerados o amenazados.' },
  { id: 'vf-c2', tema: 'constitucion', text: 'La Constitución de 1991 divide el poder público en tres ramas: ejecutiva, legislativa y judicial.', options: VF, correctIndex: 0, explanation: 'Las tres ramas clásicas, más los órganos de control y electorales que son autónomos.' },
  { id: 'vf-s1', tema: 'sociedad', text: 'Una opinión equivale a un hecho comprobado.', options: VF, correctIndex: 1, explanation: 'Un hecho se puede verificar con evidencia; una opinión es una valoración personal.' },
  { id: 'vf-s2', tema: 'sociedad', text: 'El derecho a la vida es un derecho fundamental protegido por la Constitución colombiana.', options: VF, correctIndex: 0, explanation: 'El artículo 11 de la Constitución declara que el derecho a la vida es inviolable.' },
  { id: 'vf-s3', tema: 'sociedad', text: 'Un derecho humano puede ser retirado a una persona si el Estado así lo decide.', options: VF, correctIndex: 1, explanation: 'Los derechos humanos son inalienables: ningún Estado puede quitarlos.' },
  { id: 'vf-s4', tema: 'sociedad', text: 'Una fuente primaria es un documento producido en la misma época del hecho que se estudia.', options: VF, correctIndex: 0, explanation: 'Las fuentes primarias son contemporáneas al hecho: cartas, actas, fotografías de la época.' }
];
