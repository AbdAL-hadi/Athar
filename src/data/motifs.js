const motifImage = (fileName) => `engraving/${fileName}`;

export const motifStories = [
  {
    id: 'athar-01',
    code: 'Athar_01',
    title: 'Jaffa Sea Flowers Piece',
    image: motifImage('Athar_01.jpeg'),
    description:
      'A refined piece inspired by the Palestinian Sea Flowers motif from Jaffa, reflecting coastal beauty, heritage, and timeless elegance in a modern design.',
    productIds: ['coastal-card-holder'],
  },
  {
    id: 'athar-02',
    code: 'Athar_02',
    title: 'Star of Bethlehem',
    image: motifImage('Athar_02.jpeg'),
    description:
      'A Palestinian motif inspired by the Star of Bethlehem, known for its balanced geometric form and timeless traditional beauty.',
    productIds: ['bethlehem-star-card-sleeve'],
  },
  {
    id: 'athar-03',
    code: 'Athar_03',
    title: 'Gaza Wave Belt',
    image: motifImage('Athar_03.jpeg'),
    description:
      'A refined belt inspired by the Palestinian Wave motif from Gaza, reflecting coastal beauty, movement, and timeless elegance in a modern design.',
    productIds: ['wave-belt-bracelet'],
  },
  {
    id: 'athar-04',
    code: 'Athar_04',
    title: 'Peacock Eye Piece',
    image: motifImage('Athar_04.jpeg'),
    description:
      'A refined piece inspired by the Palestinian Peacock Eye motif from Hebron, reflecting heritage, elegance, and timeless beauty in a modern design.',
    productIds: ['peacock-eye-wallet', 'desert-carryall'],
  },
  {
    id: 'athar-05',
    code: 'Athar_05',
    title: 'Jaffa Cypress Watch',
    image: motifImage('Athar_05.jpeg'),
    description:
      'A refined watch inspired by the Palestinian Cypress Tree motif from Jaffa, capturing the spirit of heritage, elegance, and resilience in a timeless modern design.',
    productIds: ['cedar-bloom-watch'],
  },
  {
    id: 'athar-06',
    code: 'Athar_06',
    title: 'Hebron Vine Piece',
    image: motifImage('Athar_06.jpeg'),
    description:
      'A refined piece inspired by the grapevines of Hebron, reflecting Palestinian heritage, natural beauty, and timeless elegance in a modern design.',
    productIds: ['filigree-round-sunglasses', 'athar-gaza-rose-handbag'],
  },
  {
    id: 'athar-07',
    code: 'Athar_07',
    title: 'Ramallah Wheat Ears Set',
    image: motifImage('Athar_07.jpeg'),
    description:
      'A refined set inspired by the Palestinian Wheat Ears motif from Ramallah, reflecting heritage, abundance, and timeless elegance in a modern design.',
    productIds: ['wheat-ear-set'],
  },
];

export const motifStoryLookup = new Map(motifStories.map((motif) => [motif.id, motif]));

export const productMotifLookup = motifStories.reduce((lookup, motif) => {
  motif.productIds.forEach((productId) => {
    lookup[productId] = {
      motifId: motif.id,
      motifCode: motif.code,
    };
  });

  return lookup;
}, {});
