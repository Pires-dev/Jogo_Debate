(() => {
    const form = document.getElementById("formulario-debate");
    const input = document.getElementById("afirmacao-do-usuario");
    const btnDebater = document.getElementById("botao-debater");
    const historico = document.getElementById("historico_debate");
    const btnLimpar = document.getElementById("apagar-historico");
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

    btnLimpar.addEventListener('click', async (e) => {
        e.preventDefault();

        const confirmacao = confirm('Deseja realmente limpar o histórico do debate?');
        if (!confirmacao) return;

        try {
            btnLimpar.disabled = true;
            
            const resposta = await fetch('/reset', { 
                method: 'POST' 
            });

            if (!resposta.ok) {
                alert('Falha ao limpar histórico no servidor.');
                return;
            }

            limparHistoricoDOM();

        } catch (erro) {
            console.error('Erro ao chamar /reset:', erro);
            alert('Erro de rede ao limpar histórico.');
        } finally {
            btnLimpar.disabled = false;
        }
    });

    atualizarContador();

    window.addEventListener('load', () => {
        input.focus();
    });

})();