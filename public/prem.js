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

const runQuery = async(dateFromInput, dateToInput, platformSelect) => {
    if (!dateFromInput.value || dateFromInput.value === '') throw new Error('Fecha de inicio invalida.')
    if (!dateToInput.value || dateToInput.value === '') throw new Error('Fecha de fin invalida.');
    if (!platformSelect.value || platformSelect.value === '') throw new Error('Plataforma invalida.');
    
    const queryParams = {
        dateFrom: dateFromInput.value,
        dateTo: dateToInput.value, 
        platform: platformSelect.value
    };

    const queryString = new URLSearchParams(queryParams).toString();
    const url = '/data/query';
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



domReady(() => {
    const querierBtn = document.querySelector("#querier-btn");
    const dateFromInput = document.querySelector("#date-from");
    const dateToInput = document.querySelector("#date-to");
    const platformSelect = document.querySelector("#platform");
    querierBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            querierBtn.setAttribute('disabled', 'disabled');
            querierBtn.innerHTML = "Consultando...";
            const data = await runQuery(dateFromInput, dateToInput, platformSelect);
            await drawSelector(await data.json());
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

const drawSelector = async(data) => {
    const selectElement = document.querySelector("#switcher-trigger");
    if (selectElement) {
        document.querySelector("#switcher-trigger").remove();
    }
    let selectorHTML = `<select id='switcher-trigger' class='form-control'>`;
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

const drawMax = async(text, platform, id, dateIdx, data, image) => {
    let maxHTML = `
        <div class="col" id='${id}'>
            <div class="feature d-flex flex-column">
                <div class="d-inline-flex align-items-center justify-content-center fs-2 mb-3">
                    <img src="/images/${image}" width="50" height="50"/>
                </div>
                <h4>${text}<br/><span class="aclaracion">24hs</span></h4>
                <h3>${data[dateIdx][0] || data[dateIdx].channel}</h3>
                <h2>
                    ${data[dateIdx][1] || data[dateIdx].value}
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
    console.log(csvContent);
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
                    daysHTML += `<td>${splitDate(i)}</td>`;

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

    if (eventData.data.maxDay) {
        await drawMax('M&aacute;x. del d&iacute;a', platformKey, 'max-day', eventData.dateIdx, eventData.data.maxDay, 'maxDia.svg');
    }

    if (eventData.data.maxMorning) {
        await drawMax('M&aacute;x. de la ma&ntilde;ana', platformKey, 'max-morning', eventData.dateIdx, eventData.data.maxMorning, 'maxManiana.svg');
    }

    if (eventData.data.maxMidday) {
        await drawMax('M&aacute;x. del mediod&iacute;a', platformKey, 'max-midday', eventData.dateIdx, eventData.data.maxMidday, 'maxMediodia.svg');
    }

    if (eventData.data.maxAfternoon) {
        await drawMax('M&aacute;x. de la tarde', platformKey, 'max-afternoon', eventData.dateIdx, eventData.data.maxAfternoon, 'maxTarde.svg');
    }

    if (eventData.data.maxNight) {
        await drawMax('M&aacute;x. de la noche', platformKey, 'max-night', eventData.dateIdx, eventData.data.maxNight, 'maxNoche.svg');
    }

    if (eventData.data.daysGrouped) {
       if (platformKey === 'all') platformKey = 'totals';
       await drawDays(platformKey, eventData.dateIdx, eventData.data.daysGrouped);
    }
}