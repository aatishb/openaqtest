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

    getAQData(data) {
      this.AQdata = JSON.parse(data).results;

      this.trace = {
        x: this.AQdata.map(e => e.date.local),
        y: this.AQdata.map(e => e.value),
        type: 'scatter',
        mode: 'lines',
      };


      this.layout = {

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


    },


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
    parameters: [],
    parameter: '',
    AQdata: [],
    trace: {},
    layout: {}

  }

});
