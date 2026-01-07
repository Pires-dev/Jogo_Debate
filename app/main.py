from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
import os
import requests
import uvicorn
import secrets


# ===== CONFIGURAÇÃO INICIAL =====

# Carrega variáveis de ambiente do arquivo .env
load_dotenv()

# Obtém a chave da API do Gemini do arquivo .env
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Obtém ou gera uma chave secreta para sessões (cada usuário tem sua própria sessão)
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# URL da API do Google Gemini para gerar respostas da IA
API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    f"models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
)

# ===== PERSONALIDADE DA IA =====

# Define como a IA se comporta no debate
PERSONA_DEBATEDOR = (
    "RESET TOTAL: Cada debate é único. Esqueça tudo de conversas anteriores."
    
    "Você é um debatedor cético e irônico em um jogo de debate. Só responda quando o usuário apresentar um argumento ou pergunta."
    
    "Personalidade: sarcástico, arrogante na medida, mas reconhece bons argumentos. Seja coloquial e expressivo. Use referências pop quando fizer sentido."
    
    "IMPORTANTE - ABERTURA À MUDANÇA: Você começa cético, mas está genuinamente aberto a mudar de opinião com 3-5 boas respostas. Não seja teimoso - argumentos sólidos devem te convencer progressivamente. Mostre evolução clara: discordância total → dúvida → concordância parcial → convencido."
    
    "Regras:"
    "- Questione argumentos fracos ou vagos"
    "- Reconheça argumentos fortes IMEDIATAMENTE, mesmo sem concordar totalmente"
    "- Máximo 60 palavras por resposta (80 só em casos raros)"
    "- Mantenha o foco no argumento principal do usuário"
    "- Se usuário mudar de tema, aponte antes de continuar"
    
    "VITÓRIA DO USUÁRIO: Após 4-6 boas respostas consecutivas, declare que ele venceu. Faça um resumo de 2-3 linhas: ponto fraco inicial dele, virada no debate, argumento decisivo."
    
    "Evite: repetir objeções, enrolar, concordar por educação, terminar cedo demais SEM estar realmente convencido."
)


# ===== FUNÇÃO PRINCIPAL: COMUNICAÇÃO COM A IA =====

# Envia o histórico de conversa para a API do Gemini e retorna a resposta da IA.
def get_Resposta_IA(chat_history: list) -> str:
    
    # Verifica se a chave da API está configurada
    if not GEMINI_API_KEY:
        print("ERRO: API Key nao configurada")
        return "Erro interno: API Key não configurada."

    # Cria a instrução que define a personalidade da IA
    instrucao_IA = {
        "role": "user",
        "parts": [{"text": PERSONA_DEBATEDOR}]
    }

    # Limita o histórico às últimas 20 mensagens para não sobrecarregar a API
    chat_history_limitado = chat_history[-20:] if len(chat_history) > 20 else chat_history

    # Monta o corpo da requisição que será enviado para a API
    requisicao_API = {
        "contents": [instrucao_IA] + chat_history_limitado,  # Personalidade + histórico
        "generationConfig": {
            "temperature": 0.7,  # Controla criatividade das respostas
            "topP": 0.9,         # Limita escolha de palavras aos 90% mais prováveis
            "topK": 30           # Considera apenas as 30 palavras mais prováveis por vez
        }
    }

    try:
        # Log para acompanhar o processo no terminal
        print("Enviando requisicao para Gemini...")
        print(f"Tamanho do historico: {len(chat_history)} mensagens")
        
        # Envia a requisição POST para a API do Gemini
        # timeout=30 significa que aguarda no máximo 30 segundos por resposta
        resposta = requests.post(API_URL, json=requisicao_API, timeout=30)
        
        print(f"Status da resposta: {resposta.status_code}")
        
        # Se o código de status não for 200 (sucesso), houve erro
        if resposta.status_code != 200:
            print(f"Erro HTTP: {resposta.status_code}")
            print(f"Resposta: {resposta.text}")
            return f"Erro da API Gemini: {resposta.status_code}"
        
        # Verifica se houve erro HTTP (4xx ou 5xx)
        resposta.raise_for_status()
        
        # Converte a resposta JSON em dicionário Python
        dados = resposta.json()
        
        print("Resposta recebida com sucesso")
        
        # Extrai o texto da resposta da IA da estrutura JSON
        return dados["candidates"][0]["content"]["parts"][0]["text"]

    # Tratamento de erro: tempo de resposta excedido
    except requests.exceptions.Timeout:
        print("TIMEOUT: API demorou muito para responder")
        return "A IA demorou muito para responder. Tente novamente."
    
    # Tratamento de erro: problema de comunicação (rede, conexão, etc)
    except requests.exceptions.RequestException as e:
        print(f"Erro de requisicao: {str(e)}")
        return "Erro de comunicação com a IA."
    
    # Tratamento de erro: resposta da API veio em formato inesperado
    except (KeyError, IndexError) as e:
        print(f"Erro ao processar resposta: {str(e)}")
        print(f"Resposta completa: {resposta.text if 'resposta' in locals() else 'N/A'}")
        return "Erro ao processar resposta da IA."


# ===== CONFIGURAÇÃO DO FASTAPI =====

# Cria a aplicação FastAPI com metadados
app = FastAPI(
    title="Debate Arena API",
    description="API para o jogo Advogado do Diabo com IA",
    version="1.0.0"
)

# Adiciona middleware de sessão, para isolar o histórico de cada usuário
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY  # Chave para criptografar dados da sessão
)

# Serve arquivos estáticos (CSS, JS, imagens) da pasta "frontend"
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

# Configura o motor de templates Jinja2 para renderizar HTML
templates = Jinja2Templates(directory="templates")


# ===== MODELO DE DADOS =====

# Define o formato esperado da mensagem do usuário usando Pydantic
class requisicaoUsuario(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)  # Mensagem entre 1 e 500 caracteres


# ===== ROTAS DA API =====

# Rota principal que renderiza a página HTML do jogo
@app.get("/", response_class=HTMLResponse)
async def render_index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


# Rota que processa a mensagem do usuário e retorna a resposta da IA.
@app.post("/chat")
async def processar_debate(request: Request, dados_usuario: requisicaoUsuario):

 
 
    try:
        # Remove espaços em branco no início e fim da mensagem
        txt_usuario = dados_usuario.message.strip()
        
        # Valida se a mensagem não está vazia após o strip
        if not txt_usuario:
            raise HTTPException(status_code=400, detail="Mensagem vazia.")
        
        # Verifica se já existe histórico na sessão, se não cria uma lista vazia
        if "chat_historico" not in request.session:
            request.session["chat_historico"] = []
        
        # Obtém o histórico de conversa específico deste usuário
        chat_historico = request.session["chat_historico"]
        
        # Adiciona a mensagem do usuário ao histórico no formato esperado pela API
        chat_historico.append({
            "role": "user",  # Indica que é mensagem do usuário
            "parts": [{"text": txt_usuario}]
        })

        # Chama a função que se comunica com a API do Gemini
        resposta_ia = get_Resposta_IA(chat_historico)

        # Adiciona a resposta da IA ao histórico
        chat_historico.append({
            "role": "model",  # Indica que é resposta da IA
            "parts": [{"text": resposta_ia}]
        })
        
        # Salva o histórico atualizado de volta na sessão do usuário
        request.session["chat_historico"] = chat_historico

        # Retorna JSON com a mensagem do usuário e resposta da IA
        return {
            "user_message": txt_usuario,
            "ai_response": resposta_ia
        }

    # Re-lança exceções HTTP (como a de mensagem vazia)
    except HTTPException:
        raise
    
    # Captura qualquer outro erro não previsto
    except Exception as erro:
        print(f"Erro na rota /chat: {str(erro)}")
        raise HTTPException(
            status_code=500,
            detail=str(erro)
        )


@app.post("/limpar-historico")
async def limpar_historico(request: Request):

    # Limpa a lista de mensagens da sessão deste usuário
    request.session["chat_historico"] = []
    return {"status": "ok"}


# ===== EXECUÇÃO DO SERVIDOR =====

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
    
