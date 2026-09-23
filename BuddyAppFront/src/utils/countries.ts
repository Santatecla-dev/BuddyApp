const COUNTRY_ALIASES: Record<string, string> = {
  espana: 'spain', francia: 'france', italia: 'italy', alemania: 'germany',
  reinounido: 'unitedkingdom', afganistan: 'afghanistan', grecia: 'greece',
  turquia: 'turkey', marruecos: 'morocco', egipto: 'egypt', sudafrica: 'southafrica',
  estadosunidosdeamerica: 'unitedstates', unitedstatesofamerica: 'unitedstates', brasil: 'brazil',
  nuevazelanda: 'newzealand', japon: 'japan', pakistan: 'pakistan', tailandia: 'thailand',
  indonesia: 'indonesia', filipinas: 'philippines', rusia: 'russia', peru: 'peru',
  chile: 'chile', ecuador: 'ecuador', vietnam: 'vietnam', malasia: 'malaysia',
  singapur: 'singapore', maldivas: 'maldives', madagascar: 'madagascar', mauricio: 'mauritius',
  fiyi: 'fiji', papuanuevaguinea: 'papuanewguinea', belice: 'belize', costarica: 'costarica',
  panama: 'panama', honduras: 'honduras', guatemala: 'guatemala', republicadominicana: 'dominicanrepublic',
  bahamas: 'bahamas', malta: 'malta', chipre: 'cyprus', croacia: 'croatia', eslovenia: 'slovenia',
  montenegro: 'montenegro', bosniayherzegovina: 'bosniaandherzegovina', oman: 'oman',
  emiratosarabesunidos: 'unitedarabemirates', arabiasaudi: 'saudiarabia', jordania: 'jordan',
  kenia: 'kenya', tanzania: 'tanzania', mozambique: 'mozambique', comoras: 'comoros',
  bangladesh: 'bangladesh', srilanka: 'srilanka', myanmar: 'myanmar', camboya: 'cambodia',
  laos: 'laos', brunei: 'brunei', taiwan: 'taiwan',
};

export const countryKey = (value: string) => value.toLocaleLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

export const canonicalCountryKey = (value: string) => COUNTRY_ALIASES[countryKey(value)] || countryKey(value);
