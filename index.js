async function addCountry(svg, country, datapath, path, idgen) {
  const geojson = await d3.json(datapath);
  const deps = svg.append("g")
    .attr('id', country);

  deps.selectAll('path')
      .data(geojson.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('id', idgen);
}

async function preProcessHospitalItaly(url, populationUrl) {
  const population = (await (await fetch(populationUrl)).text())
    .split('\n')
    .map(line => line.split(','))
    .reduce((acc, line) => { acc[line[0]] = Number(line[2]); return acc; }, {});
  const rawData = (await (await fetch(url)).text()).replaceAll('"', '').split('\n');
  const [ headers, ...rest ] = rawData;
  const headerFields = headers.split(',');

  return rest
    // Remote empty lines
    .filter(line => line !== '')
    // Convert the raw data into an array of object
    .reduce((acc, line) => {
      const entry = Object.fromEntries(line.split(',').map((value, index) =>
        [headerFields[index], value]
      ));

      entry.id = `italia-${entry.codice_regione}`;
      entry.date = new Date(entry.data);
      entry.date.setHours(1); entry.date.setMinutes(0); entry.date.setSeconds(0);
      entry.timestamp = entry.date.getTime();
      entry.totale_ospedalizzati = Number(entry.totale_ospedalizzati);
      entry.heat = entry.totale_ospedalizzati / population[entry.codice_regione];

      acc.push(entry);
      return acc;
    }, [])
    // Convert to a map indexed by date with a list of regions per date
    .reduce((acc, value) => {
      (acc[value.timestamp] = acc[value.timestamp] ?? []).push(value);
      return acc;
    }, {});
}

async function preProcessHospitalSwitzerland(url, populationUrl) {
  const population = (await (await fetch(populationUrl)).text())
    .split('\n')
    .filter(line => line !== '')
    .map(line => line.split(';'))
    .reduce((acc, line) => { acc[line[0]] = Number(line[1]); return acc; }, {});

  const rawData = (await (await fetch(url)).json());

  return rawData
    // Convert the raw data into an array of object
    .reduce((acc, entry) => {
      entry.id = `switzerland-${entry.geoRegion}`;
      entry.date = new Date(entry.date);
      entry.date.setHours(1); entry.date.setMinutes(0); entry.date.setSeconds(0);
      entry.timestamp = entry.date.getTime();
      entry.Total_Covid19Patients = Number(Number.isInteger(entry.Total_Covid19Patients) ? entry.Total_Covid19Patients : 0);
      entry.heat = entry.Total_Covid19Patients / population[entry.geoRegion];

      acc.push(entry);
      return acc;
    }, [])
    // Convert to a map indexed by date with a list of regions per date
    .reduce((acc, value) => {
      (acc[value.timestamp] = acc[value.timestamp] ?? []).push(value);
      return acc;
    }, {});
}

async function preProcessHospitalGermany(url, populationUrl) {
  const mapping = {
    BRANDENBURG: 'DE-BB',
    SACHSEN_ANHALT: 'DE-ST',
    THUERINGEN: 'DE-TH',
    SCHLESWIG_HOLSTEIN: 'DE-SH',
    HAMBURG: 'DE-HH',
    BADEN_WUERTTEMBERG: 'DE-BW',
    SACHSEN: 'DE-SN',
    RHEINLAND_PFALZ: 'DE-RP',
    BAYERN: 'DE-BY',
    HESSEN: 'DE-HE',
    NIEDERSACHSEN: 'DE-NI',
    BERLIN: 'DE-BE',
    SAARLAND: 'DE-SL',
    BREMEN: 'DE-HB',
    MECKLENBURG_VORPOMMERN: 'DE-MV',
    NORDRHEIN_WESTFALEN: 'DE-NW',
  };

  const population = (await (await fetch(populationUrl)).text())
    .split('\n')
    .map(line => line.split(','))
    .reduce((acc, line) => { acc[line[0]] = Number(line[2]); return acc; }, {});
  const rawData = (await (await fetch(url)).text()).replaceAll('"', '').split('\n');
  const [ headers, ...rest ] = rawData;
  const headerFields = headers.split(',');

  return rest
    // Remote empty lines
    .filter(line => line !== '')
    // Convert the raw data into an array of object
    .reduce((acc, line) => {
      const entry = Object.fromEntries(line.split(',').map((value, index) =>
        [headerFields[index], value]
      ));

      entry.id = `germany-${mapping[entry.Bundesland]}`;
      entry.date = new Date(entry.Datum);
      entry.date.setHours(1); entry.date.setMinutes(0); entry.date.setSeconds(0);
      entry.timestamp = entry.date.getTime();
      entry.Anzahl_Meldebereiche_Erwachsene = Number(entry.Anzahl_Meldebereiche_Erwachsene);
      entry.heat = entry.Anzahl_Meldebereiche_Erwachsene / population[mapping[entry.Bundesland]];

      acc.push(entry);
      return acc;
    }, [])
    // Convert to a map indexed by date with a list of regions per date
    .reduce((acc, value) => {
      (acc[value.timestamp] = acc[value.timestamp] ?? []).push(value);
      return acc;
    }, {});
}

async function preProcessHospitalFrance(url, populationUrl) {
  const population = (await (await fetch(populationUrl)).text())
    .split('\n')
    .map(line => line.split(';'))
    .reduce((acc, line) => { acc[line[0]] = Number(line[1]); return acc; }, {});
  const rawData = (await (await fetch(url)).text()).replaceAll('"', '').split('\n');
  const [ headers, ...rest ] = rawData;
  const headerFields = headers.split(';');

  const tmp = rest
    // Remote empty lines
    .filter(line => line !== '')
    // Convert the raw data into an array of object
    .reduce((acc, line) => {
      const entry = Object.fromEntries(line.split(';').map((value, index) =>
        [headerFields[index], value]
      ));

      entry.id = `france-${entry.dep.padStart(2, '0')}`;
      entry.date = new Date(entry.jour);
      entry.date.setHours(1); entry.date.setMinutes(0); entry.date.setSeconds(0);
      entry.timestamp = entry.date.getTime();
      entry.hosp = Number(entry.hosp);
      entry.rea = Number(entry.rea);
      entry.rad = Number(entry.rad)
      entry.dc = Number(entry.dc)

      acc.push(entry);
      return acc;
    }, [])
    // Sort by departement then by date
    .sort((a, b) =>
      a.timestamp < b.timestamp
        ? -1
        : a.deps < b.deps ? -1: 0)
    // Create a map with the date containing map with departement as key and each stats are merged
    // accross sexes and sex is erased
    .reduce((acc, value) => {
      acc[value.timestamp] = acc[value.timestamp] !== undefined ? acc[value.timestamp] : {};
      if (acc[value.timestamp][value.dep] === undefined) {
        acc[value.timestamp][value.dep] = value;
      } else {
        acc[value.timestamp][value.dep].hosp += value.hosp;
        acc[value.timestamp][value.dep].rea += value.rea;
        acc[value.timestamp][value.dep].rad += value.rad;
        acc[value.timestamp][value.dep].dc += value.dc;
        acc[value.timestamp][value.dep].heat = value.hosp / population[value.dep];
        delete acc[value.timestamp][value.dep].sex;
      }
      return acc;
    }, {});
    // Convert map of map to map of array
    Object.keys(tmp).map(k => tmp[k] = Object.values(tmp[k]))
    return tmp;
}

async function preProcessTestFrance(url, windowSize = 14) {
  const rawData = (await (await fetch(url)).text()).split('\n');
  const [ headers, ...rest ] = rawData;
  const headerFields = headers.split(';');

  let positiveWindow = {};
  let departementIndex = 0;
  return rest
    // Remote empty lines
    .filter(line => line !== '')
    // Convert the raw data into an array of object
    .reduce((acc, line) => {
      const entry = Object.fromEntries(line.split(';').map((value, index) =>
        [headerFields[index], value]
      ));
      entry.id = `france-${entry.dep.padStart(2, '0')}`;
      entry.date = new Date(entry.jour);
      entry.timestamp = entry.date.getTime();
      entry.P = Number(entry.P);
      entry.T = Number(entry.T);
      entry.pop = Number(entry.pop)
      entry.cl_age90 = Number(entry.cl_age90);

      acc.push(entry);
      return acc;
    }, [])
    // Only keep the aggregate per days (we don't care about the age distribution here)
    .filter(entry => entry.cl_age90 === 0)
    // Sort by departement then by date
    .sort((a, b) =>
      a.timestamp < b.timestamp
        ? -1
        : a.deps < b.deps ? -1: 0)
    // Compute some accumulated statistics
    .map((entry, index, entries) => {
      // When we change department, we change the index of the first entry in that department
      if (index > 1 && entry.dep !== entries[index - 1].dep) departementIndex = index;

      positiveWindow[entry.dep] = (positiveWindow[entry.dep] ?? 0) + entry.P;
      if ((index - departementIndex) >= windowSize) {
        positiveWindow[entry.dep] -= entries[index - windowSize].P;
      }
      entry.positiveWindow = positiveWindow[entry.dep];
      entry.heat = entry.positiveWindow / entry.pop;

      return entry;
    })
    // Create a map with the date as key and the array of department as values
    .reduce((acc, value) => {
      (acc[value.timestamp] = acc[value.timestamp] ? acc[value.timestamp] : []).push(value);
      return acc;
    }, {});
}

function applyColor(countryData) {
  const palette = d3.scaleSequential().interpolator(d3.interpolateRdYlBu).domain([0.0005, 0]);
  for (entry of countryData) {
    const element = document.getElementById(entry.id);
    if (element !== undefined && element !== null) {
      element.style.fill = palette(entry.heat)
    } else {
      console.warn(`coudn't find element ${entry.id}`);
    }
  }
}

function setupSlider(elements, dates) {
  dates.sort();
  elements.slider.min = 0;
  elements.slider.value = 0;
  elements.slider.max = dates.length - 1;
  const dateSubject = new Observable.Subject();

  elements.slider.addEventListener('input', event => dateSubject.next(elements.slider.value));

  elements.backward.addEventListener('click', event => {
    elements.slider.value = Number(elements.slider.value) - 1;
    dateSubject.next(elements.slider.value);
  });

  elements.forward.addEventListener('click', event => {
    elements.slider.value = Number(elements.slider.value) + 1;
    dateSubject.next(elements.slider.value);
  });

  let interval;
  elements.play.addEventListener('click', event => {
    if (interval === undefined) {
      elements.play.childNodes[0].classList.remove('fa-play');
      elements.play.childNodes[0].classList.add('fa-pause');
      interval = setInterval(() => {
        elements.slider.value = Number(elements.slider.value) + 1;
        dateSubject.next(elements.slider.value);
        if (elements.slider.value === elements.slider.max) {
          elements.play.childNodes[0].classList.remove('fa-pause');
          elements.play.childNodes[0].classList.add('fa-play');
          clearInterval(interval);
          interval = undefined;
        }
      }, 30);
    } else {
      elements.play.childNodes[0].classList.remove('fa-pause');
      elements.play.childNodes[0].classList.add('fa-play');
      clearInterval(interval);
      interval = undefined;
    }
  });

  return dateSubject;
}

const dayLabels = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const monthLabels = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Aout',
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
];

async function main() {
  const container = document.getElementById('map-container');
  const { width, height } = container.getBoundingClientRect();

  const path = d3.geoPath();
  // Focus on Western Europe
  // const projection = d3.geoConicConformal()
  //   .center([5.1, 46.279229])
  //   .scale(1350)
  //   .translate([width / 2, height / 2]);
  // Focus on France
  const projection = d3.geoConicConformal()
    .center([2.5, 49.5])
    .scale(5000)
  path.projection(projection);
  window.projection = projection;
  window.path = path;

  // I don't what does it return but it is not an svg. In the constructor in the
  // browser console, it is called a 'Pn'...
  const pn = d3.select('#map-container').append('svg')
      .attr('id', 'svg')
      .attr('viewBox', '0 0 1024 1024')
      .attr('width', width)
      .attr('height', height);

  await addCountry(pn, 'france', 'departements.geojson', path, d => `france-${d.properties.code}`);
  // source: https://github.com/isellsoap/deutschlandGeoJSON/
  // await addCountry(pn, 'germany', '1_sehr_hoch.geo.json', path, d => `germany-${d.properties.id}`);
  await addCountry(pn, 'switzerland', 'swiss-cantons.json', path, d => `switzerland-${d.id}`);
  // source: https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/
  await addCountry(pn, 'italy', 'limits_IT_regions.geojson', path, d => `italia-${d.properties.reg_istat_code}`);
  // await addCountry(pn, 'spain', 'spain-provinces.geojson', path, d => console.log(d));


  // source: https://www.data.gouv.fr/fr/datasets/donnees-relatives-aux-resultats-des-tests-virologiques-covid-19/
  // const france = await preProcessTestFrance('https://www.data.gouv.fr/fr/datasets/r/406c6a23-e283-4300-9484-54e78c8ae675');
  const france = await preProcessHospitalFrance('https://www.data.gouv.fr/fr/datasets/r/63352e38-d353-4b54-bfd1-f1b3ee1cabd7', 'france-departement-population.csv');
  // source: https://github.com/pcm-dpc/COVID-19.git
  const italy = await preProcessHospitalItaly('https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-regioni/dpc-covid19-ita-regioni.csv', 'italy-region-population.csv');
  // source: https://www.intensivregister.de/#/aktuelle-lage/reports
  // const germany = await preProcessHospitalGermany('bundesland-zeitreihe.csv', 'germany-bundeslander-population.csv');
  // source: https://www.covid19.admin.ch/en/epidemiologic/hosp
  const swissData = (await (await fetch('https://www.covid19.admin.ch/api/data/context')).json()).sources.individual.json.daily.hospCapacity;
  const switzerland = await preProcessHospitalSwitzerland(swissData, 'swiss-cantons-population.csv');
  window.switzerland = switzerland;


  const dates = Object.keys(france);

  const slider = document.getElementById('date-slider');
  const backward = document.getElementsByClassName('btn-backward')[0];
  const play = document.getElementsByClassName('btn-play')[0];
  const forward = document.getElementsByClassName('btn-forward')[0];

  const dateSubject = setupSlider({ slider, backward, play, forward }, dates);

  const currentDate = document.getElementById('current-date');
  dateSubject.subscribe(dateIndex => {
    applyColor(france[dates[dateIndex]]);
    if (dates[dateIndex] in italy) applyColor(italy[dates[dateIndex]]);
    // if (dates[dateIndex] in germany) applyColor(germany[dates[dateIndex]]);
    if (dates[dateIndex] in switzerland) applyColor(switzerland[dates[dateIndex]]);
    const date = new Date(Number(dates[dateIndex]));
    currentDate.innerText = `${dayLabels[date.getDay()]} ${date.getDate()} ${monthLabels[date.getMonth()]} ${1900 + date.getYear()}`;
  });
  dateSubject.next(0);

  // window.france = france;

  play.click();

  const viewBoxModel = new Decorators.MutableModel({
    x: 0,
    y: 0,
    width: 1024,
    height: 1024,
  });

  const svg = container.getElementsByTagName('svg')[0];

  const panDecorator = new PanDecorator(svg, viewBoxModel).enable();
  const zoomDecorator = new ZoomDecorator(svg, viewBoxModel).enable();

  viewBoxModel.subscribe(viewBox => {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  })
}

window.onload = main;
