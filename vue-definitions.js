// custom graph component
Vue.component('graph', {

  props: ['traces', 'layout'],

  template: '<div ref="graph" class="graph" style="height: 600px;"></div>',

  methods: {

    makeGraph() {
      Plotly.newPlot(this.$refs.graph, this.traces, this.layout);
    },

  },

  mounted() {
    this.makeGraph();
  },

  watch: {
    traces() {
      this.makeGraph();
    }
  }


})


// Sets up the main Vue instance

var app = new Vue({
  el: '#root',

  methods: {

    loadData(URL, callback) {

      console.log('GET request: ', URL);

      let http = new XMLHttpRequest();

      http.open("GET", URL);
      http.send();

      http.onload = () => callback(http.responseText);

      http.onerror = () => console.log('error');
    },

    loadCountries(data) {

      this.countries = JSON.parse(data).results
        .filter(e => e.name !== undefined)
        .filter(e => e.count > 20000)
        .sort((a,b) => a.name > b.name);

    },

    loadCities(data) {

      this.cities = JSON.parse(data).results
        .filter(e => e.name !== undefined)
        .filter(e => e.count > 20000)
        .sort((a,b) => a.name > b.name);

    },

    loadLocations(data) {

      this.locations = JSON.parse(data).results
        .filter(e => e.location !== undefined)
        .filter(e => Math.abs(new Date(e.lastUpdated) - this.date) < 7*24*60*60*1000)
        .sort((a,b) => a.location > b.location);

      for (let location of this.locations) {
        this.requestAQData(location);
      }

    },

    requestCityData() {
      this.loadData('https://api.openaq.org/v1/cities?limit=10000&country=' + this.country.code, this.loadCities);
    },

    requestLocationData() {
      this.loadData('https://api.openaq.org/v1/locations?limit=10000&country=' + this.country.code + '&city=' + this.city.name, this.loadLocations);
    },

    requestAQData(location) {

      this.loadData('https://api.openaq.org/v1/measurements?limit=10000&country=' + this.country.code + '&city=' + this.city.name + '&location=' + location.location + '&parameter=pm25&date_from=' + this.startDate, this.getAQData);

      for (let p of location.parameters) {
        if (!this.parameters.includes(p)) {
          this.parameters.push(p);
        }
      }

    },

    reloadData(parameter) {

      console.log('reloading data for ', parameter);

      this.traces = [];

      let locations = this.locations.filter(e => e.parameters.includes(parameter)).map(e => e.location);

      for (let loc of locations) {
        this.loadData('https://api.openaq.org/v1/measurements?limit=10000&country=' + this.country.code + '&city=' + this.city.name + '&location=' + loc + '&parameter=' + parameter + '&date_from=' + this.startDate, this.getAQData);
      }

    },

    getAQData(data) {

      let AQdata = JSON.parse(data).results
        .filter(e => e.value >= 0);

      if (AQdata.length > 0) {

        let location = AQdata[0].location;
        let myTrace = {
          x: AQdata.map(e => e.date.local),
          y: AQdata.map(e => e.value),
          name: location,
          type: 'scatter',
          mode: 'lines',
          line: {color: '#17BECF'}
        };

        this.traces.push(myTrace);
        console.log('downloaded data for ', location);
      }

    },


  },

  computed: {

    parameters() {
      if (this.locations.length > 0) {
        return [...new Set(this.locations.map(e => e.parameters).reduce((a,b) => [...a, ...b]))];
      } else {
        return ['pm25'];
      }
    },

    layout() {

      return {
        xaxis: {
          title: 'Date / Time',
        },

        yaxis: {
          title: this.parameter,
         },

        font: {
          family: 'Open Sans',
          size: 18,
          color: '#7f7f7f'
        },

        showlegend: false,

      };
    },

    backgroundTrace() {

      let allTrace = {};

      if (this.traces.length > 0) {
        for (let trace of this.traces) {

          // calculate standard deviation of traces
          let times = trace.x;
          let vals = trace.y;

          for (let i = 0; i < times.length; i++) {
            let t = times[i];
            let y = vals[i];

            if (Object.keys(allTrace).includes(t)) {
              allTrace[t].push(y);
            } else {
              allTrace[t] = [y];
            }
          }
        }

        let times = Object.keys(allTrace).sort((a,b) => new Date(b) - new Date(a));
        let x = [];
        let y_low = [];
        let y_high = [];

        for (let t of times) {

          let n = allTrace[t].length;
          let mean = allTrace[t].reduce((a,b) => a + b)/n ;

          let variance = allTrace[t].map(e => e - mean).map(e => e*e).reduce((a,b) => a + b);
          let stddev = Math.sqrt(variance);
          let stderr = stddev/Math.sqrt(n);

          if (stderr > 0) {
            x.push(t);
            y_low.push(Math.max(mean - 1.96 * stderr,0));
            y_high.push(Math.max(mean + 1.96 * stderr,0));
          }
        }


        return [
          {
            x: x,
            y: y_high,
            name: 'Upper Bound',
            type: 'scatter',
            mode: 'lines',
            line: {color: "transparent"}
          },
          {
            x: x,
            y: y_low,
            name: 'Lower Bound',
            type: 'scatter',
            mode: 'lines',
            fill: "tonexty",
            fillcolor: "rgba(68, 68, 68, 0.3)",
            line: {color: "transparent"}
          },

        ];


      } else {
        return []
      }
    }
  },

  watch: {

  },

  mounted() {
    this.date = new Date();
    this.startDate = new Date(this.date - 7*24*60*60*1000).toISOString()
    this.loadData('https://api.openaq.org/v1/countries?limit=10000', this.loadCountries);
  },

  data: {
    date: NaN,
    startData: NaN,
    countries: [],
    country: '',
    cities: [],
    city: '',
    locations: [],
    location: '',
    parameter: 'pm25',
    traces: []
  }

});
