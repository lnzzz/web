function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + '=')) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }
    return null;
}

const token = getCookie('webAppToken');

const domReady = (callBack) => {
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', callBack);
    }
    else {
        callBack();
    }
}

const successToast = new bootstrap.Toast(document.getElementById('toast-success'));
const errorToast = new bootstrap.Toast(document.getElementById('toast-error'));

const runQuery = async(dateFromInput, dateToInput, platformSelect, opTypeSelect) => {
    if (!dateFromInput.value || dateFromInput.value === '') throw new Error('Fecha de inicio invalida.')
    if (!dateToInput.value || dateToInput.value === '') throw new Error('Fecha de fin invalida.');
    if (!platformSelect.value || platformSelect.value === '') throw new Error('Plataforma invalida.');
    if (!opTypeSelect.value || opTypeSelect.value === '') throw new Error('Tipo de operación invalido.');
    
    const queryParams = {
        dateFrom: dateFromInput.value,
        dateTo: dateToInput.value, 
        platform: platformSelect.value
    };

    const queryString = new URLSearchParams(queryParams).toString();

    let url;
    if (opTypeSelect.value === 'full_data') {
        url = '/data/query';
    }
    if (opTypeSelect.value === 'accum_channel') {
        url = '/data/accum-channel'
    }
    const fullUrl = `${url}?${queryString}`;
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }
    try {
        const data = await fetch(fullUrl, options);
        return data;
    } catch (err) {
        console.log(err.message);
        throw new Error('Ha ocurrido un error obteniendo los datos.');
    }
}

function adjustDate(date) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() - 3);
    return newDate.getHours();
}



domReady(() => {
    const querierBtn = document.querySelector("#querier-btn");
    const dateFromInput = document.querySelector("#date-from");
    const dateToInput = document.querySelector("#date-to");
    const platformSelect = document.querySelector("#platform");
    const opTypeSelect = document.querySelector("#data-type");
    querierBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            querierBtn.setAttribute('disabled', 'disabled');
            querierBtn.innerHTML = "Consultando...";
            const data = await runQuery(dateFromInput, dateToInput, platformSelect, opTypeSelect);
            if (opTypeSelect.value === 'full_data') {
                await drawSelector(await data.json());
            }

            if (opTypeSelect.value === 'accum_channel') {
                await resetSwitcher();
                await resetMaxes([
                    'max-day', 
                    'max-morning', 
                    'max-midday', 
                    'max-afternoon', 
                    'max-night'
                ]);
                await resetStats();
                await drawAccumulated(await data.json());
            }
            querierBtn.removeAttribute('disabled');
            querierBtn.innerHTML = "Consultar";
        } catch (error) {
            document.getElementById('toast-body-content-error').innerHTML = error.message;
            errorToast.show();
            querierBtn.removeAttribute('disabled');
            querierBtn.innerHTML = "Consultar";
            return false;
        }
    });

    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, { html: true }));
});

const drawAccumulated = async (data) => {
    let accumHTML = `<div class="mt-3 mb-3">
        <button class='btn btn-success' onClick="downloadCSV('stats-table', 'table_data_accumulated.csv');">Descargar como CSV</button>
        <button class='btn btn-success' onClick="downloadExcel('stats-table', 'table_data_accumulated.xlsx');">Descargar como Excel</button>
    </div>` 
    accumHTML += `<table id='stats-table' class='table'>`;
    accumHTML += `<thead><th>Canal</th><th>Acumulado</th></thead>
    `;
    accumHTML += `<tbody>`;
    for (let i in data) {
        accumHTML += `<tr>`;
        accumHTML += `<td>${data[i][0]}</td>`;
        accumHTML += `<td>${data[i][1]}</td>`;
        accumHTML += `</tr>`;
    }
    accumHTML += `</tbody>`;
    accumHTML += `</table>`;
    document.querySelector("#day-query").innerHTML = accumHTML;
}

const drawSelector = async(data) => {
    await resetSwitcher();
    let selectorHTML = `<select id='switcher-trigger' class='form-select'>`;
    for (const i in data.maxDay) {
        selectorHTML += `<option value="${i}">${i}</option>`;
    }
    selectorHTML += `</select>`;
    document.querySelector("#switcher-controls").innerHTML = selectorHTML;
    const switcher = document.querySelector("#switcher-trigger");
    switcher.addEventListener('change', () => {
        const dispatchData = {
            dateIdx: switcher.value,
            data
        }
        drawData(dispatchData)
    });
    switcher.dispatchEvent(new Event("change"));
}

const resetSwitcher = async() => {
    const selectElement = document.querySelector("#switcher-trigger");
    if (selectElement) {
        document.querySelector("#switcher-trigger").remove();
    }
}

const drawMax = async(text, platform, id, dateIdx, data, image, range) => {
    const maxChannel = (data[dateIdx] && data[dateIdx][0]) ? data[dateIdx][0] : data[dateIdx].channel;
    const maxValue = (data[dateIdx] && data[dateIdx][1]) ? data[dateIdx][1] : data[dateIdx].value;

    let maxHTML = `
        <div class="col" id='${id}'>
            <div class="feature d-flex flex-column">
                <div class="d-inline-flex align-items-center justify-content-center fs-2 mb-3">
                    <img src="/images/${image}" width="50" height="50"/>
                </div>
                <h4>${text}<br/><span class="aclaracion">${range}</span></h4>
                <h3>${maxChannel}</h3>
                <h2>
                    ${maxValue}
                </h2>
                <div class="d-flex mt-auto justify-content-end px-3 pb-3">`
    switch(platform) {
        case 'all':
            maxHTML += `<i class="bi bi-youtube me-2"></i><i class="bi bi-twitch"></i>`;
        break;
        case 'twitch':
            maxHTML += `<i class="bi bi-twitch"></i>`;
        break;
        case 'youtube':
            maxHTML += `<i class="bi bi-youtube me-2"></i>`;
        break;
    }

    maxHTML += `
                </div>
            </div>
        </div>
    `;
    document.querySelector("#sum-query").innerHTML += maxHTML;
}

function getByIndex(index, array, channel) {
    const item = (array[index].find(item => item._id.channel.toLowerCase() === channel.toLowerCase()))
    return (item) ? item.totalViewCount : 0;
}

function splitDate(date) {
    return date.split(" ")[1];
}


function downloadCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tr');
    let csvContent = '';
    rows.forEach((row) => {
        const cells = row.querySelectorAll('th, td');
        const rowData = Array.from(cells)
            .map(cell => cell.textContent.replace(/,/g, '')) // Remove commas from cell content
            .join(',');

        csvContent += rowData + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet1"});
    const wbout = XLSX.write(wb, {bookType: 'xlsx', bookSST: true, type: 'binary'});

    function s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
        return buf;
    }

    const blob = new Blob([s2ab(wbout)], {type: 'application/octet-stream'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
}

const drawDays = async(dataKey, dateIdx, data) => {
    let daysHTML = `<div class="mt-3 mb-3">
        <button class='btn btn-success' onClick="downloadCSV('stats-table', 'table_data_${dateIdx}.csv');">Descargar como CSV</button>
        <button class='btn btn-success' onClick="downloadExcel('stats-table', 'table_data_${dateIdx}.xlsx');">Descargar como Excel</button>
    </div>` 
    daysHTML += `<table id='stats-table' class='table'>`;
        daysHTML += `<thead>`;
            daysHTML += `<th scope="col">Hora</th>`;
        for (let i=0; i<data[dateIdx].channels.length; i++) {
            daysHTML += `<th>
                <div class="my-3 c-icon">
				    <img src="/images/${ data[dateIdx].channels[i] }.svg" width="40" height="40"/>
                </div>
                ${data[dateIdx].channels[i]}
            </th>`;
        }
        daysHTML += `</thead>`;
        daysHTML += `<tbody>`;
            for (const i in data[dateIdx][dataKey]) {
                daysHTML += `<tr>`; 
                    daysHTML += `<td>${adjustDate(i) + ":" + String(new Date(i).getMinutes()).padStart(2, '0')}</td>`;
                    for (let j=0; j<data[dateIdx].channels.length; j++) {
                        daysHTML += `<td>${getByIndex(i, data[dateIdx][dataKey], data[dateIdx].channels[j]) }</td>`
                    }
                daysHTML += `</tr>`;
            }
        daysHTML += `</tbody>`;
    daysHTML += `</table>`;
    document.querySelector("#day-query").innerHTML = daysHTML;
}

const resetMaxes = async(maxesIds) => {
    for (let i=0; i<maxesIds.length; i++) {
        const maxElement = document.querySelector(`#${maxesIds[i]}`);
        if (maxElement) maxElement.remove();
    }
}

const resetStats = async() => {
    document.querySelector("#day-query").innerHTML = "";
}

const drawData = async (eventData) => {
    let platformKey = document.querySelector("#platform").value;

    await resetMaxes([
        'max-day', 
        'max-morning', 
        'max-midday', 
        'max-afternoon', 
        'max-night'
    ]);

    await resetStats();

    if (eventData.data.maxDay && eventData.data.maxDay[eventData.dateIdx]) {
        await drawMax('M&aacute;x. del d&iacute;a', platformKey, 'max-day', eventData.dateIdx, eventData.data.maxDay, 'maxDia.svg', '24 hs');
    }

    if (eventData.data.maxMorning && eventData.data.maxMorning[eventData.dateIdx]) {
        await drawMax('M&aacute;x. de la ma&ntilde;ana', platformKey, 'max-morning', eventData.dateIdx, eventData.data.maxMorning, 'maxManiana.svg', '06:00 a 10:00');
    }

    if (eventData.data.maxMidday && eventData.data.maxMidday[eventData.dateIdx]) {
        await drawMax('M&aacute;x. del mediod&iacute;a', platformKey, 'max-midday', eventData.dateIdx, eventData.data.maxMidday, 'maxMediodia.svg', '10:00 a 14:00');
    }

    if (eventData.data.maxAfternoon && eventData.data.maxAfternoon[eventData.dateIdx]) {
        await drawMax('M&aacute;x. de la tarde', platformKey, 'max-afternoon', eventData.dateIdx, eventData.data.maxAfternoon, 'maxTarde.svg', '14:00 a 18:00');
    }

    if (eventData.data.maxNight && eventData.data.maxNight[eventData.dateIdx]) {
        await drawMax('M&aacute;x. de la noche', platformKey, 'max-night', eventData.dateIdx, eventData.data.maxNight, 'maxNoche.svg', '18:00 a 23:00');
    }

    if (eventData.data.daysGrouped && eventData.data.daysGrouped[eventData.dateIdx]) {
       if (platformKey === 'all') platformKey = 'totals';
       await drawDays(platformKey, eventData.dateIdx, eventData.data.daysGrouped);
    }
}