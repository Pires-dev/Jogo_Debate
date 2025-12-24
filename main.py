from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
import os
import requests
import uvicorn

CHAT_HISTORICO = []

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    f"models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
)

PERSONA_DEBATEDOR = (
    "So comece a falar quando o usuario mandar um argumento, uma opinião, uma pergunta etc.. "
    "Você é um debatedor profissional conhecido como 'O rei do argumento e ironia'. "
    "Extremamente sarcástico, cético, teimoso e ranzinza. "
    "Seu objetivo é discordar do usuário, encontrar falhas lógicas, mas se o argumento for muito bom voce aceita que foi refutado e diz que o usuario ganhou, de forma ironica claro. "
    "e faça contra argumentos de forma confiante e provocativa. "
    "Use ironia e referências algumas vezes da cultura pop, seja muito dificil de ser convencido. "
    "Responda de forma concisa (maximo de 2/3 de um paragrafo). "
    "Humilhe"
)


def get_Resposta_IA(chat_history: list) -> str:
    if not GEMINI_API_KEY:
        return "Erro interno: API Key não configurada."

    instrucao_IA = {
        "role": "user",
        "parts": [{"text": PERSONA_DEBATEDOR}]
    }

    requisicao_API = {
        "contents": [instrucao_IA] + chat_history,
        "generationConfig": {
            "temperature": 0.8,
            "topP": 0.95,
            "topK": 40
        }
    }

    try:
        resposta = requests.post(API_URL, json=requisicao_API, timeout=30)
        resposta.raise_for_status()
        dados = resposta.json()
        return dados["candidates"][0]["content"]["parts"][0]["text"]

    except requests.exceptions.RequestException:
        return "Erro de comunicação com a IA."
    except (KeyError, IndexError):
        return "Erro ao processar resposta da IA."


app = FastAPI(
    title="Debate Arena API",
    description="API para o jogo Advogado do Diabo com IA",
    version="1.0.0"
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
async def processar_debate(dados_usuario: requisicaoUsuario):
    try:
        txt_usuario = dados_usuario.message.strip()
        global CHAT_HISTORICO

        CHAT_HISTORICO.append({
            "role": "user",
            "parts": [{"text": txt_usuario}]
        })

        resposta_ia = get_Resposta_IA(CHAT_HISTORICO)

        CHAT_HISTORICO.append({
            "role": "model",
            "parts": [{"text": resposta_ia}]
        })

        return requisicaoIA(
            user_message=txt_usuario,
            ai_response=resposta_ia,
            status="success"
        )

    except Exception as erro:
        raise HTTPException(
            status_code=500,
            detail=str(erro)
        )


@app.post("/reset")
async def apagar_historico():
    global CHAT_HISTORICO
    CHAT_HISTORICO = []
    return {"status": "success"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
