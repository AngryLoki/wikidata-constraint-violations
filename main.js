(function() {
  "use strict";

  var chart = document.getElementById('chart');
  var sparlines = document.getElementById('sparlines');
  var chartHeader = document.getElementById('chart-header');
  var vioLink = document.getElementById('chart-violink');
  var status = document.getElementById('status');

  function showChart() {
    /* jshint -W040 */
    var chartData = this.chartData;
    chart.style.display = '';
    sparlines.style.display = 'none';

    var headerText;
    if (chartData.vioname == 'Items count') {
      headerText = chartData.vioname + ' for ' + chartData.prop;
    } else {
      headerText = '"' + chartData.vioname + '" violations for ' + chartData.prop;
    }
    if (chartData.prop in propMap) {
      headerText += ' (' + propMap[chartData.prop] + ')';
    }

    chartHeader.textContent = headerText;
    vioLink.setAttribute('href', getVioLink(chartData.prop, chartData.vioname));

    $.plot("#chart-placeholder", [chartData.data], {
      xaxis: {
        mode: "time",
        tickSize: [1, "day"]
      },
      yaxis: {
        minTickSize: 1,
        tickDecimals: 0
      }
    });
  }

  document.getElementById('close').addEventListener('click', function() {
    chart.style.display = 'none';
    sparlines.style.display = '';
  });

  var last_benchmark_time = Date.now();
  var last_status;

  function setStatus(msg) {
    var new_time = Date.now();

    if (last_status) {
      console.log(last_status, 'took', new_time - last_benchmark_time, 'ms');
    }
    last_status = msg;
    last_benchmark_time = new_time;

    if (!msg) {
      status.style.display = 'none';
    } else {
      status.innerHTML = msg;
    }
  }

  function getVioLink(prop, vioname) {
    var section = '"' + vioname + '" violations';
    var prefix = 'https://www.wikidata.org/wiki/Wikidata:Database_reports/Constraint_violations/';
    if (vioname === 'Items count') {
      return prefix + prop;
    }
    var hash = encodeURIComponent(section.replace(/ /g, '_')).replace(/%/g, '.');
    return prefix + prop + '#' + hash;
  }

  function formatNum(arr) {
    var last = arr[arr.length - 1];
    var r = last.toString();
    var delta = last - arr[0];
    var sign = (delta > 0) && '+' || '';

    if (last > 1000000) {
      last = Math.floor(last / 1000000) + 'kk';
    } else if (last > 1000) {
      last = Math.floor(last / 1000) + 'k';
    }

    if (delta === 0) {
      return last;
    }

    if (delta > 1000) {
      delta = Math.floor(delta / 1000) + 'k';
    }

    return last + ' (' + sign + delta + ')';
  }

  function drawSparkline(data) {
    var el, num;

    if (typeof(data) === "number") {
      el = document.createElement('div');
      el.setAttribute('class', 'midline');

      num = document.createElement('div');
      num.setAttribute('class', 'num');
      num.textContent = data;
      el.appendChild(num);

      return el;
    }

    var maxval = Math.max.apply(Math, data);
    var minval = Math.min.apply(Math, data);

    if (minval == maxval) {
      el = document.createElement('div');
      el.setAttribute('class', 'midline');

      num = document.createElement('div');
      num.setAttribute('class', 'num');
      num.textContent = maxval;
      el.appendChild(num);

      return el;
    }

    var canvas = document.createElement('canvas');
    var width = 50;
    var height = 20;
    canvas.width = width;
    canvas.height = height;

    var ctx = canvas.getContext('2d');

    ctx.font = "8px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillText(formatNum(data), 25, 2);

    ctx.beginPath();

    if (minval == maxval) {
      ctx.moveTo(0, height / 2 - 0.5);
      ctx.lineTo(width, height / 2 - 0.5);
    } else {
      var norm = height / (maxval - minval);
      ctx.moveTo(0, height - (data[0] - minval) * norm);
      var step = width / (data.length - 1);
      for (var i = 1; i < data.length; i++) {
        ctx.lineTo(i * step, height - (data[i] - minval) * norm);
      }
    }

    ctx.stroke();
    return canvas;
  }

  function parseVioNames(content) {
    return content.match(/!![^!\n]+/g).map(function(x) {
      return x.slice(2).trim();
    });
  }

  function parseContent(content) {
    var sparkdata = {};
    var vionames = parseVioNames(content);
    var lines = content.match(/\n\| [^\n]+/g);

    for (var i = 0; i < lines.length; i++) {
      var cells = lines[i].slice(2).split("||");
      var pid = cells[0].match(/P\d+/);
      sparkdata[pid] = {};
      for (var j = 1; j < cells.length; j++) {
        var cellData = cells[j].trim();
        if (cellData) {
          sparkdata[pid][vionames[j - 1]] = parseInt(cellData, 10);
        }
      }
    }

    return sparkdata;
  }

  function genHeader(display_viorefs) {
    var header = document.createElement('tr');

    var el;
    el = document.createElement('th');
    el.textContent = 'Property';
    header.appendChild(el);

    for (var id = 0; id < display_viorefs.length; id++) {
      var colname = display_viorefs[id];
      el = document.createElement('th');
      el.textContent = colname;
      header.appendChild(el);
    }
    return header;
  }

  function genTable(viorefs, sparkdata, chartdata) {
    var el;

    var table = document.createElement('table');
    table.setAttribute("id", "violations");

    var linenum = 0;

    for (var prop in sparkdata) {
      if (linenum % 20 === 0) {
        table.appendChild(genHeader(viorefs));
      }
      linenum++;

      if (sparkdata.hasOwnProperty(prop)) {
        var violations = sparkdata[prop];

        var row = document.createElement('tr');
        table.appendChild(row);

        el = document.createElement('th');
        el.textContent = prop;
        row.appendChild(el);

        for (var i = 0; i < violations.length; i++) {
          var cell = document.createElement('td');
          var sparkpoints = violations[i];

          if (sparkpoints !== undefined) {
            if (i !== 0 && typeof(sparkpoints) === 'number') {
              if (sparkpoints === 0) {
                cell.setAttribute('class', 'ok');
              } else {
                cell.setAttribute('class', 'meh');
              }
            } else if (i !== 0) {
              var maxval = Math.max.apply(Math, sparkpoints);
              var lastPoint = sparkpoints[sparkpoints.length - 1];
              if (lastPoint === 0) {
                cell.setAttribute('class', 'ok');
              } else if (sparkpoints[0] == lastPoint || maxval > lastPoint) {
                cell.setAttribute('class', 'meh');
              } else {
                cell.setAttribute('class', 'bad');
              }
            }

            cell.appendChild(drawSparkline(sparkpoints));
            cell.chartData = {
              data: chartdata[prop][i],
              prop: prop,
              vioname: viorefs[i],
            };
            cell.chartProp = chartdata[prop][i];
            cell.addEventListener('click', showChart);
          }

          row.appendChild(cell);
        }
      }
    }
    document.getElementById('sparlines').appendChild(table);
  }

  function allSame(arr) {
    for (var i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[0]) {
        return false;
      }
    }
    return true;
  }

  setStatus('Loading chart data...');

  function processData(data) {
    setStatus('Parsing fetched content...');

    var per_day_data = [];
    var viorefs = parseVioNames(data.query.pages[0].revisions[0].content);

    var display_viorefs = viorefs.map(function(name) {
      var match = name.match(/"(.+)"/);
      var colname = match && match[1] || name;
      return colname;
    });

    data.query.pages[0].revisions.forEach(function(revision) {
      var content = revision.content;
      per_day_data.push({
        timestamp: new Date(revision.timestamp).getTime(),
        data: parseContent(content)
      });
    });

    setStatus("Generating table...");

    var sparkdata = {};
    var chartdata = {};

    var violations, name_index, name, prop;
    var day_data, ts;
    var val;

    day_data = per_day_data[0].data;
    ts = per_day_data[0].timestamp;
    for (prop in day_data) {
      if (day_data.hasOwnProperty(prop)) {
        violations = day_data[prop];
        sparkdata[prop] = new Array(viorefs.length);
        chartdata[prop] = new Array(viorefs.length);

        for (name_index = 0; name_index < viorefs.length; name_index++) {
          name = viorefs[name_index];
          if (name in violations) {
            val = violations[name];
            chartdata[prop][name_index] = [ts, val];
            sparkdata[prop][name_index] = [val];
          }
        }
      }
    }

    for (var i = 1; i < per_day_data.length; i++) {
      ts = per_day_data[i].timestamp;
      day_data = per_day_data[i].data;

      for (prop in sparkdata) {
        if (sparkdata.hasOwnProperty(prop)) {
          violations = sparkdata[prop];
          for (name_index = 0; name_index < viorefs.length; name_index++) {
            name = viorefs[name_index];
            if (name_index in sparkdata[prop]) {
              if (prop in day_data && name in day_data[prop]) {
                val = day_data[prop][name];
              } else {
                val = 0;
              }
              chartdata[prop][name_index].unshift([ts, val]);
              sparkdata[prop][name_index].unshift(val);
            }
          }
        }
      }
    }

    for (prop in sparkdata) {
      if (sparkdata.hasOwnProperty(prop)) {
        violations = sparkdata[prop];
        for (var index = 0; index < violations.length; index++) {
          var sparkpoints = violations[index];
          if (!sparkpoints) {
            continue;
          }

          var last = sparkpoints[sparkpoints.length - 1];
          if (allSame(sparkpoints)) {
            if (last === 0) {
              violations[index] = 0;
            } else {
              violations[index] = last;
            }
          }
        }
      }
    }

    setStatus("Generating charts...");

    genTable(display_viorefs, sparkdata, chartdata);

    setStatus(null);
  }

  $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
    "action": "query",
    "prop": "revisions",
    "titles": "Wikidata:Database reports/Constraint violations/Summary",
    "rvprop": "content|timestamp",
    "rvlimit": 50,
    "format": "json",
    "formatversion": 2
  }).then(processData);

  var propMap = {};

  $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql', {
    query: 'SELECT * { ?p rdf:type wikibase:Property ; rdfs:label ?l. FILTER(LANG(?l) = "en")}',
    format: 'json'
  }).then(function(data) {
    data.results.bindings.forEach(function(item) {
      var key = item.p.value.match(/P\d+/);
      var value = item.l.value;
      propMap[key] = value;
    });
  });

})();
