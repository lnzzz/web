function display(which) {
    
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
}



display('totals');

const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, { html: true }))
