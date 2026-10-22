"""Asesor: combina la señal técnica del modelo ML con datos externos
(sentimiento de mercado y noticias) para un consejo final matizado.

Sigue siendo SOLO orientativo y educativo, nunca una recomendación de inversión.
"""
from . import config, external, ml, social as social_mod


def _dir_word(score: float) -> str:
    return "alcista" if score > 0.15 else "bajista" if score < -0.15 else "neutral"


async def advise(iid: str, interval: str = "1h") -> dict:
    tech = await ml.predict(iid, interval)
    inst = config.instrument(iid) or {}
    category = inst.get("category", "cripto")

    # Técnico -> escala -1..1
    t_score = (tech["probabilityUp"] - 50) / 50.0

    # Sentimiento externo
    fng = await external.get_fear_greed() if category == "cripto" else None
    news = await external.get_news(iid)

    social = await social_mod.get_social(iid)
    social_s = social_mod.social_score(social)

    ext_parts = []
    if fng is not None:
        ext_parts.append((fng["value"] - 50) / 50.0)  # codicia positivo
    ext_parts.append(news["sentiment"]["score"])  # -1..1
    if social_s is not None:
        ext_parts.append(social_s)  # atención social -1..1
    ext_score = sum(ext_parts) / len(ext_parts) if ext_parts else 0.0

    # Combinado (técnico pesa algo más)
    combined = 0.6 * t_score + 0.4 * ext_score
    combined01 = round((combined + 1) / 2 * 100, 1)

    t_dir = _dir_word(t_score)
    e_dir = _dir_word(ext_score)

    if combined > 0.15:
        verdict, bias = "Favorable", "alcista"
    elif combined < -0.15:
        verdict, bias = "Desfavorable", "bajista"
    else:
        verdict, bias = "Mixto · cautela", "neutral"

    if t_dir == e_dir and t_dir != "neutral":
        explanation = f"El análisis técnico y el sentimiento del mercado coinciden en sesgo {t_dir}."
    elif t_dir != "neutral" and e_dir != "neutral" and t_dir != e_dir:
        explanation = (
            f"El técnico apunta {t_dir} pero el sentimiento externo es {e_dir} → señales "
            "mixtas, conviene cautela."
        )
    elif t_dir != "neutral":
        explanation = f"El técnico apunta {t_dir}; el sentimiento externo es neutro."
    elif e_dir != "neutral":
        explanation = f"Sin señal técnica clara; el sentimiento externo es {e_dir}."
    else:
        explanation = "Ni el técnico ni el sentimiento muestran una dirección clara: lateral."

    if social.get("trending"):
        explanation += f" Además, está en tendencia de búsquedas (#{social['rank']}): mucha atención social."

    return {
        "symbol": iid,
        "interval": interval,
        "technical": tech,
        "fearGreed": fng,
        "news": news,
        "social": social,
        "combined": {
            "score": combined01,
            "verdict": verdict,
            "bias": bias,
            "explanation": explanation,
        },
        "disclaimer": (
            "Consejo orientativo que mezcla estadística técnica y sentimiento de noticias. "
            "No es asesoramiento financiero; el mercado real es impredecible."
        ),
    }
