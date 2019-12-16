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
        .filter(e => Math.abs(new Date(e.lastUpdated) - this.date) < 14*24*60*60*1000)
        .sort((a,b) => a.location > b.location);

    },

    requestCityData() {
      this.loadData('https://api.openaq.org/v1/cities?limit=10000&country=' + this.country.code, this.loadCities);
    },

    requestLocationData() {
      this.loadData('https://api.openaq.org/v1/locations?limit=10000&country=' + this.country.code + '&city=' + this.city.name, this.loadLocations);
    },

    requestAQData(location) {

      if (this.selectedLocations.includes(location)) {

        this.loadData('https://api.openaq.org/v1/measurements?limit=10000&country=' + this.country.code + '&city=' + this.city.name + '&location=' + location.location + '&parameter=pm25&date_from=' + this.startDate, this.getAQData);
        for (let p of location.parameters) {
          if (!this.parameters.includes(p)) {
            this.parameters.push(p);
          }
        }

      } else {

        // remove trace for this location
        this.traces = this.traces.filter(e => e.name !== location.location);
        console.log(location.location, ' removed from trace');

      }

    },

    reloadData(parameter) {

      console.log('reloading data for ', parameter);

      this.traces = [];

      let locations = this.selectedLocations.map(e => e.location);
      for (let loc of locations) {
        this.loadData('https://api.openaq.org/v1/measurements?limit=10000&country=' + this.country.code + '&city=' + this.city.name + '&location=' + loc + '&parameter=' + parameter + '&date_from=' + this.startDate, this.getAQData);
      }

    },

    getAQData(data) {

      this.AQdata = JSON.parse(data).results
        .filter(e => e.value >= 0);

      if (this.AQdata.length > 0) {

        let location = this.AQdata[0].location;
        let myTrace = {
          x: this.AQdata.map(e => e.date.local),
          y: this.AQdata.map(e => e.value),
          name: location,
          type: 'scatter',
          mode: 'points',
        };

        this.traces.push(myTrace);

      }

    },


  },

  computed: {
    parameters() {
      return [...new Set(this.selectedLocations.map(e => e.parameters).reduce((a,b) => [...a, ...b]))];
    },

    layout() {

      return {
        xaxis: {
          title: 'Date / Time',
        },

        yaxis: {
          title: this.AQdata[0].parameter,
         },

        font: {
          family: 'Open Sans',
          size: 18,
          color: '#7f7f7f'
        },

        showlegend: false,

      };
    }
  },

  watch: {

    selectedLocations: function() {

    }

  },

  mounted() {
    this.date = new Date();
    this.startDate = new Date(this.date - 14*24*60*60*1000).toISOString()
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
    AQdata: [],
    traces: [],
    selectedLocations: []
  }

});
