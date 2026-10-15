# Protocole d'étude : l'écologie dans le discours X des candidats à la présidentielle 2027

Version 0.2 (octobre 2026). Document de travail.

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

**Période.** Du 1er septembre 2026 au second tour (2 mai 2027), découpée en quatre phases
(`config/study.yaml`) :

| Phase | Dates | Intérêt |
|---|---|---|
| Référence | 1er septembre → 31 décembre 2026 | Rentrée politique, budget 2027, COP31 (ouverture le 9 novembre 2026), prix de l'énergie à l'entrée de l'hiver |
| Pré-campagne | 1er janvier → 4 avril 2027 | Programmes, parrainages, liste officielle des candidats |
| Campagne officielle | 5 → 17 avril 2027 | Égalité de temps de parole, débats |
| 1er tour et entre-deux-tours | 18 avril → 2 mai 2027 | Recentrage sur les deux finalistes |

**Collecte.** Chaque compte est rattrapé intégralement depuis le 1er septembre 2026 par la recherche
full-archive de l'API X, sans plafond de volume (la timeline d'un compte est, elle, limitée aux
3 200 derniers posts). La collecte est ensuite quotidienne et incrémentale. Un compte ajouté en
cours d'étude est rattrapé de la même façon. Une collecte interrompue n'avance pas le curseur et
reprend au passage suivant, si bien qu'aucun intervalle n'est perdu.

**Exclusions documentées.** Tweets en langue autre que le français (conservés mais signalés via `lang`), tweets sans texte (image seule), tweets supprimés après collecte (conservés avec la date de collecte).

## 4. Instrument de codage

Le livre de codes (`src/presidentielle/codebook.py`) est la source unique des variables, de leurs valeurs et de leurs définitions. Il est rendu en Markdown dans le rapport et sur le site.

Deux moteurs appliquent la même grille :

- **Jev (TypeSafe), modèle de décision.** Un appel par tweet, toutes les questions en parallèle. Chaque variable catégorielle est une question typée (oui/non, choix, échelle ordonnée) avec une distribution de probabilités et une confiance calibrée. Jev ne produit pas de texte. Il code chaque jour tous les nouveaux tweets : c'est le codage de référence de l'étude.
- **Claude, modèle de langage.** Même grille en sortie structurée, plus les champs textuels de sémantique locale (`lexique`, `implicites`, `nous`, `eux`, `resume`). Il est déclenché à la demande, sur une portée choisie : décisions incertaines de Jev, tweets écologie, échantillon de validation, ou tout le corpus.

**Décisions incertaines.** Une décision Jev est incertaine quand la probabilité écologie est entre 0,3 et 0,7, ou quand la confiance est inférieure à 0,6 sur la position, le cadrage ou la centralité. Ces tweets sont signalés (`needs_claude`) et restent codés par Jev tant que Claude n'a pas été lancé. Quand les deux moteurs ont codé un tweet, la valeur finale est celle de Jev, sauf décision incertaine, auquel cas c'est celle de Claude. L'origine de chaque valeur finale est conservée (`final_source`) et affichée sur le site.

**Langue.** La langue d'entraînement principale de Jev est l'anglais ; les instructions du livre de codes sont donc en anglais, les tweets restent en français. L'étape de validation (section 5) mesure l'effet de ce choix.

## 5. Fiabilité et validité

La validation procède en trois temps.

1. **Jev seul.** Le codage quotidien repose sur Jev. Ses probabilités et confiances sont conservées pour chaque variable, ce qui permet de repérer et de compter les décisions incertaines.
2. **Claude comme second codeur, dans un second temps.** Un échantillon de validation est tiré une fois pour toutes (`data/state/validation_sample.json`) : strate aléatoire stratifiée par candidat à allocation égale (75 %), plus un sur-échantillon de tweets classés écologie par Jev (25 %) pour disposer d'assez de cas sur la position et le cadrage. Claude code cet échantillon sans voir le codage de Jev. L'échantillon peut être agrandi sans être retiré.
3. **Mesures d'accord** (`python -m presidentielle validate`, section « Fiabilité » du site) :
   - par variable : taux d'accord, kappa de Cohen, alpha de Krippendorff (nominal, ordinal pour `niveau` et `registre`), matrice de confusion pour l'écologie, la position et le cadrage ;
   - par thème : alpha binaire et indice de Jaccard moyen sur les tweets que les deux moteurs classent écologie ;
   - calibration de Jev : parmi les tweets où Jev annonce p(écologie) ≈ 0,7, la part que Claude juge écologie, et score de Brier.

   Lecture de l'alpha : 0,80 et plus fiable, de 0,667 à 0,80 à confirmer, en dessous insuffisant. Les résultats sont présentés séparément pour la strate aléatoire de l'échantillon, seule estimation non biaisée, et pour l'ensemble des tweets double-codés, qui sur-représente les cas difficiles routés vers Claude.

**Portée de cette validation.** L'accord entre deux modèles mesure leur convergence, pas la validité du codage : deux modèles peuvent partager les mêmes biais. Avant toute publication scientifique, un double codage humain d'un sous-échantillon (au moins 200 tweets, deux codeurs indépendants, même livre de codes) est nécessaire pour mesurer l'accord humain/humain puis humain/modèle. Les désaccords arbitrés servent à réviser le livre de codes, dont chaque version est datée.

**Langue.** Le décalage entre instructions en anglais et tweets en français est mesuré indirectement par la calibration de Jev ; une calibration dégradée justifierait d'élargir la plage des décisions incertaines.

**Stabilité.** Les versions de modèles sont enregistrées sur chaque ligne (`jev.model`, `claude.model`). Un changement de version de Jev se traduit par un nouveau codage d'un échantillon de contrôle avant d'être adopté.

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
