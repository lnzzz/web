let activeChart;

const apiCalls = {
    day_peaks: {
        uri: "/data/maxes-per-channel-filtered",
        method: "GET"
    },
    hourly_vals: {
        uri: "/data/hourly-values",
        method: "GET"
    }
}

function transformDataToObject(inputObject) {
    var dataArray = [];
    for (var date in inputObject) {
        var values = inputObject[date];
        for (var name in values) {
            var existingIndex = dataArray.findIndex(item => item.name === name);
            if (existingIndex === -1) {
                dataArray.push({ name: name, data: [] });
                existingIndex = dataArray.length - 1;
            }
            dataArray[existingIndex].data.push(values[name]);
        }
    }
    return dataArray;
}

const generatePeakChart = async(dates) => {
    await resetChartContainer();
    const formattedSeries = transformDataToObject(dates);

    var options = {
        series: formattedSeries,
        chart: {
        type: 'line',
        zoom: {
          enabled: true
        },
        height: 500,
        background: '#FFF',
        padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
        }
      },
      dataLabels: {
        enabled: true
      },
      stroke: {
        curve: 'straight'
      },
      title: {
        text: 'Picos del día',
        align: 'left'
      },
      grid: {
        row: {
          colors: ['#f3f3f3', '#fff'],
          opacity: 0.5
        },
      },
      xaxis: {
        categories: Object.keys(dates),
      }
    };

    activeChart = new ApexCharts(document.querySelector("#chart"), options);
    activeChart.render();
}

const generateHourlyChart = async(dates) => {
    await resetChartContainer();
    const sortedKeys = Object.keys(dates).sort((a, b) => new Date(a) - new Date(b));
    sortedKeys.sort();

    const sortedData = {};
    sortedKeys.forEach(date => {
        const key = date;
        sortedData[key] = dates[key];
    });

    const formattedSeries = transformDataToObject(sortedData);
    const datesKeys = Object.keys(dates).sort((a, b) => new Date(a) - new Date(b));
    datesKeys.sort();
    
    var options = {
        series: formattedSeries,
        chart: {
        type: 'line',
        zoom: {
          enabled: true
        },
        height: 500,
        background: '#FFF',
        padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight',
        width: 1
      },
      title: {
        text: 'Viewers cada 5 min',
        align: 'left'
      },
      grid: {
        row: {
          colors: ['#f3f3f3', '#fff'],
          opacity: 0.5
        },
      },
      xaxis: {
        categories: datesKeys,
      }
    };

    activeChart = new ApexCharts(document.querySelector("#chart"), options);
    activeChart.render();
}

const callApi = async(dateFrom, dateTo, platform, chartType, channels) => {
    const joinedChannels = channels.join(',');
    const queryParams = {
        dateFrom,
        dateTo,
        platform,
        channels: joinedChannels
    }

    const queryString = new URLSearchParams(queryParams).toString();

    const url = apiCalls[chartType].uri;
    const method = apiCalls[chartType].method;

    const fullUrl = `${url}?${queryString}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }

    try {
        const data = await fetch(fullUrl, options);
        return data;
    } catch (err) {
        throw new Error('Ha ocurrido un error obteniendo los datos.');
    }
}

domReady(() => {
    const charterBtn = document.querySelector("#charter-btn");
    const dateFromInput = document.querySelector("#charts-date-from");
    const dateToInput = document.querySelector("#charts-date-to");
    const platformSelect = document.querySelector("#charts-platform");
    const chartTypeSelect = document.querySelector("#chart-type");

    charterBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            charterBtn.setAttribute('disabled', 'disabled');
            charterBtn.innerHTML = "Generando...";
            const selectedChannels = document.querySelectorAll('#channels option:checked');
            const selectedChannelValues = Array.from(selectedChannels).map(el => el.value);

            const data = await callApi(
                dateFromInput.value,
                dateToInput.value,
                platformSelect.value,
                chartTypeSelect.value,
                selectedChannelValues
            );

            if (chartTypeSelect.value === 'day_peaks') {
                await generatePeakChart(await data.json());
            } else if (chartTypeSelect.value === 'hourly_vals') {
                await generateHourlyChart(await data.json());
            }
            charterBtn.removeAttribute('disabled');
            charterBtn.innerHTML = "Generar Gráfico";
        } catch (error) {
            document.getElementById('toast-body-content-error').innerHTML = error.message;
            errorToast.show();
            charterBtn.removeAttribute('disabled');
            charterBtn.innerHTML = "Generar Gráfico";
            return false;
        }
    });

});