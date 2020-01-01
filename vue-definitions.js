// custom graph component
Vue.component('graph', {

  props: ['traces', 'layout', 'smoothing'],

  template: '<div ref="graph" class="graph" style="height: 600px;"></div>',

  methods: {

    makeGraph() {

      if (this.traces) {

        if (this.smoothing) {

          let smoothedTraces = [];

          for (let trace of this.traces) {
            smoothedTraces.push({
              x: trace.x,
              y: this.smooth(trace.y),
              name: trace.name,
              type: trace.type,
              mode: trace.mode,
              fill: trace.fill,
              fillcolor: trace.fillcolor,
              line: trace.line
            });
          }

          if (this.layout) {
            Plotly.newPlot(this.$refs.graph, smoothedTraces, this.layout);
          } else {
            Plotly.newPlot(this.$refs.graph, smoothedTraces);
          }

        } else {
          if (this.layout) {
            Plotly.newPlot(this.$refs.graph, this.traces, this.layout);
          } else {
            Plotly.newPlot(this.$refs.graph, this.traces);
          }
        }

      }

    },

    smooth(arr) {
      let y = arr[0];
      let smoothedArr = [];

      for (let i = 0; i < arr.length; i++) {
        y = (1 - this.smoothing) * arr[i] + this.smoothing * y;
        smoothedArr.push(y)
      }

      return smoothedArr;
    }

  },

  mounted() {
    this.makeGraph();
  },

  watch: {
    traces() {
      this.makeGraph();
    },

    smoothing() {
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
        .filter(e => e.count > 1000)
        .sort((a,b) => a.name > b.name);

    },

    loadCities(data) {

      this.cities = JSON.parse(data).results
        .filter(e => e.name !== undefined)
        .filter(e => e.count > 1000)
        .sort((a,b) => a.name > b.name);

    },

    loadLocations(data) {

      this.locations = JSON.parse(data).results
        .filter(e => e.location !== undefined)
        .filter(e => e.city == this.city.name)
        .filter(e => Math.abs(new Date(e.lastUpdated) - this.date) <= 7 * this.duration)
        .sort((a,b) => a.location > b.location);

      for (let location of this.locations) {
        this.requestAQData(location, 'pm25');
      }

    },

    requestCityData() {

      this.traces = [];

      this.cities = [];
      this.city = '';

      this.locations = [];
      this.location = '';

      this.loadData('https://api.openaq.org/v1/cities?limit=10000&country=' + this.country.code, this.loadCities);
    },

    requestLocationData() {

      this.traces = [];

      this.locations = [];
      this.location = '';

      this.loadData('https://api.openaq.org/v1/locations?limit=10000&country=' + this.country.code + '&city=' + this.city.name, this.loadLocations);
    },

    requestAQData(location, parameter) {

      this.traces = [];

      this.loadData('https://api.openaq.org/v1/measurements?limit=10000&country=' + this.country.code + '&city=' + this.city.name + '&location=' + location.location + '&parameter=' + parameter + '&date_from=' + this.startDate, this.getAQData);

    },

    reloadData(parameter) {

    },

    getAQData(data) {

      let AQdata = JSON.parse(data).results.filter(e => e.value > 0);

      if (AQdata.length > 0) {

        let location = AQdata[0].location;

        this.traces.push({
          x: AQdata.map(e => e.date.local),
          y: AQdata.map(e => e.value),
          name: location,
          type: 'scatter',
          mode: 'lines',
          line: {color: '#17BECF'}
        });

        console.log('downloaded data for ', location);
      }

    },

  },

  computed: {

    parameters() {

      if (this.location !== '') {
        return this.location.parameters;
      } else {
        return [];
      }
    },


    layout() {

      // air quality graph layout
      return {
        xaxis: {
          title: 'Date',
          rangeselector: {
            buttons: [
              {
                count: 7,
                label: 'previous week',
                step: 'day',
                stepmode: 'backward'
              },
              {
                count: 1,
                label: 'previous day',
                step: 'day',
                stepmode: 'backward'
              }
              ]
            }
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

    // creates all the traces other than the primary trace
    // such as the confidence interval, and the WHO limit

    backgroundTraces() {

      // here we combine all data for the chosen parameter & location
      // and use it to calculate a 95% confidence interval
      // which we will use as a grey background in the graph

      let allTrace = {};

      if (this.traces.length > 0) {
        for (let trace of this.traces) {

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
        let n_arr = [];
        let y_low = [];
        let y_high = [];

        for (let t of times) {

          let n = allTrace[t].length;
          let mean = allTrace[t].reduce((a,b) => a + b)/n ;

          let variance = allTrace[t].map(e => e - mean).map(e => e*e).reduce((a,b) => a + b);
          let stddev = Math.sqrt(variance);
          let stderr = stddev/Math.sqrt(n);

          n_arr.push(n);
          x.push(t);
          y_low.push(Math.max(mean - 1.96 * stderr,0));
          y_high.push(Math.max(mean + 1.96 * stderr,0));

        }


        return [
          // WHO limit
          {
            x: x,
            y: this.parameter == 'pm25' ? x.map(e => 25) : [],
            type: "scatter",
            mode: "lines",
            fill: "tozeroy",
            name: "WHO PM 2.5 daily average guideline",
            fillcolor: "rgba(50, 170, 50, 0.3)",
            line: {color: "transparent"},
            hoverinfo: 'none'
          },

          // upper limit of 95% confidence interval
          {
            x: x.filter((e,i) => n_arr[i] > 1),
            y: y_high.filter((e,i) => n_arr[i] > 1),
            name: 'Upper Bound',
            type: 'scatter',
            mode: 'lines',
            line: {color: "transparent"}
          },

          // lower limit of 95% confidence interval
          {
            x: x.filter((e,i) => n_arr[i] > 1),
            y: y_low.filter((e,i) => n_arr[i] > 1),
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
    },

    currentTraces() {
      return this.traces.filter(e => e.name == this.location.location);
    },

    timeTrace() {
      if (this.currentTraces.length > 0) {

        let trace = this.currentTraces[0];

        let x = [];
        let y = [];

        for (let hour = 0; hour < 24; hour++) {

          let yo = trace.y.filter((e,i) => new Date(trace.x[i]).getHours() == hour);
          let n = yo.length;
          if (n > 0) {
            x.push(hour);
            let avg = yo.reduce((a,b) => a + b)/n;
            y.push(avg);
          }
        }

        return {
          x: x,
          y: y
        }

      }
    }
  },

  watch: {
    parameter() {
      for (let location of this.locations) {
        this.requestAQData(location, this.parameter);
      }
    },

    location() {
      if (this.location !== '') {
        this.parameter = this.location.parameters.includes('pm25') ? 'pm25' : this.location.parameters[0];
      }
    }
  },

  mounted() {
    this.date = new Date();
    this.startDate = new Date(this.date - 7 * this.duration).toISOString()
    this.loadData('https://api.openaq.org/v1/countries?limit=10000', this.loadCountries);
  },

  data: {
    date: NaN,
    startDate: NaN,
    duration: 24*60*60*1000,
    countries: [],
    country: '',
    cities: [],
    city: '',
    locations: [],
    location: '',
    traces: [],
    smoothingOptions: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    smoothing: 0.7,
    parameter: 'pm25',
  }

});
