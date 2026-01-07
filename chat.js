// Aguarda o DOM estar completamente carregado antes de executar
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== SELEÇÃO DE ELEMENTOS DO DOM =====
    
    // Elementos do formulário principal
    const form = document.getElementById("formulario-debate");
    const input = document.getElementById("afirmacao-do-usuario");
    const btnDebater = document.getElementById("botao-debater");
    const historico = document.getElementById("historico_debate");
    const contador = document.getElementById("contador-de-caracteres");

    // Templates HTML para mensagens (clonados pelo JavaScript)
    const templateUsuario = document.getElementById("template-msg-usuario");
    const templateIA = document.getElementById("template-msg-IA");
    const templateLoading = document.getElementById("IA-pensando");

    // ===== CONSTANTES DE CONFIGURAÇÃO =====
    
    const LIMITE_CARACTERES = 500;  // Máximo de caracteres permitidos
    const LIMITE_AVISO = 400;       // Quando mostrar aviso amarelo
    const LIMITE_PERIGO = 480;      // Quando mostrar aviso vermelho
    const TIMEOUT = 30000;          // Tempo máximo de espera

    
    // ===== FUNÇÕES DE MANIPULAÇÃO DO HISTÓRICO =====
    
    /**
     * Rola o histórico automaticamente para a última mensagem
     */
    function rolagemAutomatica() {
        historico.scrollTop = historico.scrollHeight;
    }

    /**
     * Adiciona mensagem do usuário ao histórico visual
     * @param {string} texto - Texto da mensagem
     */
    function adicionarMensagemUsuario(texto) {
        const clone = templateUsuario.content.cloneNode(true);
        clone.querySelector(".txt-do-usuario").textContent = texto;
        historico.appendChild(clone);
        rolagemAutomatica();
    }

    /**
     * Adiciona mensagem da IA ao histórico visual
     * @param {string} texto - Resposta da IA
     */
    function adicionarMensagemIA(texto) {
        const clone = templateIA.content.cloneNode(true);
        clone.querySelector(".txt-IA").textContent = texto;
        historico.appendChild(clone);
        rolagemAutomatica();
    }

    /**
     * Mostra indicador de "pensando..." enquanto aguarda resposta da IA
     * @returns {HTMLElement} - Elemento do loading para remoção posterior
     */
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

    /**
     * Remove o indicador de loading
     */
    function removerLoading() {
        const loading = document.getElementById("carrega-msg");
        if (loading) {
            loading.remove();
        }
    }

    /**
     * Atualiza o contador de caracteres com cores de aviso
     */
    function atualizarContador() {
        const len = input.value.length;
        contador.textContent = String(len);
        
        // Remove classes anteriores
        contador.classList.remove('warning', 'danger');

        // Adiciona classe baseada no limite
        if (len >= LIMITE_PERIGO) {
            contador.classList.add('danger');     // Vermelho (próximo ao limite)
        } else if (len >= LIMITE_AVISO) {
            contador.classList.add('warning');    // Amarelo (aviso)
        }
    }

    /**
     * Limpa o histórico visual e restaura mensagem inicial
     */
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

    /**
     * Remove a mensagem inicial quando o primeiro debate começa
     */
    function removerMensagemInicial() {
        const firstChild = historico.firstElementChild;
        if (firstChild && firstChild.querySelector && firstChild.querySelector('.fa-comments')) {
            historico.innerHTML = '';
        }
    }

    
    // ===== COMUNICAÇÃO COM O BACKEND =====
    
    /**
     * Envia mensagem para a API e exibe resposta da IA
     * @param {string} texto - Mensagem do usuário
     */
    async function enviarParaAPI(texto) {
        // Adiciona mensagem do usuário visualmente
        adicionarMensagemUsuario(texto);

        // Mostra indicador de loading
        mostrarLoading();

        // Configura timeout para cancelar requisição se demorar muito
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            // Envia requisição POST para o backend
            const resposta = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: texto }),
                signal: controller.signal  // Permite cancelamento
            });

            // Limpa o timeout se resposta chegou a tempo
            clearTimeout(timeout);

            // Verifica se houve erro HTTP
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

            // Processa resposta da IA
            const dados = await resposta.json();
            const textoIA = dados.ai_response || 'Resposta vazia da IA.';
            
            removerLoading();
            adicionarMensagemIA(textoIA);

        } catch (erro) {
            removerLoading();
            
            // Tratamento específico por tipo de erro
            if (erro.name === 'AbortError') {
                adicionarMensagemIA('Tempo de resposta excedido. Tente novamente.');
            } else {
                adicionarMensagemIA('Erro de rede. Verifique sua conexão e tente novamente.');
                console.error('Erro ao chamar /chat:', erro);
            }
        } finally {
            // Sempre reativa o botão ao final
            btnDebater.disabled = false;
            btnDebater.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    
    // ===== EVENTOS DO FORMULÁRIO =====
    
    /**
     * Evento de submissão do formulário
     */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();  // Impede reload da página

        const texto = input.value.trim();
        if (!texto) return;  // Não envia mensagem vazia

        // Valida limite de caracteres
        if (texto.length > LIMITE_CARACTERES) {
            input.value = texto.slice(0, LIMITE_CARACTERES);
            return;
        }

        // Desativa botão enquanto processa
        btnDebater.disabled = true;
        btnDebater.classList.add('opacity-50', 'cursor-not-allowed');

        // Limpa input e atualiza contador
        input.value = '';
        atualizarContador();

        // Remove mensagem inicial se for a primeira mensagem
        removerMensagemInicial();

        // Envia para API
        await enviarParaAPI(texto);
    });

    /**
     * Atualiza contador conforme usuário digita
     */
    input.addEventListener('input', atualizarContador);

    /**
     * Permite enviar com Enter (sem Shift)
     */
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });

    // Inicializa contador
    atualizarContador();

    // Foca no input ao carregar página
    input.focus();


    // ===== MODAL DE SUGESTÕES DE TEMAS =====
    
    const btnSugerirTemas = document.getElementById("botao-sugerir-temas");
    const modalSugestoes = document.getElementById("modal-sugestoes-temas");
    const btnFecharModal = document.getElementById("fechar-modal-temas");
    const itensTemas = document.querySelectorAll(".item-tema");

    /**
     * Abre o modal de sugestões de temas
     */
    function abrirModalTemas() {
        modalSugestoes.classList.remove("escondido");
        document.body.style.overflow = "hidden";  // Impede scroll da página
    }

    /**
     * Fecha o modal de sugestões de temas
     */
    function fecharModalTemas() {
        modalSugestoes.classList.add("escondido");
        document.body.style.overflow = "auto";  // Restaura scroll
    }

    /**
     * Preenche o input com o tema selecionado
     * @param {string} textoTema - Texto do tema escolhido
     */
    function preencherInputComTema(textoTema) {
        const textoLimpo = textoTema.replace("• ", "").trim();
        input.value = textoLimpo;
        atualizarContador();
        fecharModalTemas();
        input.focus();
    }

    // Eventos do modal de temas
    if (btnSugerirTemas) {
        btnSugerirTemas.addEventListener("click", abrirModalTemas);
    }
    
    if (btnFecharModal) {
        btnFecharModal.addEventListener("click", fecharModalTemas);
    }

    // Clicar em um tema para preencher o input
    itensTemas.forEach(item => {
        item.addEventListener("click", () => {
            preencherInputComTema(item.textContent);
        });
    });

    // Fechar modal ao clicar fora do conteúdo
    if (modalSugestoes) {
        modalSugestoes.addEventListener("click", (e) => {
            if (e.target === modalSugestoes) {
                fecharModalTemas();
            }
        });
    }


    // ===== MODAL DE DESAFIOS =====
    
    const btnMostrarDesafios = document.getElementById("botao-mostrar-desafios");
    const modalDesafios = document.getElementById("modal-desafios");
    const btnFecharModalDesafios = document.getElementById("fechar-modal-desafios");
    const itensDesafios = document.querySelectorAll(".item-desafio");

    /**
     * Abre o modal de desafios
     */
    function abrirModalDesafios() {
        modalDesafios.classList.remove("escondido");
        document.body.style.overflow = "hidden";
    }

    /**
     * Fecha o modal de desafios
     */
    function fecharModalDesafios() {
        modalDesafios.classList.add("escondido");
        document.body.style.overflow = "auto";
    }

    /**
     * Preenche o input com o desafio selecionado
     * @param {HTMLElement} elementoDesafio - Elemento do desafio clicado
     */
    function preencherInputComDesafio(elementoDesafio) {
        const paragrafo = elementoDesafio.querySelector("p");
        if (paragrafo) {
            const textoDesafio = paragrafo.textContent.trim();
            input.value = textoDesafio;
            atualizarContador();
            fecharModalDesafios();
            input.focus();
        }
    }

    // Eventos do modal de desafios
    if (btnMostrarDesafios) {
        btnMostrarDesafios.addEventListener("click", abrirModalDesafios);
    }

    if (btnFecharModalDesafios) {
        btnFecharModalDesafios.addEventListener("click", fecharModalDesafios);
    }

    // Clicar em um desafio para preencher o input
    itensDesafios.forEach(item => {
        item.addEventListener("click", () => {
            preencherInputComDesafio(item);
        });
    });

    // Fechar modal ao clicar fora
    if (modalDesafios) {
        modalDesafios.addEventListener("click", (e) => {
            if (e.target === modalDesafios) {
                fecharModalDesafios();
            }
        });
    }


    // ===== SISTEMA DE TEMA CLARO/ESCURO =====
    
    const btnMudarTema = document.getElementById("botao-mudar-tema");
    const CHAVE_TEMA = "tema-discussao-merda";  // Chave para localStorage

    /**
     * Aplica o tema (claro ou escuro) ao site
     * @param {string} tema - "claro" ou "escuro"
     */
    function aplicarTema(tema) {
        if (tema === "claro") {
            document.body.classList.add("tema-claro");
            localStorage.setItem(CHAVE_TEMA, "claro");
        } else {
            document.body.classList.remove("tema-claro");
            localStorage.setItem(CHAVE_TEMA, "escuro");
        }
    }

    /**
     * Alterna entre tema claro e escuro
     */
    function alternarTema() {
        const temaAtual = document.body.classList.contains("tema-claro") ? "claro" : "escuro";
        const novoTema = temaAtual === "escuro" ? "claro" : "escuro";
        aplicarTema(novoTema);
    }

    /**
     * Carrega o tema preferido do usuário (salvo ou do sistema)
     */
    function carregarTemaPreferido() {
        const temaSalvo = localStorage.getItem(CHAVE_TEMA);
        
        if (temaSalvo) {
            // Usa tema salvo anteriormente
            aplicarTema(temaSalvo);
        } else {
            // Detecta preferência do sistema operacional
            const prefereTemaEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
            aplicarTema(prefereTemaEscuro ? "escuro" : "claro");
        }
    }

    // Evento do botão de mudar tema
    if (btnMudarTema) {
        btnMudarTema.addEventListener("click", alternarTema);
    }

    // Carrega tema ao iniciar
    carregarTemaPreferido();

    // Detecta mudanças na preferência do sistema
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        // Só muda se usuário não tiver definido preferência manual
        if (!localStorage.getItem(CHAVE_TEMA)) {
            aplicarTema(e.matches ? "escuro" : "claro");
        }
    });


    // ===== LIMPEZA DE HISTÓRICO =====
    
    /**
     * Limpa o histórico da IA no backend ao carregar página
     * Garante que cada sessão comece sem contexto anterior
     */
    async function limparHistoricoIA() {
        try {
            await fetch('/limpar-historico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (erro) {
            console.error('Erro ao limpar histórico:', erro);
        }
    }

    // Limpa histórico da IA ao carregar a página
    limparHistoricoIA();


    // ===== FUNÇÃO DE APAGAR HISTÓRICO (BOTÃO) =====
    
    const btnLimparTudo = document.getElementById("botao-limpar-tudo");

    /**
     * Mostra modal de confirmação antes de apagar histórico
     */
    function confirmarLimpezaHistorico() {
        // Cria modal de confirmação dinamicamente
        const modalConfirmacao = document.createElement('div');
        modalConfirmacao.className = 'modal-overlay';
        modalConfirmacao.id = 'modal-confirmacao-limpeza';
        
        modalConfirmacao.innerHTML = `
            <div class="modal-conteudo modal-confirmacao-pequeno">
                <div class="modal-cabecalho">
                    <h2 class="modal-titulo">🗑️ Apagar Histórico</h2>
                </div>
                
                <p class="texto-confirmacao">
                    Tem certeza que deseja apagar todo o histórico de debates?
                    Esta ação não pode ser desfeita.
                </p>
                
                <div class="botoes-confirmacao">
                    <button id="btn-cancelar-limpeza" class="botao-cancelar">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button id="btn-confirmar-limpeza" class="botao-confirmar-perigo">
                        <i class="fas fa-trash-alt"></i>
                        Apagar Tudo
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalConfirmacao);
        document.body.style.overflow = "hidden";
        
        // Anima entrada do modal
        setTimeout(() => {
            modalConfirmacao.classList.remove('escondido');
        }, 10);
        
        // Botão cancelar
        const btnCancelar = document.getElementById('btn-cancelar-limpeza');
        btnCancelar.addEventListener('click', () => {
            fecharModalConfirmacao();
        });
        
        // Botão confirmar
        const btnConfirmar = document.getElementById('btn-confirmar-limpeza');
        btnConfirmar.addEventListener('click', () => {
            limparHistoricoCompleto();
            fecharModalConfirmacao();
        });
        
        // Fechar ao clicar fora
        modalConfirmacao.addEventListener('click', (e) => {
            if (e.target === modalConfirmacao) {
                fecharModalConfirmacao();
            }
        });
        
        // Fechar com tecla ESC
        const teclaEsc = (e) => {
            if (e.key === 'Escape') {
                fecharModalConfirmacao();
                document.removeEventListener('keydown', teclaEsc);
            }
        };
        document.addEventListener('keydown', teclaEsc);
    }

    /**
     * Fecha o modal de confirmação de limpeza
     */
    function fecharModalConfirmacao() {
        const modal = document.getElementById('modal-confirmacao-limpeza');
        if (modal) {
            modal.classList.add('escondido');
            document.body.style.overflow = "auto";
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    /**
     * Limpa o histórico completamente (visual + backend)
     */
    async function limparHistoricoCompleto() {
        // Limpa visualmente
        limparHistoricoDOM();
        
        // Limpa no backend também
        try {
            await fetch('/limpar-historico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (erro) {
            console.error('Erro ao limpar histórico no servidor:', erro);
        }
        
        // Mostra notificação de sucesso
        mostrarNotificacao('Histórico apagado com sucesso!', 'sucesso');
    }

    /**
     * Mostra notificação temporária na tela
     * @param {string} mensagem - Texto da notificação
     * @param {string} tipo - "sucesso" ou "erro"
     */
    function mostrarNotificacao(mensagem, tipo) {
        const notificacao = document.createElement('div');
        notificacao.className = `notificacao notificacao-${tipo}`;
        notificacao.innerHTML = `
            <i class="fas ${tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${mensagem}</span>
        `;
        
        document.body.appendChild(notificacao);
        
        // Anima entrada
        setTimeout(() => {
            notificacao.classList.add('notificacao-visivel');
        }, 10);
        
        // Remove após 3 segundos
        setTimeout(() => {
            notificacao.classList.remove('notificacao-visivel');
            setTimeout(() => {
                notificacao.remove();
            }, 300);
        }, 3000);
    }

    // Evento do botão de limpar histórico
    if (btnLimparTudo) {
        btnLimparTudo.addEventListener('click', confirmarLimpezaHistorico);
    }

});
