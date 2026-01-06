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

# REMOVI: CHAT_HISTORICO = []

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    f"models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
)

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


def get_Resposta_IA(chat_history: list) -> str:
    if not GEMINI_API_KEY:
        print("❌ ERRO: API Key não configurada")
        return "Erro interno: API Key não configurada."

    instrucao_IA = {
        "role": "user",
        "parts": [{"text": PERSONA_DEBATEDOR}]
    }

    # Limita histórico a últimas 20 mensagens para evitar sobrecarga
    chat_history_limitado = chat_history[-20:] if len(chat_history) > 20 else chat_history

    requisicao_API = {
        "contents": [instrucao_IA] + chat_history_limitado,
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "topK": 30
        }
    }

    try:
        print("📤 Enviando requisição para Gemini...")
        print(f"📊 Tamanho do histórico: {len(chat_history)} mensagens")
        
        resposta = requests.post(API_URL, json=requisicao_API, timeout=30)
        
        print(f"📥 Status da resposta: {resposta.status_code}")
        
        if resposta.status_code != 200:
            print(f"❌ Erro HTTP: {resposta.status_code}")
            print(f"📄 Resposta: {resposta.text}")
            return f"Erro da API Gemini: {resposta.status_code}"
        
        resposta.raise_for_status()
        dados = resposta.json()
        
        print("✅ Resposta recebida com sucesso")
        return dados["candidates"][0]["content"]["parts"][0]["text"]

    except requests.exceptions.Timeout:
        print("⏱️ TIMEOUT: API demorou muito para responder")
        return "A IA demorou muito para responder. Tente novamente."
    
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro de requisição: {str(e)}")
        return "Erro de comunicação com a IA."
    
    except (KeyError, IndexError) as e:
        print(f"❌ Erro ao processar resposta: {str(e)}")
        print(f"📄 Resposta completa: {resposta.text if 'resposta' in locals() else 'N/A'}")
        return "Erro ao processar resposta da IA."


app = FastAPI(
    title="Debate Arena API",
    description="API para o jogo Advogado do Diabo com IA",
    version="1.0.0"
)

# ADICIONAR MIDDLEWARE DE SESSÃO
app.add_middleware(
    SessionMiddleware,
    secret_key=secrets.token_hex(32)
)

app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")
templates = Jinja2Templates(directory="templates")


class requisicaoUsuario(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


class requisicaoIA(BaseModel):
    user_message: str
    ai_response: str
    status: str = "success"


@app.get("/", response_class=HTMLResponse)
async def render_index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


@app.post("/chat", response_model=requisicaoIA)
async def processar_debate(request: Request, dados_usuario: requisicaoUsuario):
    try:
        txt_usuario = dados_usuario.message.strip()
        
        # Cria histórico individual para cada usuário na sessão
        if "chat_historico" not in request.session:
            request.session["chat_historico"] = []
        
        chat_historico = request.session["chat_historico"]
        
        # Adiciona mensagem do usuário
        chat_historico.append({
            "role": "user",
            "parts": [{"text": txt_usuario}]
        })

        # Chama IA
        resposta_ia = get_Resposta_IA(chat_historico)

        # Adiciona resposta da IA
        chat_historico.append({
            "role": "model",
            "parts": [{"text": resposta_ia}]
        })
        
        # Salva histórico atualizado na sessão
        request.session["chat_historico"] = chat_historico

        return requisicaoIA(
            user_message=txt_usuario,
            ai_response=resposta_ia,
            status="success"
        )

    except Exception as erro:
        print(f"❌ Erro na rota /chat: {str(erro)}")
        raise HTTPException(
            status_code=500,
            detail=str(erro)
        )


@app.post("/reset")
async def apagar_historico(request: Request):
    request.session["chat_historico"] = []
    return {"status": "success"}


@app.post("/limpar-historico")
async def limpar_historico(request: Request):
    request.session["chat_historico"] = []
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
