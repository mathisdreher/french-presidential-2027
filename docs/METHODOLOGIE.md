# Protocole d'étude : l'écologie dans le discours X des candidats à la présidentielle 2027

Version 0.1 (octobre 2026). Document de travail : les sections marquées « à décider » dépendent des choix du porteur de l'étude.

## 1. Question de recherche et hypothèses

**Question générale.** Comment les candidats à l'élection présidentielle française de 2027 parlent-ils d'écologie sur X : avec quelle intensité, sur quels thèmes, avec quels cadrages et quelles stratégies discursives, et comment cela évolue-t-il au fil de la campagne ?

**Hypothèses pré-enregistrées** (à figer avant la première analyse, pour éviter l'ajustement a posteriori) :

- H1 (saillance) : la part de tweets consacrés à l'écologie est inférieure à 15 % pour la majorité des candidats et augmente lors d'événements exogènes (COP31, épisodes climatiques, débats budgétaires sur l'énergie).
- H2 (cadrage par camp) : les candidats de droite et d'extrême droite cadrent l'écologie majoritairement comme contrainte (« écologie punitive ») ou comme souveraineté énergétique ; les candidats de gauche et écologistes comme urgence, justice sociale ou opportunité économique.
- H3 (énergie plutôt que climat) : à droite, le thème « prix de l'énergie et nucléaire » domine le thème « climat » ; l'inverse à gauche.
- H4 (carré idéologique) : les tweets écologie des candidats critiques de l'écologie présentent plus souvent une « présentation négative d'autrui » (écologistes, Bruxelles) que les tweets des candidats favorables à la transition, qui recourent davantage à l'autoprésentation positive.
- H5 (engagement) : les tweets écologie à registre alarmiste ou indigné obtiennent plus d'engagement (likes, reposts) que les tweets écologie factuels, quel que soit le camp.

## 2. Cadre théorique : analyse critique du discours (van Dijk)

L'approche socio-cognitive de Teun A. van Dijk articule discours, cognition et société. Trois idées structurent la grille :

1. **Macrostructures sémantiques** : de quoi parle le texte (sujets, hiérarchie des sujets). Opérationnalisé par `parle_ecologie`, `niveau` (centralité) et `themes`.
2. **Sémantique locale et lexicalisation** : choix des mots, implicites, présupposés, niveau de précision, chiffres. Opérationnalisé par `lexique` (expressions marquées citées), `implicites`, `chiffres`, `autorite`.
3. **Carré idéologique** : accentuer nos bons côtés et leurs mauvais côtés, atténuer nos mauvais côtés et leurs bons côtés. Opérationnalisé par `polarisation`, `adversaire`, `victime`, `nous`, `eux`.

S'y ajoutent les actes de discours dominants (`acte_discursif`), le registre émotionnel (`registre`), le cadrage (`cadrage`, au sens de l'analyse de cadres d'Entman, compatible avec la CDA) et l'ancrage dans l'actualité (`reactivite`), qui renvoie aux modèles de contexte de van Dijk.

Références : van Dijk, T. A. (1998). *Ideology: A Multidisciplinary Approach*. Sage. — van Dijk, T. A. (2006). Discourse and manipulation. *Discourse & Society*, 17(3). — van Dijk, T. A. (2008). *Discourse and Context*. Cambridge University Press. — Entman, R. (1993). Framing: Toward clarification of a fractured paradigm. *Journal of Communication*, 43(4). — Krippendorff, K. (2018). *Content Analysis*. Sage.

Mise en garde méthodologique : la CDA est une démarche interprétative et qualitative. Le codage automatisé produit une **analyse de contenu quantitative guidée par la CDA**, qui doit être complétée par une lecture rapprochée d'un échantillon raisonné de tweets (section 6).

## 3. Corpus

**Unités.** Un tweet (post) original d'un compte officiel de candidat. Les réponses et reposts sont exclus par défaut : ils relèvent d'une autre énonciation (conversation, relais). Les citations (quote tweets) sont conservées, le texte cité n'est pas analysé.

**Population.** Les candidats déclarés ou investis à la date du gel de la liste, plus les candidats pressentis explicitement suivis (Villepin). Liste et critères dans `config/candidates.yaml`. Tout ajout ou retrait est daté dans le fichier.

**Période (proposition).**

| Phase | Dates | Intérêt |
|---|---|---|
| Référence | 1er septembre 2026 → 31 décembre 2026 | Rentrée politique, budget 2027, COP31 (Antalya, 9-20 novembre 2026), prix de l'énergie à l'entrée de l'hiver |
| Pré-campagne | 1er janvier 2027 → publication de la liste officielle (début avril 2027) | Programmes, parrainages, primaires terminées |
| Campagne officielle | liste officielle → 16 avril 2027 (fin de campagne 1er tour) | Temps de parole encadré, débats |
| 1er tour et entre-deux-tours | 18 avril → 2 mai 2027 | Recentrage sur les deux finalistes |

Contrainte technique : l'API X ne restitue que les 3 200 posts les plus récents par compte. Les comptes très actifs (plus de 20 posts par jour) ne permettent donc pas de remonter au 1er septembre 2026 si l'extraction commence tard. Il faut lancer le rattrapage historique immédiatement, puis la collecte quotidienne.

**Exclusions documentées.** Tweets en langue autre que le français (conservés mais signalés via `lang`), tweets sans texte (image seule), tweets supprimés après collecte (conservés avec la date de collecte).

## 4. Instrument de codage

Le livre de codes (`src/presidentielle/codebook.py`) est la source unique des variables, de leurs valeurs et de leurs définitions. Il est rendu en Markdown dans le rapport et sur le site.

Deux moteurs appliquent la même grille :

- **Jev (TypeSafe), modèle de décision.** Un appel par tweet, toutes les questions en parallèle. Chaque variable catégorielle est une question typée (oui/non, choix, échelle ordonnée) avec une distribution de probabilités et une confiance calibrée. Jev ne produit pas de texte.
- **Claude, modèle de langage.** Même grille en sortie structurée, plus les champs textuels de sémantique locale (`lexique`, `implicites`, `nous`, `eux`, `resume`).

**Routage.** Jev traite 100 % des tweets. Claude traite les tweets classés écologie (pour le lexique et les implicites) et les tweets sur lesquels Jev est peu sûr (probabilité écologie entre 0,3 et 0,7, ou confiance inférieure à 0,6 sur position, cadrage ou centralité). Quand les deux moteurs ont codé un tweet, la valeur finale est celle de Jev, sauf décision peu sûre, auquel cas c'est celle de Claude. L'origine de chaque valeur finale est conservée (`final_source`).

**Langue.** La langue d'entraînement principale de Jev est l'anglais ; les instructions du livre de codes sont donc en anglais, les tweets restent en français. L'étape de validation (section 5) mesure l'effet de ce choix.

## 5. Fiabilité et validité

1. **Échantillon de validation humaine.** Tirage aléatoire stratifié par candidat de 300 tweets (plus un sur-échantillonnage de 100 tweets classés écologie par Jev). Deux codeurs humains codent indépendamment les variables catégorielles avec le livre de codes, sans voir les sorties des modèles. À décider : qui sont les codeurs.
2. **Accord inter-codeurs.** Alpha de Krippendorff par variable (nominal pour les choix, ordinal pour `niveau` et `registre`). Seuil d'acceptation : 0,67 pour une variable exploratoire, 0,80 pour les variables centrales (`parle_ecologie`, `position`, `cadrage`). Les désaccords sont arbitrés en réunion et le livre de codes est amendé (version datée).
3. **Accord modèle-humain.** Mêmes métriques entre la référence humaine arbitrée et chaque moteur (Jev seul, Claude seul, routage hybride). Matrice de confusion par variable pour identifier les catégories confondues et reformuler leurs descriptions.
4. **Calibration de Jev.** Diagramme de fiabilité : parmi les tweets où Jev annonce p(écologie) ≈ 0,7, environ 70 % doivent être écologie selon la référence humaine. Une calibration dégradée en français justifierait d'abaisser le seuil de routage vers Claude.
5. **Accord inter-moteurs.** Taux d'accord Jev/Claude sur `parle_ecologie` et `position`, suivi dans le temps : une dérive signale un changement de modèle ou de corpus.
6. **Stabilité.** Re-codage d'un échantillon de 100 tweets à un mois d'intervalle avec la même version de modèle (fidélité test-retest).

## 6. Plan d'analyse

**Descriptif.** Part de tweets écologie par candidat et par phase ; distribution des thèmes, cadrages, positions ; série hebdomadaire avec marqueurs d'événements.

**Comparatif.** Tests du khi-deux (avec V de Cramér) sur les tableaux candidat × cadrage et camp × thème ; régression logistique de `parle_ecologie` sur le candidat, la phase et les événements exogènes ; modèle de comptage (binomiale négative) de l'engagement sur registre, cadrage, candidat et taille d'audience (H5).

**Qualitatif (CDA).** Pour chaque candidat, lecture rapprochée de 10 tweets écologie sélectionnés à dessein (les plus engageants, les plus typiques du cadrage dominant, les cas limites signalés par une confiance faible). Analyse du lexique marqué, des implicites, des désignations Nous/Eux et des stratégies de légitimation. Les extraits sont cités intégralement avec leur URL.

**Triangulation.** Confronter les résultats X aux programmes officiels et aux prises de parole longues (interviews, discours) sur un sous-ensemble, pour discuter la spécificité du média.

## 7. Limites

- X n'est pas le discours politique : il en est un fragment, sélectionné par les équipes de campagne pour une audience particulière.
- Les comptes sont gérés par des équipes ; l'auteur empirique n'est pas toujours le candidat.
- Les modèles encodent des biais ; la validation humaine en mesure l'ampleur, pas l'absence.
- Les métriques d'engagement dépendent de l'algorithme de X et de la taille d'audience ; elles sont comparées intra-candidat plutôt qu'inter-candidats.
- Les tweets supprimés et les comptes suspendus introduisent une attrition non aléatoire.

## 8. Reproductibilité

Code versionné, livre de codes daté, versions de modèles enregistrées dans chaque ligne de classification (`jev.model`, `claude.model`), données brutes conservées en JSONL, rapports régénérables à partir des données brutes et des classifications. Les clés API ne sont jamais dans le dépôt.
