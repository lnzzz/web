const resetChartContainer = async () => {
   if (activeChart) {
    activeChart.destroy();
    activeChart = null;
   }
}

function display(which) {
    resetChartContainer();   
    document.querySelectorAll("div.tbl").forEach((el) => { el.classList.add('d-none'); });
    document.querySelectorAll("div.stats").forEach((el) => { el.classList.add('d-none') });
    document.querySelectorAll("a.nav-link").forEach((el) => { el.classList.remove("active") });

    document.querySelector(`#${which}-btn`).classList.add("active");
    if (which !== 'reports') {
        document.querySelector(`#sum-${which}`).classList.remove('d-none');
        document.querySelector(`#stats-${which}`).classList.remove('d-none');
    } else {
        document.querySelector(`#reports`).classList.remove('d-none');
    }

    if (which === 'data' || which === 'totals' || which === 'youtube' || which === 'twitch') {
        document.querySelector("#data-totals").classList.remove('d-none');
    } else {
        document.querySelector("#data-totals").classList.add('d-none');
    }

    if (which === 'totals' || which === 'youtube' || which === 'twitch') {
        document.querySelector(`#data-btn`).classList.add("active");
        document.querySelector("#stats-data").classList.remove('d-none');
        document.querySelector("#sum-data").classList.remove('d-none');
    }

    if (which === 'data') {
        document.querySelector(`#${which}-btn`).classList.add("active");
        display('totals')
    }
}



display('data');
display('totals');

const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, { html: true }))