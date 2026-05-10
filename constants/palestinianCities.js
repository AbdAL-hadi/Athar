export const PALESTINIAN_CITIES = [
  { value: 'jerusalem', label: 'Jerusalem' },
  { value: 'nablus', label: 'Nablus' },
  { value: 'hebron', label: 'Hebron' },
  { value: 'gaza', label: 'Gaza' },
  { value: 'jaffa', label: 'Jaffa' },
  { value: 'ramallah', label: 'Ramallah' },
  { value: 'bethlehem', label: 'Bethlehem' },
  { value: 'jenin', label: 'Jenin' },
  { value: 'tulkarm', label: 'Tulkarm' },
  { value: 'qalqilya', label: 'Qalqilya' },
  { value: 'salfit', label: 'Salfit' },
  { value: 'tubas', label: 'Tubas' },
  { value: 'jericho', label: 'Jericho' },
  { value: 'rafah', label: 'Rafah' },
  { value: 'khan-yunis', label: 'Khan Yunis' },
  { value: 'deir-al-balah', label: 'Deir al-Balah' },
  { value: 'beit-lahia', label: 'Beit Lahia' },
  { value: 'beit-hanoun', label: 'Beit Hanoun' },
];

const normalizeCityKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/city$/i, '')
    .replace(/[._\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const cityAliases = [
  ['القدس', 'jerusalem'],
  ['نابلس', 'nablus'],
  ['الخليل', 'hebron'],
  ['غزة', 'gaza'],
  ['يافا', 'jaffa'],
  ['رام-الله', 'ramallah'],
  ['رام الله', 'ramallah'],
  ['بيت-لحم', 'bethlehem'],
  ['بيت لحم', 'bethlehem'],
  ['جنين', 'jenin'],
  ['طولكرم', 'tulkarm'],
  ['قلقيلية', 'qalqilya'],
  ['سلفيت', 'salfit'],
  ['طوباس', 'tubas'],
  ['أريحا', 'jericho'],
  ['اريحا', 'jericho'],
  ['رفح', 'rafah'],
  ['خان-يونس', 'khan-yunis'],
  ['خان يونس', 'khan-yunis'],
  ['دير-البلح', 'deir-al-balah'],
  ['دير البلح', 'deir-al-balah'],
  ['بيت-لاهيا', 'beit-lahia'],
  ['بيت لاهيا', 'beit-lahia'],
  ['بيت-حانون', 'beit-hanoun'],
  ['بيت حانون', 'beit-hanoun'],
  ['nablus-city', 'nablus'],
  ['hebron-city', 'hebron'],
  ['gaza-city', 'gaza'],
];

const cityLabelLookup = new Map(PALESTINIAN_CITIES.map((city) => [city.value, city.label]));
const cityValueLookup = new Map(
  PALESTINIAN_CITIES.flatMap((city) => [
    [city.value, city.value],
    [normalizeCityKey(city.label), city.value],
  ]),
);

cityAliases.forEach(([alias, value]) => {
  cityValueLookup.set(normalizeCityKey(alias), value);
});

export const normalizeCityValue = (value = '') => {
  const normalizedValue = normalizeCityKey(value);
  return cityValueLookup.get(normalizedValue) ?? normalizedValue;
};

export const normalizeCity = normalizeCityValue;

export const getCityLabel = (value = '') => {
  const normalizedValue = normalizeCityValue(value);
  return cityLabelLookup.get(normalizedValue) ?? String(value || '').trim();
};

export const isKnownCityValue = (value = '') => cityLabelLookup.has(normalizeCityValue(value));
