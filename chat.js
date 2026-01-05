(() => {
    
    const form = document.getElementById("formulario-debate");
    const input = document.getElementById("afirmacao-do-usuario");
    const btnDebater = document.getElementById("botao-debater");
    const historico = document.getElementById("historico_debate");
    const contador = document.getElementById("contador-de-caracteres");

    const templateUsuario = document.getElementById("template-msg-usuario");
    const templateIA = document.getElementById("template-msg-IA");
    const templateLoading = document.getElementById("IA-pensando");

    const LIMITE_CARACTERES = 500;
    const LIMITE_AVISO = 400;
    const LIMITE_PERIGO = 480;
    const TIMEOUT = 20000;

    

    function rolagemAutomatica() {
        historico.scrollTop = historico.scrollHeight;
    }

    function adicionarMensagemUsuario(texto) {
        const clone = templateUsuario.content.cloneNode(true);
        clone.querySelector(".txt-do-usuario").textContent = texto;
        historico.appendChild(clone);
        rolagemAutomatica();
    }

    function adicionarMensagemIA(texto) {
        const clone = templateIA.content.cloneNode(true);
        clone.querySelector(".txt-IA").textContent = texto;
        historico.appendChild(clone);
        rolagemAutomatica();
    }

    function mostrarLoading() {
        const clone = templateLoading.content.cloneNode(true);
        const caixaLoading = document.createElement('div');
        caixaLoading.classList.add('loading-wrapper');
        caixaLoading.id = "carrega-msg";
        caixaLoading.appendChild(clone);
        historico.appendChild(caixaLoading);
        rolagemAutomatica();
        return caixaLoading;
    }

    function removerLoading() {
        const loading = document.getElementById("carrega-msg");
        if (loading) {
            loading.remove();
        }
    }

    function atualizarContador() {
        const len = input.value.length;
        contador.textContent = String(len);
        
        contador.classList.remove('warning', 'danger');

        if (len >= LIMITE_PERIGO) {
            contador.classList.add('danger');
        } else if (len >= LIMITE_AVISO) {
            contador.classList.add('warning');
        }
    }

    function limparHistoricoDOM() {
        historico.innerHTML = `
            <div class="text-center text-gray-400 py-20">
                <i class="fas fa-comments text-6xl mb-4 opacity-50"></i>
                <p class="text-xl">
                    Nenhum debate ainda. Faça sua primeira afirmação!
                </p>
            </div>
        `;
    }

    function removerMensagemInicial() {
        const firstChild = historico.firstElementChild;
        if (firstChild && firstChild.querySelector && firstChild.querySelector('.fa-comments')) {
            historico.innerHTML = '';
        }
    }

    async function enviarParaAPI(texto) {
        adicionarMensagemUsuario(texto);

        mostrarLoading();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            const resposta = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: texto }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!resposta.ok) {
                let detailText = `Erro ${resposta.status} ao contactar o servidor.`;
                try {
                    const erroJson = await resposta.json();
                    if (erroJson && erroJson.detail) {
                        detailText = erroJson.detail;
                    }
                } catch (_) {}
                removerLoading();
                adicionarMensagemIA(`Erro: ${detailText}`);
                return;
            }

            const dados = await resposta.json();
            const textoIA = dados.ai_response || 'Resposta vazia da IA.';
            
            removerLoading();
            adicionarMensagemIA(textoIA);

        } catch (erro) {
            removerLoading();
            
            if (erro.name === 'AbortError') {
                adicionarMensagemIA('Tempo de resposta excedido. Tente novamente.');
            } else {
                adicionarMensagemIA('Erro de rede. Verifique sua conexão e tente novamente.');
                console.error('Erro ao chamar /chat:', erro);
            }
        } finally {
            btnDebater.disabled = false;
            btnDebater.classList.remove('opacity-50', 'cursor-not-allowed');
            rolagemAutomatica();
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const texto = input.value.trim();
        if (!texto) return;

        if (texto.length > LIMITE_CARACTERES) {
            input.value = texto.slice(0, LIMITE_CARACTERES);
            return;
        }

        btnDebater.disabled = true;
        btnDebater.classList.add('opacity-50', 'cursor-not-allowed');

        input.value = '';
        atualizarContador();

        removerMensagemInicial();

        await enviarParaAPI(texto);
    });

    input.addEventListener('input', atualizarContador);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });

    atualizarContador();

    window.addEventListener('load', () => {
        input.focus();
    });



    // === Modal de Sugestões de Temas ===
const btnSugerirTemas = document.getElementById("botao-sugerir-temas");
const modalSugestoes = document.getElementById("modal-sugestoes-temas");
const btnFecharModal = document.getElementById("fechar-modal-temas");
const itensTemas = document.querySelectorAll(".item-tema");

function abrirModalTemas() {
    modalSugestoes.classList.remove("escondido");
    document.body.style.overflow = "hidden";
}

function fecharModalTemas() {
    modalSugestoes.classList.add("escondido");
    document.body.style.overflow = "auto";
}

function preencherInputComTema(textoTema) {
    const textoLimpo = textoTema.replace("• ", "").trim();
    input.value = textoLimpo;
    atualizarContador();
    fecharModalTemas();
    input.focus();
}

// Event Listeners
btnSugerirTemas.addEventListener("click", abrirModalTemas);
btnFecharModal.addEventListener("click", fecharModalTemas);

// Clicar nos temas para preencher o input
itensTemas.forEach(item => {
    item.addEventListener("click", () => {
        preencherInputComTema(item.textContent);
    });
});

// Fechar modal ao clicar fora
modalSugestoes.addEventListener("click", (e) => {
    if (e.target === modalSugestoes) {
        fecharModalTemas();
    }
});



// === Modal de Desafios ===
const btnMostrarDesafios = document.getElementById("botao-mostrar-desafios");
const modalDesafios = document.getElementById("modal-desafios");
const btnFecharModalDesafios = document.getElementById("fechar-modal-desafios");
const itensDesafios = document.querySelectorAll(".item-desafio");

function abrirModalDesafios() {
    modalDesafios.classList.remove("escondido");
    document.body.style.overflow = "hidden";
}

function fecharModalDesafios() {
    modalDesafios.classList.add("escondido");
    document.body.style.overflow = "auto";
}

// Event Listeners para Desafios
btnMostrarDesafios.addEventListener("click", abrirModalDesafios);
btnFecharModalDesafios.addEventListener("click", fecharModalDesafios);

// Fechar modal ao clicar fora
modalDesafios.addEventListener("click", (e) => {
    if (e.target === modalDesafios) {
        fecharModalDesafios();
    }
});


// === Sistema de Tema Claro/Escuro ===
    const btnMudarTema = document.getElementById("botao-mudar-tema");
    const CHAVE_TEMA = "tema-discussao-merda";

    function aplicarTema(tema) {
        if (tema === "claro") {
            document.body.classList.add("tema-claro");
            localStorage.setItem(CHAVE_TEMA, "claro");
        } else {
            document.body.classList.remove("tema-claro");
            localStorage.setItem(CHAVE_TEMA, "escuro");
        }
    }

    function alternarTema() {
        const temaAtual = document.body.classList.contains("tema-claro") ? "claro" : "escuro";
        const novoTema = temaAtual === "escuro" ? "claro" : "escuro";
        aplicarTema(novoTema);
    }

    function carregarTemaPreferido() {
        const temaSalvo = localStorage.getItem(CHAVE_TEMA);
        
        if (temaSalvo) {
            aplicarTema(temaSalvo);
        } else {
            // Detectar preferência do sistema
            const prefereTemaEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
            aplicarTema(prefereTemaEscuro ? "escuro" : "claro");
        }
    }

    // Event Listener para o botão de tema
    if (btnMudarTema) {
        btnMudarTema.addEventListener("click", alternarTema);
    }

    // Carregar tema ao iniciar
    carregarTemaPreferido();

    // Detectar mudanças na preferência do sistema
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem(CHAVE_TEMA)) {
            aplicarTema(e.matches ? "escuro" : "claro");
        }
    });

})();

