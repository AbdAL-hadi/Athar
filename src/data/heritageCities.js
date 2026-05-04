export const heritageCities = [
  {
    id: 'jerusalem',
    name: 'Jerusalem',
    arabicName: 'Al-Quds',
    coordinates: [31.7683, 35.2137],
    story:
      'Jerusalem is a timeless city of faith, resilience, and beauty. Its stone streets, domes, and sacred landmarks inspire details rooted in history and made for today.',
    motifs: ['Dome geometry', 'Stone arches', 'Olive branch', 'Old city lines'],
  },
  {
    id: 'nablus',
    name: 'Nablus',
    arabicName: 'Nablus',
    coordinates: [32.2211, 35.2544],
    story:
      'Nablus is known for its old markets, soap-making heritage, and craftsmanship. Its textures and traditional details inspire refined Athar pieces.',
    motifs: ['Old market lines', 'Craft heritage', 'Stone texture', 'Soap pattern inspiration'],
  },
  {
    id: 'hebron',
    name: 'Hebron',
    arabicName: 'Al-Khalil',
    coordinates: [31.5326, 35.0998],
    story:
      'Hebron carries a deep legacy of glass, craft, and historic stone. Its handmade traditions inspire pieces with strength and character.',
    motifs: ['Glass craft', 'Historic stone', 'Geometric detail', 'Handmade heritage'],
  },
  {
    id: 'gaza',
    name: 'Gaza',
    arabicName: 'Gaza',
    coordinates: [31.5017, 34.4668],
    story:
      'Gaza reflects coastal beauty, resilience, and a rich embroidery identity. Its sea colors and cultural patterns inspire expressive designs.',
    motifs: ['Coastal lines', 'Embroidery motifs', 'Sea-inspired tones', 'Resilience symbols'],
  },
  {
    id: 'jaffa',
    name: 'Jaffa',
    arabicName: 'Yafa',
    coordinates: [32.05, 34.7522],
    story:
      'Jaffa blends sea, stone, oranges, and old port memories. Its soft coastal heritage inspires warm and elegant Athar details.',
    motifs: ['Old port', 'Orange blossom', 'Coastal stone', 'Warm heritage'],
  },
  {
    id: 'ramallah',
    name: 'Ramallah',
    arabicName: 'Ramallah',
    coordinates: [31.9038, 35.2034],
    story:
      'Ramallah is a city of culture, movement, and modern Palestinian creativity. Its energy inspires contemporary pieces with heritage roots.',
    motifs: ['Modern heritage', 'Cultural rhythm', 'Olive hills', 'Creative identity'],
  },
  {
    id: 'bethlehem',
    name: 'Bethlehem',
    arabicName: 'Bayt Lahm',
    coordinates: [31.7054, 35.2024],
    story:
      'Bethlehem carries the warmth of craft, faith, and mother-of-pearl traditions. Its details inspire gentle and meaningful designs.',
    motifs: ['Mother-of-pearl', 'Star motif', 'Craft tradition', 'Soft sacred geometry'],
  },
];

export const heritageCityOptions = heritageCities.map((city) => ({
  value: city.id,
  label: city.name,
}));

export const getHeritageCityById = (cityId) =>
  heritageCities.find((city) => city.id === cityId) ?? null;
