const socket = io();

// 1. Obtener o crear un identificador único y permanente para este navegador
let miUsuarioId = localStorage.getItem('chat_usuario_id');
if (!miUsuarioId) {
    miUsuarioId = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('chat_usuario_id', miUsuarioId);
}

const formulario = document.getElementById('formulario');
const textoInput = document.getElementById('textoInput');
const archivoInput = document.getElementById('archivoInput');
const contenedorMensajes = document.getElementById('mensajes');

// Función auxiliar para renderizar un mensaje en pantalla
function mostrarMensaje(datos) {
    const divMensaje = document.createElement('div');
    divMensaje.classList.add('mensaje');

    // Identificar si el emisor es el ID guardado en localStorage
    const emisorId = datos.usuarioId || datos.emisor_id;

    if (emisorId === miUsuarioId) {
        divMensaje.classList.add('mio');  // Derecha (Negro)
    } else {
        divMensaje.classList.add('otro'); // Izquierda (Morado #4b1c71)
    }

    if (datos.tipo === 'texto') {
        divMensaje.textContent = datos.contenido;
    } else if (datos.tipo === 'foto') {
        if (datos.texto) {
            const p = document.createElement('p');
            p.textContent = datos.texto;
            divMensaje.appendChild(p);
        }
        const img = document.createElement('img');
        img.src = datos.contenido;
        img.classList.add('media-chat');
        divMensaje.appendChild(img);
    } else if (datos.tipo === 'video') {
        if (datos.texto) {
            const p = document.createElement('p');
            p.textContent = datos.texto;
            divMensaje.appendChild(p);
        }
        const video = document.createElement('video');
        video.src = datos.contenido;
        video.controls = true;
        video.classList.add('media-chat');
        divMensaje.appendChild(video);
    }

    contenedorMensajes.appendChild(divMensaje);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
}

// Cargar todo el historial de la BD al conectar
socket.on('historial', (mensajesGuardados) => {
    contenedorMensajes.innerHTML = '';
    mensajesGuardados.forEach((msg) => {
        mostrarMensaje(msg);
    });
});

// Recibir mensaje en tiempo real
socket.on('mensaje', (datos) => {
    mostrarMensaje(datos);
});

// Enviar mensaje o archivo
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const archivo = archivoInput.files[0];
    const texto = textoInput.value.trim();

    if (archivo) {
        const formData = new FormData();
        formData.append('archivo', archivo);

        try {
            const respuesta = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const datosArchivo = await respuesta.json();
            const esVideo = datosArchivo.type.startsWith('video/');

            socket.emit('mensaje', {
                usuarioId: miUsuarioId, // Enviamos el ID permanente
                tipo: esVideo ? 'video' : 'foto',
                contenido: datosArchivo.url,
                texto: texto
            });

            archivoInput.value = '';
        } catch (error) {
            console.error('Error al subir archivo:', error);
        }
    } else if (texto !== '') {
        socket.emit('mensaje', {
            usuarioId: miUsuarioId, // Enviamos el ID permanente
            tipo: 'texto',
            contenido: texto
        });
    }

    textoInput.value = '';
});