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

const cityLabelLookup = new Map(PALESTINIAN_CITIES.map((city) => [city.value, city.label]));
const cityValueLookup = new Map(
  PALESTINIAN_CITIES.flatMap((city) => [
    [city.value, city.value],
    [city.label.toLowerCase(), city.value],
  ]),
);

export const normalizeCityValue = (value = '') => {
  const normalizedValue = String(value).trim().toLowerCase().replace(/[_\s]+/g, '-');
  return cityValueLookup.get(normalizedValue) ?? normalizedValue;
};

export const getCityLabel = (value = '') => {
  const normalizedValue = normalizeCityValue(value);
  return cityLabelLookup.get(normalizedValue) ?? String(value || '').trim();
};

export const isKnownCityValue = (value = '') => cityLabelLookup.has(normalizeCityValue(value));
