(function() {
  "use strict";

  var propMap = {};
  var viorefs_ids = [];
  var viorefs_labels = [];
  var sparkdata = {};
  var chartdata = {};
  var allGroups = [];

  var chart = document.getElementById('chart');
  var sparklines_outer = document.getElementById('sparklines-outer');
  var sparklines = document.getElementById('sparklines');
  var chartHeader = document.getElementById('chart-header');
  var vioLink = document.getElementById('chart-violink');
  var propLink = document.getElementById('chart-proplink');
  var status = document.getElementById('status');
  var groups = document.getElementById('groups');

  function showChart() {
    /* jshint -W040 */
    var chartData = this.chartData;
    chart.style.display = '';
    sparklines_outer.style.display = 'none';

    var headerText;
    if (chartData.vioname == 'Items count') {
      headerText = chartData.vioname + ' for ' + chartData.prop;
    } else {
      headerText = '"' + chartData.vioname + '" violations for ' + chartData.prop;
    }
    if (chartData.prop in propMap) {
      headerText += ' (' + propMap[chartData.prop].name + ')';
    }

    chartHeader.textContent = headerText;
    propLink.setAttribute('href', getPropLink(chartData.prop));
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
    sparklines_outer.style.display = '';
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

  function getPropLink(prop) {
    var prefix = 'https://www.wikidata.org/wiki/Property_talk:';
    return prefix + prop;
  }

  function formatNum(num) {
    if (num > 1000000) {
      num = Math.floor(num / 1000000) + 'kk';
    } else if (num > 1000) {
      num = Math.floor(num / 1000) + 'k';
    }

    return num;
  }

  function formatArray(arr) {
    var last = arr[arr.length - 1];
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
      num.textContent = formatNum(data);
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
    ctx.translate(0.5, 0.5);

    ctx.font = "8px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillText(formatArray(data), 25, 1);

    ctx.beginPath();

    var fitheight = height - 1;

    if (minval == maxval) {
      ctx.moveTo(0, fitheight / 2 - 0.5);
      ctx.lineTo(width, fitheight / 2 - 0.5);
    } else {
      var norm = fitheight / (maxval - minval);
      ctx.moveTo(0, Math.round(fitheight - (data[0] - minval) * norm));
      var step = width / (data.length - 1);
      for (var i = 1; i < data.length; i++) {
        ctx.lineTo(i * step, Math.round(fitheight - (data[i] - minval) * norm));
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

  function genHeader(visible_columns_names) {
    var header = document.createElement('tr');

    var el;

    el = document.createElement('th');
    el.textContent = 'Property';
    header.appendChild(el);

    el = document.createElement('th');
    el.textContent = 'Name';
    header.appendChild(el);

    for (var id = 0; id < visible_columns_names.length; id++) {
      var colname = visible_columns_names[id];
      el = document.createElement('th');
      el.textContent = colname;
      header.appendChild(el);
    }
    return header;
  }

  function genTable(group) {
    if (!group.match(/^[A-Za-z]+$/)) {
      return;
    }

    var $el = $("*[data-group='" + group + "']");
    $el.addClass('pure-menu-selected').siblings().removeClass('pure-menu-selected');

    var el;

    var table = document.createElement('table');
    table.setAttribute("id", "violations");

    var linenum = 0;

    var visible_rows = [];
    var visible_columns = new Array(viorefs_ids.length);

    for (var prop in sparkdata) {
      if (sparkdata.hasOwnProperty(prop) && prop in propMap && propMap[prop].group == group) {
        var violations = sparkdata[prop];
        for (var i = 0; i < violations.length; i++) {
          if (violations[i] !== undefined) {
            visible_columns[i] = true;
          }
        }
        visible_rows.push({
          prop_id: prop,
          violations: violations,
        });
      }
    }

    var visible_columns_names = [];
    for (var i = 0; i < visible_columns.length; i++) {
      if (visible_columns[i]) {
        visible_columns_names.push(viorefs_labels[i]);
      }
    }

    for (var i = 0; i < visible_rows.length; i++) {
      var prop = visible_rows[i].prop_id;
      var violations = visible_rows[i].violations;

      if (i % 25 === 0) {
        table.appendChild(genHeader(visible_columns_names));
      }

      var row = document.createElement('tr');
      table.appendChild(row);

      el = document.createElement('th');
      el.textContent = prop;
      row.appendChild(el);

      el = document.createElement('td');
      el.textContent = propMap[prop] && propMap[prop].name || "";
      el.setAttribute('class', 'propname');
      row.appendChild(el);

      var total_count = 0;
      var total_delta = 0;
      if (violations[0]) {
        if (typeof(violations[0]) === 'number') {
          total_count = violations[0];
          total_delta = 0;
        } else {
          total_count = violations[0][violations[0].length - 1];
          total_delta = Math.max(violations[0][violations[0].length - 1] - violations[0][0], 0);
        }
      }

      for (var j = 0; j < visible_columns.length; j++) {
        if (!visible_columns[j]) {
          continue;
        }

        var cell = document.createElement('td');
        var sparkpoints = violations[j];

        if (sparkpoints !== undefined) {
          if (j !== 0) {
            var danger = 0;
            if (typeof(sparkpoints) === 'number') {
              if (sparkpoints) {
                var lastPoint = sparkpoints;
                var k2 = Math.min(Math.max(lastPoint / total_count / 0.9, 0), 1);
                var k3 = Math.min(Math.max(Math.log10(lastPoint) / 3 - 0.5, 0), 1);
                danger = (k2 + k3) / 2;
              }
            } else if (j !== 0) {
              var lastPoint = sparkpoints[sparkpoints.length - 1];
              if (lastPoint) {
                var firstPoint = sparkpoints[0];
                var k2 = Math.min(Math.max(lastPoint / total_count / 0.9, 0), 1);
                var k3 = Math.min(Math.max(Math.log10(lastPoint) / 3 - 0.5, 0), 1);
                danger = 0.4 * k2 + 0.6 * k3;
              }
            }

            cell.setAttribute('style', 'background-color: hsl(' + (120 * (1 - danger)) + ', 75%, 75%);');
          }

          cell.appendChild(drawSparkline(sparkpoints));
          cell.chartData = {
            data: chartdata[prop][j],
            prop: prop,
            vioname: viorefs_labels[j],
          };
          cell.chartProp = chartdata[prop][j];
          cell.addEventListener('click', showChart);
        }

        row.appendChild(cell);
      }

    }

    while (sparklines.firstChild) {
      sparklines.removeChild(sparklines.firstChild);
    }

    sparklines.appendChild(table);
  }

  function allSame(arr) {
    for (var i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[0]) {
        return false;
      }
    }
    return true;
  }

  function processData(data) {
    setStatus('Parsing fetched content...');

    var per_day_data = [];
    viorefs_ids = parseVioNames(data.query.pages[0].revisions[0].content);

    viorefs_labels = viorefs_ids.map(function(name) {
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

    var violations, name_index, name, prop;
    var day_data, ts;
    var val;

    day_data = per_day_data[0].data;
    ts = per_day_data[0].timestamp;
    for (prop in day_data) {
      if (day_data.hasOwnProperty(prop)) {
        violations = day_data[prop];
        sparkdata[prop] = new Array(viorefs_ids.length);
        chartdata[prop] = new Array(viorefs_ids.length);

        for (name_index = 0; name_index < viorefs_ids.length; name_index++) {
          name = viorefs_ids[name_index];
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
          for (name_index = 0; name_index < viorefs_ids.length; name_index++) {
            name = viorefs_ids[name_index];
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

    genTable(location.hash.slice(1) || allGroups[0][0]);

    setStatus(null);
  }

  function loadChartData() {
    setStatus('Loading chart data...');

    $.ajax({
      url: 'https://www.wikidata.org/w/api.php',
      jsonpCallback: 'chart_data_fetched',
      dataType: 'jsonp',
      cache: true,
      data: {
        "action": "query",
        "prop": "revisions",
        "titles": "Wikidata:Database reports/Constraint violations/Summary",
        "rvprop": "content|timestamp",
        "rvlimit": 50,
        "format": "json",
        "formatversion": 2,
        "maxage": 10 * 60
      }
    }).then(processData);
  }

  function loadPropertyList() {
    setStatus('Loading property list...');

    var allGroupsMap = {};

    $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql', {
      query: 'SELECT * { ?p rdf:type wikibase:Property ; rdfs:label ?l ; wikibase:propertyType ?g. FILTER(LANG(?l) = "en")}',
      format: 'json'
    }).then(function(data) {
      data.results.bindings.forEach(function(item) {
        var prop_id = item.p.value.match(/P\d+/);
        var prop_group = item.g.value.match(/#(.+)/)[1];
        var prop_name = item.l.value;

        allGroupsMap[prop_group] = (allGroupsMap[prop_group] || 0) + 1;

        propMap[prop_id] = {
          group: prop_group,
          name: prop_name
        };
      });

      allGroups = Object.keys(allGroupsMap).map(function(key) {
        return [key, allGroupsMap[key]];
      });

      allGroups.sort(function(first, second) {
        return second[1] - first[1];
      });

      for (var i = 0; i < allGroups.length; i++) {
        var group_text = allGroups[i][0] + ' (' + allGroups[i][1] + ')';
        var $link = $('<a class="pure-menu-link" />')
          .attr("href", "#" + allGroups[i][0])
          .text(group_text);

        var $list_item = $('<li class="pure-menu-item" />').append($link)
          .attr('data-group', allGroups[i][0]);
        $(groups).append($list_item);
      }

      loadChartData();
    });
  }

  loadPropertyList();

  $(window).on('hashchange', function() {
    var group = location.hash.slice(1) || "ExternalId";
    genTable(group);
  });
})();


(function() {
  var layout = $('#layout'),
    menu = $('#menu'),
    menuLink = $('#menuLink'),
    content = $('#main');

  function toggleAll(e) {
    e.preventDefault();
    layout.toggleClass('active');
    menu.toggleClass('active');
    menuLink.toggleClass('active');
  }

  menuLink.click(function(e) {
    toggleAll(e);
  });

  content.click(function(e) {
    if (menu.hasClass('active')) {
      toggleAll(e);
    }
  });
}());
