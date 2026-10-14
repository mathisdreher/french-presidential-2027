# Présidentielle 2027 : l'écologie dans les tweets des candidats

Pipeline en trois étapes :

1. **fetch** : extraction des tweets des candidats via l'API X v2 (timelines, pagination, incrémental).
2. **classify** : classification de chaque tweet par Claude (sortie JSON structurée) : parle-t-il d'écologie, à quel niveau, sur quels thèmes, avec quelle position.
3. **report** : CSV détaillé, synthèse par candidat et par thème, rapport Markdown.

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
python -m presidentielle classify                 # appels immédiats
python -m presidentielle classify --mode batch    # API Batches, moitié prix, résultats sous ~1 h
python -m presidentielle classify --dry-run       # combien de tweets restent à traiter

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

## Classification

Schéma de sortie (`src/presidentielle/schema.py`), validé par Claude via les sorties structurées :

| Champ | Valeurs |
|---|---|
| `parle_ecologie` | `true` / `false` |
| `niveau` | `aucun`, `secondaire`, `central` |
| `themes` | 1 à 3 parmi : climat, energie_nucleaire, energies_renouvelables, prix_energie_reseau, sobriete_efficacite, transports_mobilite, biodiversite_nature, agriculture_alimentation, pollution_sante, eau, industrie_verte_emploi, fiscalite_normes, international_europe, autre_ecologie |
| `position` | `favorable_transition`, `critique_ecologie`, `neutre`, `non_applicable` |
| `resume` | une phrase de justification |
| `confiance` | `faible`, `moyenne`, `elevee` |

Règles clés du prompt (`src/presidentielle/prompts.py`) : une critique de l'écologie (« écologie
punitive », rejet des ZFE) compte comme un tweet parlant d'écologie avec `position = critique_ecologie` ;
l'énergie (nucléaire, prix, réseau) entre dans le périmètre ; les métaphores (« climat politique ») sont exclues.

Modèle par défaut : `claude-opus-5-5` avec effort `low` (tâche de classification courte).
Modifiable via `CLAUDE_MODEL` ou `--model`. Le system prompt est mis en cache (prompt caching),
ce qui réduit fortement le coût des appels répétés.

Ordre de grandeur de coût : environ 600 tokens d'entrée (dont ~450 en cache) et ~100 tokens de
sortie par tweet, soit de l'ordre de 0,003 $ par tweet en mode sync et la moitié en mode batch.

## Sorties

| Fichier | Contenu |
|---|---|
| `data/raw/tweets.jsonl` | tweets bruts normalisés (texte complet, métriques, URL) |
| `data/classified/classifications.jsonl` | une ligne par tweet classifié (jamais reclassifié) |
| `data/reports/tweets_classifies.csv` | jointure tweets + classification |
| `data/reports/synthese_candidats.csv` | par candidat : part de tweets écologie, niveau central, positions, top thèmes, engagement comparé |
| `data/reports/synthese_themes.csv` | par thème : volume et principaux candidats |
| `data/reports/synthese.md` | rapport lisible |

## API X : quotas

La lecture des timelines (`GET /2/users/:id/tweets`) exige au moins le niveau **Basic** de
l'API X (le niveau Free ne couvre pas la lecture en volume). Le client gère les réponses 429 en
attendant la réinitialisation indiquée par `x-rate-limit-reset`. Pour limiter la consommation,
utiliser `--max-pages` et la fenêtre `--days` la plus courte possible ; les réponses et retweets
sont exclus par défaut.

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
