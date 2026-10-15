# Présidentielle 2027 : l'écologie dans les tweets des candidats

Pipeline en trois étapes :

1. **fetch** : extraction des tweets des candidats via l'API X v2 (timelines, pagination, incrémental).
2. **classify** : codage de chaque tweet selon une grille inspirée de l'analyse critique du discours
   (van Dijk) : écologie oui/non, centralité, thèmes, position, cadrage, polarisation Nous/Eux,
   adversaire, victime, acte de discours, registre, chiffres, réactivité, autorité.
   Deux moteurs : **Jev** (TypeSafe, modèle de décision, probabilités calibrées) sur tous les tweets,
   **Claude** (sortie structurée) sur les tweets écologie et les décisions peu sûres, pour le lexique,
   les implicites et le résumé.
3. **report** : CSV détaillé, synthèses par candidat et par thème, tableaux croisés CDA, série
   hebdomadaire, rapport Markdown et JSON pour le site.

Le protocole complet (hypothèses, corpus, fiabilité, plan d'analyse) est dans `docs/METHODOLOGIE.md`.

## Installation

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # puis renseigner X_BEARER_TOKEN et ANTHROPIC_API_KEY
```

Les commandes s'exécutent avec `PYTHONPATH=src` (ou après `pip install -e .`).

## Utilisation

```bash
export PYTHONPATH=src

# 1. Extraire les 30 derniers jours (100 tweets par page, pagination automatique)
python -m presidentielle fetch --days 30

# 2. Classifier les tweets non traités
python -m presidentielle classify                       # hybride : Jev puis Claude (défaut)
python -m presidentielle classify --engine jev          # Jev seul (rapide, quasi gratuit)
python -m presidentielle classify --engine claude       # Claude seul
python -m presidentielle classify --mode batch          # appels Claude via l'API Batches, moitié prix
python -m presidentielle classify --dry-run             # combien de tweets restent à traiter

# 3. Générer les rapports dans data/reports/
python -m presidentielle report

# Tout enchaîner (usage cron / n8n)
python -m presidentielle run --days 7
```

Options utiles : `fetch --since 2026-09-01 --until 2026-10-01`, `fetch --candidate rglucks1`,
`fetch --max-pages 2` (limiter la consommation de quota), `classify --limit 50`,
`classify --collect msgbatch_xxx` (récupérer un batch soumis avec `--no-wait`).

Les extractions sont incrémentales : l'id du dernier tweet vu par candidat est stocké dans
`data/state/since_ids.json`. `fetch --full` ignore cet état.

## Candidats

`config/candidates.yaml` liste les candidats (nom, parti, handle X, statut). Les comptes
marqués `enabled: false` (candidats pressentis) sont ignorés. Le pipeline s'arrête avec un
message explicite si un handle n'existe pas : vérifier les handles avant le premier run.

## Grille de codage

Le livre de codes `src/presidentielle/codebook.py` est la source unique des variables : les questions
Jev et le prompt Claude en sont générés. Les définitions sont en anglais (langue principale de Jev),
les tweets restent en français.

| Bloc | Variables |
|---|---|
| Contenu | `parle_ecologie` (oui/non), `niveau` (aucun, secondaire, central), `themes` (14 thèmes, multi) |
| Position | `position` (favorable_transition, critique_ecologie, neutre, non_applicable) |
| Discours (CDA) | `cadrage` (urgence, opportunité économique, contrainte punitive, souveraineté, justice sociale, science, terroir, santé), `polarisation` (carré idéologique), `adversaire`, `victime`, `acte_discursif`, `registre`, `chiffres`, `reactivite`, `autorite` |
| Sémantique locale (Claude) | `nous`, `eux`, `lexique` (expressions citées), `implicites`, `resume`, `confiance` |

Règles clés : une critique de l'écologie (« écologie punitive », rejet des ZFE) compte comme un tweet
parlant d'écologie avec `position = critique_ecologie` ; l'énergie (nucléaire, prix, réseau) entre
dans le périmètre ; les métaphores (« climat politique ») sont exclues.

### Moteurs et routage

- **Jev** (`jev-latest`, modifiable via `JEV_MODEL`) : un appel par tweet, 26 questions en parallèle.
  Chaque réponse porte une distribution de probabilités et une confiance calibrée, conservées dans
  `classifications.jsonl` sous la clé `jev`.
- **Claude** (`claude-opus-5-5`, effort `low`, system prompt en cache ; modifiable via `CLAUDE_MODEL`
  ou `--model`) : en mode hybride, traite les tweets écologie et les décisions Jev peu sûres
  (p(écologie) entre 0,3 et 0,7, ou confiance < 0,6 sur position, cadrage ou centralité).
- Valeur finale : Jev, sauf décision peu sûre (Claude). `final_source` indique l'origine ;
  `accord_ecologie` et `accord_position` mesurent l'accord entre moteurs.

### Coût par tweet (ordres de grandeur, tarifs d'octobre 2026)

| Poste | Hypothèse | Coût |
|---|---|---|
| X API, lecture | 0,005 $ par post lu (pay-per-use) | 0,005 $ |
| Jev | ~2 000 tokens d'entrée à 0,042 $/M, sortie gratuite | 0,0001 $ |
| Claude, tweets écologie ou peu sûrs (~30 %) | ~1 600 tokens d'entrée dont 1 300 en cache, ~350 de sortie, Opus 5.5 | 0,009 $ par tweet traité, soit 0,003 $ en moyenne |
| **Total** | | **~0,008 $ par tweet** |

Pour 23 comptes à ~4 posts originaux par jour (~100 tweets/jour), la collecte quotidienne revient à
environ 25 $ par mois, dont 15 $ pour l'API X. Un rattrapage de septembre et octobre 2026 (~5 000 tweets)
coûte environ 40 $. L'ensemble de l'étude jusqu'au second tour (~20 000 tweets) : 150 à 200 $,
l'API X représentant plus de la moitié. Le mode batch de Claude divise sa part par deux.

## Sorties

| Fichier | Contenu |
|---|---|
| `data/raw/tweets.jsonl` | tweets bruts normalisés (texte complet, métriques, URL) |
| `data/classified/classifications.jsonl` | une ligne par tweet classifié (jamais reclassifié) |
| `data/reports/tweets_classifies.csv` | jointure tweets + classification |
| `data/reports/synthese_candidats.csv` | par candidat : part de tweets écologie, niveau central, positions, top thèmes, engagement comparé |
| `data/reports/synthese_themes.csv` | par thème : volume et principaux candidats |
| `data/reports/serie_hebdomadaire.csv` | tweets et part écologie par candidat et par semaine |
| `data/reports/synthese.md` | rapport lisible, avec tableaux croisés cadrage, polarisation, adversaire |
| `data/reports/site_data.json` | données du site de visualisation (synthèses, séries, tweets écologie) |

## API X : quotas

Depuis 2026 l'API X est facturée à l'usage (environ 0,005 $ par post lu) ; les anciens niveaux Basic
et Pro ne sont plus proposés. La timeline d'un compte (`GET /2/users/:id/tweets`) ne remonte pas
au-delà des 3 200 derniers posts : pour les comptes très actifs, le rattrapage historique doit être
lancé sans attendre. Le client gère les réponses 429 en attendant la réinitialisation indiquée par
`x-rate-limit-reset`. Pour limiter la consommation, utiliser `--max-pages` et la fenêtre `--days` la
plus courte possible ; les réponses et retweets sont exclus par défaut.

## Intégration n8n

Un nœud *Execute Command* (ou *Schedule Trigger* + *Execute Command*) suffit :

```bash
cd /chemin/vers/french-presidential-2027 && PYTHONPATH=src .venv/bin/python -m presidentielle run --days 1
```

Les CSV de `data/reports/` peuvent ensuite être lus par un nœud *Read Binary File* / *Spreadsheet File*
et poussés vers Monday, Slack ou Google Sheets.

## Tests

```bash
python -m pytest -q
```

Les tests utilisent des réponses API simulées et un échantillon fictif (`data/sample/`,
candidats imaginaires) ; aucun appel réseau.
