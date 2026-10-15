"""Prompts Claude, générés depuis le livre de codes. Le prompt système est stable (cache)."""

from . import codebook as cb


def _variable_block(var: cb.Variable) -> str:
    head = {"noul": "true/false", "choice": "one value", "score": "one level, ordered low to high",
            "multi": "list of all values that apply"}[var.kind]
    scope = " Only for ecology tweets." if var.scope == "ecologie" else ""
    lines = [f"- {var.key} ({head}).{scope} {var.instructions}"]
    lines += [f"    - {o.key}: {o.description}" for o in var.options]
    return "\n".join(lines)


def build_system_prompt() -> str:
    sections = []
    for fw in cb.FRAMEWORKS:
        variables = [v for v in cb.VARIABLES if v.framework == fw.key]
        if variables:
            sections.append(f"## {fw.label} ({fw.auteurs})\n" + "\n".join(_variable_block(v) for v in variables))
    text_fields = "\n".join(f"- {k}: {d}" for k, d in cb.TEXT_FIELDS.items())
    return f"""Tu es un analyste du discours politique, formé à l'analyse critique du discours (van Dijk, Wodak, Fairclough, van Leeuwen) et spécialiste des politiques environnementales et énergétiques françaises.

Tâche : pour chaque tweet d'un candidat à l'élection présidentielle française de 2027, remplir la grille de codage ci-dessous. Les définitions sont en anglais (grille partagée avec un modèle de décision) ; les champs textuels sont à rédiger en français.

{chr(10).join(sections)}

## Champs textuels (sémantique locale)
{text_fields}

## Règles
1. Une critique de l'écologie (« écologie punitive », rejet des ZFE, des éoliennes, du Green Deal) PARLE d'écologie : parle_ecologie = true, position = critique_ecologie.
2. Le prix de l'énergie, la facture d'électricité, le nucléaire et le réseau électrique entrent dans le périmètre.
3. Les métaphores (« climat politique », « énergie de la jeunesse ») ne comptent pas comme écologie.
4. Si parle_ecologie est false : niveau = aucun, themes = [], position = non_applicable, cadrage = non_applicable, retardement = [], vision = non_applicable. Toutes les autres variables sont renseignées pour tous les tweets.
5. Pour les listes, ne retiens que ce qui est clairement présent dans le texte ; une liste vide est une réponse valable.
6. Code ce que le tweet dit, pas ce que tu sais du candidat.

Réponds uniquement avec l'objet JSON demandé."""


SYSTEM_PROMPT = build_system_prompt()


def user_message(tweet: dict) -> str:
    return (
        f"Candidat : {tweet.get('candidate')} ({tweet.get('party')}, @{tweet.get('handle')})\n"
        f"Date : {tweet.get('created_at')}\n"
        f"Tweet :\n\"\"\"\n{tweet.get('text', '')}\n\"\"\""
    )
