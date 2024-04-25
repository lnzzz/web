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

const display = (which) => {
    document.querySelectorAll("a.nav-link").forEach((el) => { el.classList.remove("active") });
    document.querySelector(`#${which}-btn`).classList.add("active");
    document.querySelectorAll("div.section").forEach((el) => { el.classList.add('d-none')});
    document.querySelector(`div#${which}`).classList.remove('d-none');
}

const domReady = (callBack) => {
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', callBack);
    }
    else {
        callBack();
    }
}

const windowReady = (callBack) => {
    if (document.readyState === 'complete') {
        callBack();
    }
    else {
        window.addEventListener('load', callBack);
    }
}

const removeLink = async(linkTag) => {
    const url = '/twitter/links';
    const options = {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tag: linkTag })
    }
    try {
        await fetch(url, options);
        document.getElementById(linkTag).value = '';
        document.getElementById("toast-body-content").innerHTML = `Link eliminado con &eacute;xito`;
        successToast.show();
    } catch (err) {
        console.log(err.message);
        return false;
    }
}

const publishReport = async(reportId) => {
    const url = '/reports/publish';
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reportId: reportId })
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error('Ha ocurrido un error publicando el reporte.');
        }
        document.getElementById("toast-body-content").innerHTML = `Reporte publicado con &eacute;xito`;
        document.getElementById(`publisher-${reportId}`).parentElement.previousElementSibling.innerHTML = 'SI';

        
        const unpublisherElement = document.querySelector(".unpublisher");
        if (unpublisherElement) {
            unpublisherElement.parentElement.previousElementSibling.innerHTML = 'NO';
            const parentUnpublisher = unpublisherElement.parentElement;
            const newPublisher = document.createElement('button');
            newPublisher.classList.add('btn', 'btn-success', 'publisher');
            newPublisher.id = unpublisherElement.getAttribute("id").replace('unpublisher', 'publisher');
            newPublisher.textContent = 'Publicar';
            newPublisher.addEventListener('click', publishAction);
            parentUnpublisher.replaceChild(newPublisher, unpublisherElement);
        }
        

        const parent = document.getElementById(`publisher-${reportId}`).parentElement;
        const oldElement = document.getElementById(`publisher-${reportId}`);
        const newElement = document.createElement('button');
        newElement.classList.add('btn', 'btn-danger', 'unpublisher');
        newElement.id = `unpublisher-${reportId}`;
        newElement.textContent = 'Despublicar';
        newElement.addEventListener('click', unpublishAction);
        parent.replaceChild(newElement, oldElement);
        successToast.show();
    } catch (err) {
        console.log(err.message);
        document.getElementById('toast-body-content-error').innerHTML = 'Ha ocurrido un error publicando el reporte';
        errorToast.show();
        return false;
    }
}

const unpublishReport = async(reportId) => {
    const url = '/reports/unpublish';
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reportId: reportId })
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error('Ha ocurrido un error publicando el reporte.');
        }
        document.getElementById("toast-body-content").innerHTML = `Reporte despublicado con &eacute;xito`;
        document.getElementById(`unpublisher-${reportId}`).parentElement.previousElementSibling.innerHTML = 'NO';
        const parent = document.getElementById(`unpublisher-${reportId}`).parentElement;
        const oldElement = document.getElementById(`unpublisher-${reportId}`);
        const newElement = document.createElement('button');
        newElement.classList.add('btn', 'btn-success', 'publisher');
        newElement.id = `publisher-${reportId}`;
        newElement.textContent = 'Publicar';
        newElement.addEventListener('click', publishAction);
        parent.replaceChild(newElement, oldElement);
        successToast.show();
    } catch (err) {
        console.log(err.message);
        document.getElementById('toast-body-content-error').innerHTML = 'Ha ocurrido un error despublicando el reporte';
        errorToast.show();
        return false;
    }
}

const saveLink = async(linkValue, linkTag) => {
    const url = '/twitter/links';
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ linkValue, linkTag })
    }
    try {
        await fetch(url, options);
        document.getElementById("toast-body-content").innerHTML = `Link guardado con &eacute;xito`;
        successToast.show();
    } catch (err) {
        document.getElementById('toast-body-content-error').innerHTML = 'Ha ocurrido un error guardando el link';
        errorToast.show();
        return false;
    }
}

const successToast = new bootstrap.Toast(document.getElementById('toast'));
const errorToast = new bootstrap.Toast(document.getElementById('toast-error'));

const publishAction = async function(evt) {
    evt.preventDefault();
    const id = this.getAttribute("id").split("-")[1];
    this.setAttribute('disabled', 'disabled');
    await publishReport(id);
    this.removeAttribute("disabled");
}

const unpublishAction = async function(evt) {
    evt.preventDefault();
    const id = this.getAttribute("id").split("-")[1];
    this.setAttribute('disabled', 'disabled');
    await unpublishReport(id);
    this.removeAttribute("disabled");
}

domReady(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('activeTab');
    if (activeTab) {
        document.querySelector(`#${activeTab}-btn`).click();
    } else {
        display('maximos');
    }
    const savers = document.querySelectorAll('.saver');
    const deleters = document.querySelectorAll('.deleter');
    const publishers = document.querySelectorAll(".publisher");
    const unpublishers = document.querySelectorAll(".unpublisher");
    
    document.querySelector('#allSaver').addEventListener('click', async function (evt) {
        evt.preventDefault();
        this.setAttribute('disabled', 'disabled');
        savers.forEach(function(saver) {
            saver.click();
        });
        this.removeAttribute("disabled");
    });

    document.querySelector("#allDeleter").addEventListener('click', async function (evt) {
        evt.preventDefault();
        this.setAttribute('disabled', 'disabled');
        deleters.forEach(function(deleter) {
            deleter.click();
        });
        this.removeAttribute("disabled");
    });

    publishers.forEach(function(publisher) {
        publisher.addEventListener('click', publishAction);
    });

    unpublishers.forEach(function(unpublisher) {
        unpublisher.addEventListener('click', unpublishAction);
    });


    savers.forEach(function(saver) {
        saver.addEventListener('click', async function(evt) {
            evt.preventDefault();
            const id = this.getAttribute("id").split("-btn")[0];
            const link = document.querySelector(`#${id}`).value;
            if (link) {
                this.setAttribute('disabled', 'disabled');
                await saveLink(link, id);
                this.removeAttribute("disabled");
            }
        });
    });

    deleters.forEach(function(deleter) {
        deleter.addEventListener('click', async function(evt) {
            const id = this.getAttribute("id").split("-btn")[0];
            this.setAttribute("disabled", "disabled");
            await removeLink(id);
            this.removeAttribute("disabled");
        });
    })
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl, { html: true }));
})