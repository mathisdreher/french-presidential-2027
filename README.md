# L'écologie dans la campagne 2027 sur X

Un observatoire pédagogique : ce que les candidats à l'élection présidentielle 2027 publient sur X
à propos du climat, de l'énergie et de l'environnement, lu avec les outils de l'analyse critique et
socio-cognitive du discours. Le site s'adresse aux étudiants et aux citoyens curieux de recherche :
chaque théorie y est expliquée et sourcée, et trois jeux permettent de s'exercer.

## Ce que fait le projet

1. **Collecte.** Chaque jour, les tweets originaux des comptes personnels des candidats
   (`config/candidates.yaml`). Tout compte jamais collecté est rattrapé depuis le 1er septembre 2026
   par la recherche full-archive de l'API X, sans plafond.
2. **Codage.** Une grille de 19 variables tirée de onze cadres théoriques : macrostructures et carré
   idéologique (van Dijk), cadrage (Entman), topoï (Wodak), légitimation (van Leeuwen), discours de
   retardement climatique (Lamb et al.), visions de l'écologie (Dryzek), ethos (Maingueneau, Amossy),
   agentivité et modalité (Fairclough, Halliday), actes de discours et registre. Jev, un modèle de
   décision, code chaque jour tous les tweets. Claude est lancé à la demande comme second codeur.
3. **Analyses sans modèle.** Appropriation des enjeux (Petrocik), suivi des formules
   (Krieg-Planque, `config/formules.yaml`) et vocabulaire spécifique (lexicométrie, G² de Dunning).
4. **Site** sur GitHub Pages, en français et en anglais. Il s'ouvre sur l'onglet Jouer et ses trois
   jeux (« Qui a tweeté ? », « Classez comme un agent », « Où vous situez-vous ? »), puis Aperçu
   (fiches candidats, boussole écologique, graphiques), Discours (une fiche par théorie, avec
   exemples), Mots, Tweets et Méthode. Bulles d'info sourcées, photos des candidats, filtres par
   période et famille politique. Aucune donnée de visite ni de jeu n'est enregistrée.

La boussole écologique place chaque candidat selon deux axes calculés sur ses tweets écologie : la
position moyenne (favorable +1, critique −1) et le rapport à la croissance tiré des visions de Dryzek
(`VISION_GROWTH_SCORE` dans le livre de codes). C'est un indice construit pour le site, expliqué
comme tel dans sa bulle d'info.

Le livre de codes `src/presidentielle/codebook.py` est la source unique : questions de Jev, prompt et
schéma de Claude, mesures d'accord, libellés et bulles du site.

### Version anglaise

Le bouton FR / EN de l'en-tête bascule la langue ; `?lang=en` ouvre directement la version anglaise.
Les textes viennent de trois endroits :

| Contenu | Fichier |
|---|---|
| Textes d'interface | `site/i18n.js` |
| Cadres théoriques, variables et catégories | `src/presidentielle/codebook_en.py` |
| Phases, familles, événements, questions, formules, partis | champs `*_en` des fichiers de `config/` |

Les tweets restent en français. Pour les jeux, Claude traduit chaque tweet anonymisé et ses indices
lors de l'étape `games` ; tant qu'un tweet n'est pas traduit, la version anglaise l'affiche en
français avec une mention. Un test vérifie que les deux langues ont les mêmes clés et que chaque clé
utilisée par `site/app.js` existe.

## Mise en route

Le dépôt de code est public. Les tweets bruts vont dans un second dépôt **privé**, car les conditions
développeur de X limitent la redistribution des tweets.

1. **Rendre ce dépôt public** : Settings > General > Danger Zone > Change visibility.
2. **Créer le dépôt de données privé** `french-presidential-2027-data`, en cochant « Add a README ».
   Un autre nom est possible : il faut alors le renseigner dans la variable `DATA_REPO`.
3. **Créer un jeton d'accès** : Settings du compte > Developer settings > Fine-grained tokens.
   Accès au seul dépôt de données, permission Contents en lecture et écriture, expiration d'un an.
4. **Ajouter les secrets** du dépôt public, dans Settings > Secrets and variables > Actions :

   | Secret | Rôle |
   |---|---|
   | `X_BEARER_TOKEN` | API X, facturation à l'usage |
   | `TYPESAFE_API_KEY` | Jev, codage quotidien |
   | `ANTHROPIC_API_KEY` | Claude, codage à la demande et jeux |
   | `DATA_REPO_TOKEN` | jeton de l'étape 3 |

5. **Activer GitHub Pages** : Settings > Pages > Source : GitHub Actions.
6. **Premier passage** : Actions > Collecte quotidienne > Run workflow.

**Sécurité des clés.** Les secrets GitHub sont chiffrés, masqués dans les journaux, et jamais transmis
aux workflows lancés depuis des forks. Utilisez des clés dédiées à ce projet, fixez un plafond de
dépenses dans chaque console, et ne collez jamais une clé dans un fichier ou une conversation.

## Workflows

| Workflow | Déclenchement | Rôle |
|---|---|---|
| Collecte quotidienne | chaque jour à 05:17 UTC, ou à la main | collecte, Jev, lots Claude terminés, validation, export, site |
| Codage Claude | à la main | Claude sur une portée : `ecologie_et_incertains`, `incertains`, `echantillon`, `jeux` ou `tous` |
| Publier le site | modification du code ou de la configuration | republie le site |
| Rafraîchir les photos | à la main | met à jour `config/photos.json` depuis Wikipédia et Commons |
| Tests | chaque push | tests et vérification du site |

## Utilisation locale

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
git clone https://github.com/<compte>/french-presidential-2027-data data
cp .env.example .env    # puis renseigner les clés

python -m presidentielle fetch          # collecte
python -m presidentielle classify       # Jev
python -m presidentielle classify --engine claude --scope echantillon --sample-size 300
python -m presidentielle games          # jeux : anonymisation et traduction anglaise par Claude
python -m presidentielle publish        # validation, export CSV, site dans _site/
python -m pytest -q
```

`python -m presidentielle --help` liste toutes les options.

## Coûts estimés

Hypothèse : 21 comptes, environ 100 tweets originaux par jour, soit 25 000 tweets jusqu'au second tour.

| Poste | Par mois | Étude complète |
|---|---|---|
| API X, environ 0,005 $ par tweet lu | ~15 $ | ~125 $ |
| Jev, environ 5 500 tokens par tweet à 0,042 $ par million | < 1 $ | ~6 $ |
| Claude en lot, écologie et décisions incertaines, environ 25 % des tweets | ~8 à 15 $ | ~60 à 120 $ |
| Claude, échantillon de validation de 300 tweets | | ~3 à 6 $ |
| Claude, préparation et traduction des jeux | | ~3 $ |
| GitHub Actions et Pages, dépôt public | 0 $ | 0 $ |
