function display(which) {
    document.querySelectorAll("div.stats").forEach((el) => { el.classList.add('d-none') });
    document.querySelectorAll("a.nav-link").forEach((el) => { el.classList.remove("xActive"); });
    document.querySelector(`#${which}-btn`).classList.add("xActive");
    document.querySelector(`#stats-${which}`).classList.remove('d-none');
}


function scrollToSection(where) {
    const target = document.querySelector(`#${where}`);
    document.querySelectorAll("a.nav-link").forEach((el) => { el.classList.remove("active_underlined") });
    if (target) {
        target.scrollIntoView({
            behavior: 'smooth'
        });
        document.querySelector(`#${where}-btn`).classList.add("active_underlined");
    }
}
display('totals');