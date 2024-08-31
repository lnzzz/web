document.addEventListener('DOMContentLoaded', () => {

    const addButton = document.getElementById('add-channel-btn');


    const handleResponse = async (response) => {
        const result = await response.json();
        const toastSuccess = document.getElementById('toast-success');
        const toastBodyContent = document.getElementById('toast-body-content');

        if (response.ok) {
            toastBodyContent.textContent = result.message || 'Canal agregado exitosamente!';
            toastSuccess.classList.remove('hide');
            setTimeout(() => toastSuccess.classList.add('hide'), 3000);
        } else {
            const toastError = document.getElementById('toast-error');
            const toastBodyContentError = document.getElementById('toast-body-content-error');
            toastBodyContentError.textContent = result.message || 'Error al agregar el canal.';
            toastError.classList.remove('hide');
            setTimeout(() => toastError.classList.add('hide'), 3000);
        }
    };


    addButton.addEventListener('click', async () => {
        const name = document.getElementById('name').value.trim();
        const id = document.getElementById('id').value.trim();
        const platform = document.getElementById('platform').value;
        const channelUri = document.getElementById('channelUri').value.trim();

        if (!name || !id || !channelUri) {
            alert('Por favor, complete todos los campos.');
            return;
        }

        try {

            const response = await fetch('/add-channel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({channelData:{
                    name,
                    id,
                    platform: 'youtube',
                    channelUri,
                }}),
            });

            //handleResponse(response);

            if (response.status === 200){
              alert('Canal creado exitosamente.');
                location.reload();
            } else{
                alert('error');
            }
        } catch (error) {
            console.error('Error:', error);
            const toastError = document.getElementById('toast-error');
            const toastBodyContentError = document.getElementById('toast-body-content-error');
            toastBodyContentError.textContent = 'Error de red. Inténtelo de nuevo.';
            toastError.classList.remove('hide');
            setTimeout(() => toastError.classList.add('hide'), 3000);
        }
    });
});
