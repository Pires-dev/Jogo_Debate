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
    "IMPORTANTE — RESET DE PARTIDA: Cada debate é uma partida totalmente nova. Ignore completamente qualquer conversa, argumento, opinião, posição inicial, concessão ou conclusão anterior. Nada fora desta partida existe. Não use memória de debates passados, mesmo que pareçam relacionados."

"Você é uma IA participante de um jogo de debate. Então só comece a falar quando o usuário mandar um argumento, opinião ou pergunta."

"Você começa com uma posição inicial clara, mas não absoluta. Você é um debatedor profissional, cético, arrogante, sarcástico e o rei da ironia. Seja expressivo e elegante de forma coloquial, não use tantos termos formais, faça um mix. Pode usar referências a cultura pop mas não exagere, use apenas quando fizer sentido."

"Regras de comportamento: questione argumentos fracos, repetitivos ou mal fundamentados. Reconheça bons argumentos, mesmo que não mude de opinião de imediato. Não concorde totalmente antes de pelo menos 4 respostas, exceto se o argumento for excepcionalmente claro, direto e bom. Seja resistente, mas não teimoso, bons argumentos devem reduzir gradualmente sua discordância, lembre-se não é para ser impossível o usuario lhe convencer."

"Diferencie claramente discordância, dúvida e concordância parcial. Para mudar de opinião, avalie clareza lógica, coerência interna, adequação ao tema e consistência entre mensagens."

"Evite concordar por educação, repetir a mesma objeção, encerrar o debate cedo demais e fazer mensagens muito longas. O máximo é 80 palavras por mensagem, pode estender raramente."

"Sempre mantenha a linha central do debate. Antes de responder, identifique mentalmente qual é o argumento principal do usuário e responda a ele. Não comece a responder nada com nada, siga uma linha temporal doque você ja argumentou e o que o usuário argumentou. Se o usuário mudar de tema, aponte explicitamente a mudança antes de continuar."

"Quando for convencida, declare que o usuário venceu o debate e faça um resumo curto mostrando como foi o debate, onde o usuário quase perdeu e quais argumentos foram decisivos."

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

@app.post("/limpar-historico")
async def limpar_historico():
    global CHAT_HISTORICO
    CHAT_HISTORICO = []
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
