# Présidentielle 2027 : l'écologie dans les tweets des candidats

Observatoire du discours écologique des candidats à l'élection présidentielle 2027 sur X.

1. **Collecte** (`fetch`) : tweets originaux des comptes de `config/candidates.yaml` via l'API X.
   Tout compte jamais collecté est rattrapé depuis le début de l'étude (1er septembre 2026) par la
   recherche full-archive, sans plafond de volume ; ensuite, collecte incrémentale quotidienne.
2. **Codage** (`classify`) selon une grille inspirée de l'analyse critique du discours (van Dijk) :
   écologie oui/non, centralité, thèmes, position, cadrage, polarisation Nous/Eux, adversaire,
   victime, acte de discours, registre, chiffres, réactivité, autorité.
   - **Jev** (TypeSafe), modèle de décision, code chaque jour tous les nouveaux tweets et renvoie
     des probabilités calibrées.
   - **Claude** est déclenché à la demande : décisions incertaines de Jev, tweets écologie (relevé
     du lexique et des implicites), échantillon de validation, ou tout le corpus.
3. **Validation** (`validate`) : accord Jev / Claude (taux d'accord, kappa de Cohen, alpha de
   Krippendorff), calibration de Jev.
4. **Publication** (`report`, `site`) : CSV, synthèse Markdown, et site statique sur GitHub Pages.

Le protocole (hypothèses, corpus, période, fiabilité, plan d'analyse) est dans `docs/METHODOLOGIE.md`.

## Mise en route

### 1. Clés d'API

| Secret | Où l'obtenir | Utilisé par |
|---|---|---|
| `X_BEARER_TOKEN` | developer.x.com, projet avec facturation à l'usage | collecte quotidienne |
| `TYPESAFE_API_KEY` | console.typesafe.ai (accès anticipé à Jev) | collecte quotidienne |
| `ANTHROPIC_API_KEY` | console.anthropic.com | codage Claude à la demande |

Dans GitHub : *Settings > Secrets and variables > Actions > New repository secret*, une entrée par
clé. Variables facultatives (même écran, onglet *Variables*) : `JEV_MODEL` (défaut `jev-latest`),
`CLAUDE_MODEL` (défaut `claude-opus-5-5`).

### 2. GitHub Pages

*Settings > Pages > Build and deployment > Source : GitHub Actions*. Le dépôt étant privé,
GitHub Pages nécessite un compte GitHub Pro (ou Team / Enterprise). Le site publié est public.

### 3. Premier passage

*Actions > Collecte quotidienne > Run workflow*. Le premier passage rattrape tous les tweets depuis
le 1er septembre 2026, les code avec Jev et publie le site. Les passages suivants ont lieu chaque
jour à 05:17 UTC.

## Tâches automatiques (GitHub Actions)

| Workflow | Déclenchement | Ce qu'il fait |
|---|---|---|
| **Collecte quotidienne** | chaque jour à 05:17 UTC, ou à la main | collecte X, codage Jev, récupération des batches Claude terminés, validation, rapports, site |
| **Codage Claude (à la demande)** | à la main uniquement | codage Claude sur la portée choisie, puis validation, rapports, site |
| **Publier le site** | modification du site, du livre de codes ou de la configuration | republie le site à partir des données enregistrées |
| **Tests** | chaque push | tests unitaires et vérification de la syntaxe du site |

Les données (`data/raw`, `data/classified`, `data/state`, `data/reports`) sont enregistrées dans le
dépôt par un commit automatique après chaque passage, ce qui rend la collecte incrémentale.

### Lancer Claude

*Actions > Codage Claude (à la demande) > Run workflow*, depuis le navigateur ou l'application
GitHub mobile. Paramètres :

| Portée | Tweets envoyés à Claude |
|---|---|
| `ecologie_et_incertains` | tweets classés écologie par Jev et décisions Jev incertaines |
| `incertains` | uniquement les décisions incertaines (p(écologie) entre 0,3 et 0,7, ou confiance < 0,6 sur position, cadrage ou centralité) |
| `echantillon` | échantillon de validation : tirage aléatoire stratifié par candidat, plus un sur-échantillon de tweets écologie ; persistant, il peut être agrandi |
| `tous` | tous les tweets non encore codés par Claude |

Un tweet n'est jamais envoyé deux fois à Claude. En mode `batch` (moitié prix), si le traitement
dépasse quatre heures, la collecte quotidienne récupère automatiquement les résultats.

## Utilisation locale

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # puis renseigner les clés
export PYTHONPATH=src

python -m presidentielle fetch                    # rattrapage puis incrémental
python -m presidentielle classify                 # Jev sur les tweets non codés
python -m presidentielle classify --engine claude --scope echantillon --sample-size 300 --mode batch
python -m presidentielle classify --engine claude --scope incertains --dry-run
python -m presidentielle validate                 # accord Jev / Claude
python -m presidentielle report                   # CSV et synthèse Markdown
python -m presidentielle site                     # site dans _site/ (ouvrir avec un serveur local)
python -m presidentielle daily                    # tout l'enchaînement quotidien
```

Options utiles : `fetch --candidate rglucks1`, `fetch --backfill` (refaire le rattrapage, doublons
ignorés), `fetch --since 2026-10-01 --until 2026-10-08`, `classify --limit 50`,
`classify --collect-pending` (batches Claude non récupérés).

## Configuration

- `config/candidates.yaml` : candidats, parti, famille politique (`bloc`), handle X, statut.
  `enabled: false` exclut un compte. Le pipeline s'arrête avec un message explicite si un handle
  n'existe pas. Le rattachement à une famille politique est un choix de codage à valider.
- `config/study.yaml` : date de début, phases de la campagne, événements affichés sur les séries,
  familles politiques.
- `src/presidentielle/codebook.py` : livre de codes, source unique des questions Jev, du prompt
  Claude, du schéma de sortie et des libellés du site.

## Grille de codage

| Bloc | Variables |
|---|---|
| Contenu | `parle_ecologie` (oui/non), `niveau` (aucun, secondaire, central), `themes` (14 thèmes) |
| Position | `position` (favorable_transition, critique_ecologie, neutre, non_applicable) |
| Discours (CDA) | `cadrage`, `polarisation` (carré idéologique), `adversaire`, `victime`, `acte_discursif`, `registre`, `chiffres`, `reactivite`, `autorite` |
| Sémantique locale (Claude) | `nous`, `eux`, `lexique` (expressions citées), `implicites`, `resume`, `confiance` |

Règles clés : une critique de l'écologie (« écologie punitive », rejet des ZFE) est un tweet écologie
avec `position = critique_ecologie` ; l'énergie (nucléaire, prix, réseau) entre dans le périmètre ;
les métaphores (« climat politique ») sont exclues. Les définitions sont en anglais, langue
principale de Jev ; les tweets restent en français.

## Coûts estimés

Hypothèse : 21 comptes, environ 100 tweets originaux par jour au total, à affiner après le premier
passage. Tarifs d'octobre 2026 : X environ 0,005 $ par post lu, Jev 0,042 $ par million de tokens
d'entrée (sortie gratuite, ~2 300 tokens par tweet), Claude Opus 5.5 (~3 100 tokens d'entrée en
cache, ~600 de sortie avec réflexion, soit ~0,013 $ par tweet, ~0,007 $ en batch).

| Poste | Rattrapage sept.-oct. (~4 500 tweets) | Par mois (~3 000 tweets) | Étude jusqu'au 2nd tour (~25 000 tweets) |
|---|---|---|---|
| API X | ~23 $ | ~15 $ | ~125 $ |
| Jev | < 1 $ | < 1 $ | ~3 $ |
| GitHub Actions | 0 $ | 0 $ (~150 min sur 2 000 gratuites) | 0 $ |
| Claude, échantillon de 300 (batch) | | | ~2 $ |
| Claude, écologie et incertains (~25 %, batch) | ~8 $ | ~5 $ | ~45 $ |
| Claude, tout le corpus (batch) | ~32 $ | ~21 $ | ~175 $ |

Hors GitHub Pro si nécessaire pour Pages sur un dépôt privé.

## Sorties

| Fichier | Contenu |
|---|---|
| `data/raw/tweets.jsonl` | tweets bruts normalisés (texte complet, métriques, URL) |
| `data/classified/classifications.jsonl` | une ligne par tweet : codage Jev (probabilités, confiances), codage Claude, valeurs finales et leur source |
| `data/state/` | curseurs de collecte, comptes résolus, batches Claude, échantillon de validation |
| `data/reports/tweets_classifies.csv` | jointure tweets et codage |
| `data/reports/synthese_candidats.csv` | par candidat : part écologie, positions, cadrage dominant, polarisation, adversaire principal, engagement |
| `data/reports/synthese_themes.csv`, `serie_hebdomadaire.csv` | par thème ; par candidat et par semaine |
| `data/reports/synthese.md` | rapport lisible avec tableaux croisés |
| `data/reports/validation.json`, `validation.md` | accord Jev / Claude, calibration |

## Site

Le site (`site/`, HTML, CSS et JavaScript sans dépendance) lit `data.json` et calcule les agrégats
dans le navigateur. Filtres : période (fenêtres glissantes et phases de campagne), famille
politique, candidat mis en avant. Vues : part de tweets écologie par candidat, position
(barres divergentes), évolution hebdomadaire, thèmes et cadrages, carré idéologique, explorateur de
tweets écologie, fiabilité du codage, méthode et livre de codes. Chaque graphique a une vue
tableau ; mode clair et sombre. Seul le texte des tweets écologie est publié.

## Tests

```bash
python -m pytest -q
```

Les tests utilisent des réponses API simulées et un échantillon fictif (`data/sample/`, candidats
imaginaires) ; aucun appel réseau.
