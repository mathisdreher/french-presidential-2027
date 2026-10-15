"""Livre de codes : source unique des variables, des cadres théoriques et de leurs sources.

Tout en découle : les questions posées à Jev, le prompt et le schéma de sortie de Claude,
les mesures d'accord, les libellés du site et ses bulles d'information.

- `description` (anglais) : définition donnée aux modèles. L'anglais est la langue principale
  de Jev ; les tweets restent en français.
- `fr` : définition affichée aux lecteurs du site.
- `scope` : "all" (tous les tweets) ou "ecologie" (variable forcée à vide ou non_applicable
  quand le tweet ne parle pas d'écologie).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Ref:
    texte: str
    url: str = ""


@dataclass(frozen=True)
class Framework:
    key: str
    label: str
    auteurs: str
    resume: str            # ce que dit la théorie
    dans_l_etude: str      # comment elle est codée ici
    refs: tuple[Ref, ...] = ()


@dataclass(frozen=True)
class Option:
    key: str
    label: str
    description: str
    fr: str = ""


@dataclass(frozen=True)
class Variable:
    key: str
    kind: str                       # noul | choice | score | multi
    label: str
    instructions: str
    framework: str
    scope: str = "all"              # all | ecologie
    options: tuple[Option, ...] = field(default_factory=tuple)   # choice, score (ordonnées), multi

    @property
    def option_keys(self) -> tuple[str, ...]:
        return tuple(o.key for o in self.options)


# =============================================================================== cadres
FRAMEWORKS: tuple[Framework, ...] = (
    Framework(
        "macro", "Sujets et macrostructures", "Teun A. van Dijk",
        "Pour van Dijk, un texte s'organise autour de quelques sujets dominants, ses macrostructures. "
        "Ce dont on parle, et ce dont on ne parle pas, est déjà un choix : l'agenda d'un candidat "
        "révèle ce qu'il juge important et ce qu'il veut rendre visible.",
        "Pour chaque tweet : parle-t-il d'écologie, au sens large incluant l'énergie, à quel point, "
        "et de quels thèmes ? Une critique de l'écologie compte comme un tweet sur l'écologie.",
        (Ref("van Dijk, T. A. (1980). Macrostructures. Hillsdale : Lawrence Erlbaum."),),
    ),
    Framework(
        "cadrage", "Cadrage et position", "Robert Entman, George Lakoff",
        "Cadrer, c'est sélectionner certains aspects d'une réalité et les rendre saillants, pour "
        "promouvoir une définition du problème, une interprétation des causes, un jugement moral et "
        "une solution. Le même sujet, la voiture électrique par exemple, peut être cadré comme une "
        "urgence climatique, une contrainte sur le pouvoir d'achat ou une affaire de souveraineté "
        "industrielle.",
        "Le cadrage dominant de chaque tweet écologie, et la position du candidat : favorable à "
        "l'action écologique, critique, ou neutre.",
        (Ref("Entman, R. M. (1993). Framing: Toward clarification of a fractured paradigm. Journal of Communication, 43(4), 51-58.",
             "https://doi.org/10.1111/j.1460-2466.1993.tb01304.x"),
         Ref("Lakoff, G. (2010). Why it matters how we frame the environment. Environmental Communication, 4(1), 70-81.",
             "https://doi.org/10.1080/17524030903529749")),
    ),
    Framework(
        "carre", "Le carré idéologique", "Teun A. van Dijk",
        "Le discours idéologique polarise entre un « nous » et un « eux ». Van Dijk le résume en un "
        "carré : mettre en avant nos qualités, mettre en avant leurs défauts, atténuer nos défauts, "
        "atténuer leurs qualités. Repérer qui est désigné comme adversaire, et qui comme victime, "
        "dit beaucoup de la manière dont un candidat construit son camp.",
        "Pour chaque tweet : autoprésentation positive, présentation négative d'autrui, les deux ou "
        "aucune ; l'adversaire désigné ; le groupe présenté comme victime.",
        (Ref("van Dijk, T. A. (2006). Ideology and discourse analysis. Journal of Political Ideologies, 11(2), 115-140.",
             "https://doi.org/10.1080/13569310600687908"),
         Ref("van Dijk, T. A. (1998). Ideology: A Multidisciplinary Approach. Londres : Sage.")),
    ),
    Framework(
        "procedes", "Les procédés du discours idéologique", "Teun A. van Dijk",
        "Van Dijk a dressé l'inventaire des procédés par lesquels une idéologie s'exprime dans le "
        "discours : déni apparent, appel au consensus, jeu des chiffres, euphémisme, hyperbole, "
        "généralisation, victimisation, et d'autres. Aucun n'est idéologique en soi ; c'est leur "
        "usage pour servir un camp qui l'est.",
        "Seize procédés sont repérés dans chaque tweet ; un tweet peut en contenir plusieurs.",
        (Ref("van Dijk, T. A. (2006). Ideology and discourse analysis. Journal of Political Ideologies, 11(2), 115-140.",
             "https://doi.org/10.1080/13569310600687908"),
         Ref("Mudde, C. (2004). The populist zeitgeist. Government and Opposition, 39(4), 541-563.",
             "https://doi.org/10.1111/j.1477-7053.2004.00135.x")),
    ),
    Framework(
        "topoi", "Les topoï de l'argumentation", "Ruth Wodak, Martin Reisigl",
        "L'approche historique du discours de Wodak repère les topoï, des raccourcis argumentatifs "
        "qui relient un argument à une conclusion sans le dire : « si c'est dangereux, il faut "
        "agir », « si cela coûte trop cher, il faut renoncer », « soyons réalistes ». Ils montrent "
        "comment chaque camp justifie sa position, au-delà du simple pour ou contre.",
        "Douze topoï sont repérés dans chaque tweet ; un tweet peut en mobiliser plusieurs.",
        (Ref("Reisigl, M. et Wodak, R. (2001). Discourse and Discrimination: Rhetorics of Racism and Antisemitism. Londres : Routledge."),
         Ref("Wodak, R. et Meyer, M. (dir.) (2016). Methods of Critical Discourse Studies, 3e éd. Londres : Sage.")),
    ),
    Framework(
        "legitimation", "La légitimation", "Theo van Leeuwen",
        "Pour faire accepter ou rejeter une politique, on la légitime ou on la délégitime. Van "
        "Leeuwen distingue quatre ressorts : l'autorité (un expert, la loi, la tradition), "
        "l'évaluation morale (c'est juste, c'est naturel), la rationalisation (c'est utile, c'est "
        "efficace) et le récit (une histoire qui récompense ou punit).",
        "Les quatre ressorts sont repérés dans chaque tweet ; un tweet peut en combiner plusieurs.",
        (Ref("van Leeuwen, T. (2007). Legitimation in discourse and communication. Discourse & Communication, 1(1), 91-112.",
             "https://doi.org/10.1177/1750481307071986"),
         Ref("van Leeuwen, T. (2008). Discourse and Practice. Oxford : Oxford University Press.")),
    ),
    Framework(
        "retardement", "Les discours de retardement climatique", "William Lamb et coauteurs",
        "Le climato-scepticisme frontal est devenu rare. Lamb et ses coauteurs montrent que l'action "
        "climatique est plus souvent retardée par des discours qui acceptent le problème mais "
        "repoussent la solution : rejeter la responsabilité sur d'autres, promouvoir des solutions "
        "qui ne changent rien, insister sur les inconvénients, ou se résigner. Ils en recensent douze.",
        "Les douze discours sont repérés dans les tweets écologie. Repérer un discours de "
        "retardement ne dit rien de la sincérité de son auteur : certains arguments, comme la "
        "justice sociale, sont aussi des préoccupations légitimes.",
        (Ref("Lamb, W. F. et al. (2020). Discourses of climate delay. Global Sustainability, 3, e17.",
             "https://doi.org/10.1017/sus.2020.13"),),
    ),
    Framework(
        "visions", "Les visions de l'écologie", "John Dryzek",
        "Dryzek classe les discours environnementaux selon deux questions : la croissance a-t-elle "
        "des limites, et faut-il changer en profondeur ou ajuster le système existant ? Il en tire "
        "une typologie, du discours prométhéen qui fait confiance au progrès jusqu'au radicalisme "
        "vert qui veut changer les modes de vie.",
        "La vision dominante de chaque tweet écologie.",
        (Ref("Dryzek, J. S. (2013). The Politics of the Earth: Environmental Discourses, 3e éd. Oxford : Oxford University Press."),),
    ),
    Framework(
        "ethos", "L'ethos", "Dominique Maingueneau, Ruth Amossy",
        "Tout discours construit une image de celui qui parle, l'ethos. Un candidat ne dit pas "
        "« je suis compétent » : il le montre par sa manière de parler, chiffres et dossiers à "
        "l'appui. L'ethos peut être celui de l'expert, du protecteur, du combattant ou de l'homme "
        "d'État.",
        "L'image de soi dominante construite par chaque tweet.",
        (Ref("Amossy, R. (2010). La présentation de soi. Ethos et identité verbale. Paris : PUF."),
         Ref("Maingueneau, D. (1999). Ethos, scénographie, incorporation. Dans R. Amossy (dir.), Images de soi dans le discours. Lausanne : Delachaux et Niestlé.")),
    ),
    Framework(
        "grammaire", "Qui agit, et sur quel ton", "Norman Fairclough, Michael Halliday",
        "La grammaire n'est pas neutre. « Les prix augmentent » efface le responsable ; « le "
        "gouvernement augmente les prix » le désigne. De même, « il faut », « je ferai » ou « c'est "
        "certain » engagent différemment celui qui parle. Fairclough s'appuie sur la grammaire de "
        "Halliday pour montrer comment ces choix construisent des rapports de pouvoir.",
        "Pour chaque tweet : l'agent de l'action est-il nommé, effacé, ou est-ce le candidat lui-même ; "
        "et quelle modalité domine : obligation, certitude, possibilité, engagement ou simple assertion.",
        (Ref("Fairclough, N. (2003). Analysing Discourse: Textual Analysis for Social Research. Londres : Routledge."),
         Ref("Halliday, M. A. K. et Matthiessen, C. M. I. M. (2014). Halliday's Introduction to Functional Grammar, 4e éd. Londres : Routledge.")),
    ),
    Framework(
        "enonciation", "Actes, émotions et contexte", "John Austin, John Searle, James Martin et Peter White",
        "Dire, c'est faire : promettre, attaquer, informer ou appeler à agir sont des actes de "
        "discours. Le registre émotionnel, de factuel à indigné, relève de l'évaluation. Enfin, un "
        "tweet répond souvent à l'actualité : van Dijk parle de modèles de contexte.",
        "L'acte de discours dominant, le registre émotionnel, et le fait que le tweet réagisse ou non "
        "à un événement précis.",
        (Ref("Austin, J. L. (1962). How to Do Things with Words. Oxford : Clarendon Press."),
         Ref("Searle, J. R. (1969). Speech Acts. Cambridge : Cambridge University Press."),
         Ref("Martin, J. R. et White, P. R. R. (2005). The Language of Evaluation: Appraisal in English. Basingstoke : Palgrave Macmillan."),
         Ref("van Dijk, T. A. (2008). Discourse and Context. Cambridge : Cambridge University Press.")),
    ),
    # --- cadres calculés à partir des données, sans question posée aux modèles
    Framework(
        "appropriation", "L'appropriation des enjeux", "John Petrocik",
        "Selon Petrocik, chaque parti « possède » certains enjeux aux yeux des électeurs : il est jugé "
        "plus crédible sur eux et a intérêt à en parler. L'écologie est traditionnellement associée aux "
        "écologistes et à la gauche. Les autres candidats peuvent l'ignorer, ou l'aborder par un angle "
        "qu'ils possèdent, comme l'énergie et son prix.",
        "Calculé sans modèle : on compare le profil thématique des tweets écologie de chaque candidat "
        "à celui de chaque famille politique.",
        (Ref("Petrocik, J. R. (1996). Issue ownership in presidential elections, with a 1980 case study. American Journal of Political Science, 40(3), 825-850.",
             "https://doi.org/10.2307/2111797"),),
    ),
    Framework(
        "formules", "Les formules", "Alice Krieg-Planque",
        "Une formule est une expression courte qui, à un moment donné, circule, devient un enjeu et "
        "fait l'objet de polémiques : « écologie punitive », « planification écologique », "
        "« sobriété ». Suivre qui lance une formule, qui la reprend, la détourne ou la conteste, "
        "c'est suivre une bataille pour imposer les mots du débat.",
        "Calculé sans modèle : chaque formule de config/formules.yaml est repérée par ses variantes "
        "dans les tweets, avec sa première occurrence et sa diffusion.",
        (Ref("Krieg-Planque, A. (2009). La notion de « formule » en analyse du discours. Cadre théorique et méthodologique. Besançon : Presses universitaires de Franche-Comté."),),
    ),
    Framework(
        "boussole", "La boussole écologique", "Construction de ce site, d'après John Dryzek",
        "La boussole place chaque candidat sur deux axes calculés à partir de ses tweets écologie. "
        "L'axe horizontal mesure la position : chaque tweet favorable à l'action écologique compte +1, "
        "chaque tweet critique −1, un tweet neutre 0. L'axe vertical mesure le rapport à la croissance, "
        "d'après la typologie de Dryzek : le survivalisme et le radicalisme vert, qui posent des limites "
        "à la croissance, comptent +1 ; le discours prométhéen, qui les nie, −1 ; la modernisation "
        "écologique et le rationalisme économique, qui misent sur la croissance verte et le marché, −0,5 ; "
        "les autres visions 0.",
        "C'est un indice construit pour ce site, à visée pédagogique : il résume deux dimensions parmi "
        "d'autres et dépend de la qualité du codage. Les candidats qui ont moins de 8 tweets écologie ne "
        "sont pas placés.",
        (Ref("Dryzek, J. S. (2013). The Politics of the Earth: Environmental Discourses, 3e éd. Oxford : Oxford University Press."),),
    ),
    Framework(
        "lexique", "Lexicométrie", "Ludovic Lebart, André Salem, Ted Dunning",
        "La lexicométrie, tradition française de l'analyse du discours politique, compte les mots "
        "sans les interpréter. On cherche le vocabulaire spécifique d'un locuteur : les mots qu'il "
        "emploie significativement plus que les autres.",
        "Calculé sans modèle : pour chaque candidat, les mots de ses tweets écologie les plus "
        "sur-représentés par rapport aux autres candidats, selon le rapport de vraisemblance de Dunning.",
        (Ref("Lebart, L. et Salem, A. (1994). Statistique textuelle. Paris : Dunod."),
         Ref("Dunning, T. (1993). Accurate methods for the statistics of surprise and coincidence. Computational Linguistics, 19(1), 61-74.",
             "https://aclanthology.org/J93-1003")),
    ),
)
FRAMEWORK_BY_KEY = {f.key: f for f in FRAMEWORKS}

# ============================================================================= variables
ECOLOGIE = Variable(
    "parle_ecologie", "noul", "Parle d'écologie", framework="macro",
    instructions=("The tweet addresses ecology, the environment, climate, biodiversity, pollution, or energy "
                  "(nuclear, renewables, electricity prices, grid, energy sobriety), including when the author "
                  "criticises ecological policies or activists. Metaphorical uses ('political climate', "
                  "'the energy of youth') do NOT count."),
)

NIVEAU = Variable(
    "niveau", "score", "Centralité de l'écologie", framework="macro",
    instructions="How central ecology, environment or energy is to this tweet.",
    options=(
        Option("aucun", "Absente", "The tweet does not address ecology, environment or energy at all"),
        Option("secondaire", "Secondaire", "Ecology, environment or energy is mentioned among other topics, e.g. one item in a list of priorities"),
        Option("central", "Centrale", "Ecology, environment or energy is the main subject of the tweet"),
    ),
)

THEMES = Variable(
    "themes", "multi", "Thèmes", framework="macro", scope="ecologie",
    instructions="The tweet addresses the following ecological theme.",
    options=(
        Option("climat", "Climat", "Global warming, greenhouse gas emissions, carbon neutrality, COP summits, climate adaptation"),
        Option("energie_nucleaire", "Nucléaire", "Nuclear power: EPR reactors, the nuclear fleet, relaunching or phasing out nuclear"),
        Option("energies_renouvelables", "Énergies renouvelables", "Wind, solar, hydro, biogas, hydrogen, renewable energy targets"),
        Option("prix_energie_reseau", "Prix de l'énergie et réseau", "Energy bills, electricity market, gas and fuel prices, power grid, storage, flexibility, energy security"),
        Option("sobriete_efficacite", "Sobriété et efficacité", "Building renovation, thermal insulation, energy sobriety, reducing consumption"),
        Option("transports_mobilite", "Transports et mobilité", "Electric vehicles, low-emission zones (ZFE), rail, aviation, fuel, car dependency"),
        Option("biodiversite_nature", "Biodiversité et nature", "Wildlife, forests, oceans, soil artificialisation (ZAN), protected areas, hunting"),
        Option("agriculture_alimentation", "Agriculture et alimentation", "Pesticides, livestock, agroecology, organic farming, Mercosur and food trade, food sovereignty"),
        Option("pollution_sante", "Pollution et santé", "Air pollution, plastics, PFAS, waste, noise, environmental health"),
        Option("eau", "Eau", "Drought, water reservoirs (mégabassines), floods, water resources and quality"),
        Option("industrie_verte_emploi", "Industrie verte et emploi", "Green reindustrialisation, ecological planning, green jobs, decarbonising industry"),
        Option("fiscalite_normes", "Fiscalité et normes", "Carbon tax, environmental regulation, EU norms, 'punitive ecology', administrative burden"),
        Option("international_europe", "International et Europe", "EU Green Deal, international climate agreements, climate diplomacy, foreign comparisons"),
        Option("autre_ecologie", "Autre", "Any other ecological or environmental topic not listed above"),
    ),
)

POSITION = Variable(
    "position", "choice", "Position", framework="cadrage", scope="ecologie",
    instructions="The author's stance toward ecological action in this tweet.",
    options=(
        Option("favorable_transition", "Favorable à la transition", "Supports ecological action, proposes or defends environmental or energy-transition measures",
               "Soutient l'action écologique, propose ou défend des mesures de transition."),
        Option("critique_ecologie", "Critique de l'écologie", "Criticises ecological policies, norms, activists, or frames ecology as punitive, ideological or harmful",
               "Critique des politiques, normes ou militants écologistes, ou présente l'écologie comme punitive ou nuisible."),
        Option("neutre", "Neutre", "States facts, reports information, or the stance is ambiguous", "Constat, information, ou position ambiguë."),
        Option("non_applicable", "Non applicable", "The tweet does not address ecology at all"),
    ),
)

CADRAGE = Variable(
    "cadrage", "choice", "Cadrage dominant", framework="cadrage", scope="ecologie",
    instructions="The dominant frame through which ecology or energy is presented in this tweet.",
    options=(
        Option("urgence_menace", "Urgence et menace", "Ecology as an emergency or existential threat: disasters, heatwaves, irreversible damage",
               "L'écologie comme urgence ou menace : catastrophes, canicules, dommages irréversibles."),
        Option("opportunite_economique", "Opportunité économique", "Ecology as growth, innovation, jobs, competitiveness or industrial opportunity",
               "L'écologie comme source de croissance, d'innovation, d'emplois ou de compétitivité."),
        Option("contrainte_punitive", "Contrainte, écologie punitive", "Ecology as a burden: bans, taxes, norms, bureaucracy, loss of freedom or purchasing power",
               "L'écologie comme fardeau : interdictions, taxes, normes, perte de liberté ou de pouvoir d'achat."),
        Option("souverainete", "Souveraineté et indépendance", "Energy or food independence, national sovereignty, reducing reliance on foreign supply",
               "Indépendance énergétique ou alimentaire, souveraineté nationale."),
        Option("justice_sociale", "Justice sociale", "Inequality, protection of modest households, fair distribution of the costs of transition",
               "Inégalités, protection des ménages modestes, partage juste des coûts de la transition."),
        Option("science_rationalite", "Science et rationalité", "Appeals to science, expertise, pragmatism or technical solutions",
               "Appel à la science, à l'expertise, au pragmatisme ou aux solutions techniques."),
        Option("identite_terroir", "Identité, terroir, ruralité", "Rural life, farmers, landscapes, local heritage, way of life",
               "Vie rurale, agriculteurs, paysages, patrimoine local, mode de vie."),
        Option("sante", "Santé", "Health consequences of pollution, pesticides, air quality", "Conséquences sanitaires de la pollution ou des pesticides."),
        Option("non_applicable", "Non applicable", "The tweet does not address ecology, or no frame can be identified"),
    ),
)

POLARISATION = Variable(
    "polarisation", "choice", "Polarisation", framework="carre",
    instructions=("Van Dijk's ideological square: does the tweet emphasise the positive qualities of the author's "
                  "own group ('us'), the negative qualities of an out-group ('them'), both, or neither?"),
    options=(
        Option("autopresentation_positive", "Autoprésentation positive", "Emphasises the merits, achievements or values of the author, their party or their camp",
               "Met en avant les mérites, le bilan ou les valeurs de l'auteur et de son camp."),
        Option("presentation_negative_autrui", "Présentation négative d'autrui", "Blames, discredits or attacks an out-group (opponents, institutions, elites, activists)",
               "Accuse, discrédite ou attaque un autre groupe."),
        Option("les_deux", "Les deux", "Both positive self-presentation and negative other-presentation", "Les deux à la fois : « nous » valorisé, « eux » dévalorisé."),
        Option("aucune", "Aucune", "No clear us/them polarisation"),
    ),
)

ADVERSAIRE = Variable(
    "adversaire", "choice", "Adversaire désigné", framework="carre",
    instructions="Who is cast as the opponent, culprit or negative 'other' in this tweet, if anyone.",
    options=(
        Option("gouvernement_executif", "Gouvernement, exécutif", "The current government, the President, ministers, the executive's record"),
        Option("union_europeenne", "Union européenne", "Brussels, EU institutions, EU norms or directives"),
        Option("ecologistes_gauche", "Écologistes, gauche", "Environmental activists, green parties, the left, 'wokism'"),
        Option("droite_extreme_droite", "Droite, extrême droite", "The right, the far right, RN, Reconquête, climate sceptics"),
        Option("lobbies_industries", "Lobbies, industries", "Corporations, lobbies, polluters, multinationals, finance"),
        Option("elites_technocrates_medias", "Élites, technocrates, médias", "Elites, technocrats, experts, media, 'the system'"),
        Option("puissances_etrangeres", "Puissances étrangères", "Foreign countries or powers (China, USA, Russia, Gulf states)"),
        Option("autre_candidat", "Autre candidat", "A named rival candidate for the 2027 election"),
        Option("aucun", "Aucun", "No opponent is designated"),
    ),
)

VICTIME = Variable(
    "victime", "choice", "Victime désignée", framework="carre",
    instructions="Which group is presented as suffering, threatened or in need of protection in this tweet.",
    options=(
        Option("menages_modestes", "Ménages modestes", "Low-income households, working classes, people hit by prices or bans"),
        Option("agriculteurs_ruraux", "Agriculteurs, ruraux", "Farmers, fishers, rural inhabitants, small towns"),
        Option("entreprises_industrie", "Entreprises, industrie", "Businesses, industry, workers of a sector threatened by regulation or competition"),
        Option("planete_generations_futures", "Planète, générations futures", "The planet, nature, future generations, humanity as a whole"),
        Option("francais_en_general", "Les Français", "The French people or the nation as a whole"),
        Option("aucune", "Aucune", "No victim group is presented"),
    ),
)

PROCEDES = Variable(
    "procedes", "multi", "Procédés", framework="procedes",
    instructions="The tweet uses the following discursive device (van Dijk's ideological discourse structures).",
    options=(
        Option("denegation", "Déni apparent", "Apparent denial or concession: the author disclaims a negative stance before expressing it ('I am not against ecology, but...')",
               "« Je ne suis pas contre l'écologie, mais… » : on nie une position pour mieux l'exprimer."),
        Option("consensus", "Appel au consensus", "Appeal to consensus or common sense: presents a view as shared by everyone ('all French people know', 'common sense')",
               "Présenter son opinion comme partagée par tous : « tout le monde sait », « le bon sens »."),
        Option("victimisation", "Victimisation", "Victimisation: presents the in-group as victims of the out-group or of a policy",
               "Présenter son camp, ou ceux qu'on défend, comme victimes d'autrui ou d'une politique."),
        Option("euphemisme", "Euphémisme", "Euphemism or mitigation: softens a negative fact about the in-group or a hard measure",
               "Adoucir un fait gênant pour son camp ou une mesure dure."),
        Option("hyperbole", "Hyperbole", "Hyperbole or dramatisation: exaggerates facts, threats or effects", "Exagérer les faits, les menaces ou les effets."),
        Option("generalisation", "Généralisation", "Generalisation: extends a single case or an individual's behaviour to a whole group",
               "Étendre un cas particulier à tout un groupe."),
        Option("glorification_nationale", "Glorification nationale", "National self-glorification: praises France, its history, its people or its excellence",
               "Louer la France, son histoire, son excellence."),
        Option("comparaison", "Comparaison", "Comparison: compares with other countries, periods or groups to argue",
               "Comparer avec d'autres pays, d'autres époques ou d'autres groupes pour argumenter."),
        Option("contrefactuel", "Contrefactuel", "Counterfactual: 'what would happen if...' or 'if we had...' reasoning",
               "« Que se passerait-il si… », « si nous avions… »."),
        Option("illustration", "Illustration", "Example or illustration: a concrete story, case or anecdote to support the point",
               "Un exemple concret, une histoire, une anecdote à l'appui."),
        Option("ironie", "Ironie", "Irony or sarcasm", "Ironie ou sarcasme."),
        Option("metaphore", "Métaphore", "Metaphor: a figurative image to frame the issue (war, disease, wall, house on fire...)",
               "Une image pour cadrer le problème : la guerre, la maladie, la maison qui brûle…"),
        Option("norme", "Expression d'une norme", "Norm expression: prescribes what must or should be done ('we must', 'it is necessary')",
               "Dire ce qu'il faut faire : « il faut », « nous devons »."),
        Option("jeu_des_chiffres", "Jeu des chiffres", "Number game: numbers, statistics or amounts used to impress or prove",
               "Des chiffres, statistiques ou montants pour impressionner ou prouver."),
        Option("autorite", "Appel à l'autorité", "Appeal to authority: scientists, reports, experts, institutions, courts, history",
               "S'appuyer sur des scientifiques, un rapport, des experts, une institution."),
        Option("populisme", "Populisme", "Populism: opposes a virtuous 'people' to corrupt or disconnected 'elites' or 'the system'",
               "Opposer un peuple vertueux à des élites corrompues ou déconnectées (Mudde)."),
    ),
)

TOPOI = Variable(
    "topoi", "multi", "Topoï", framework="topoi",
    instructions="The tweet relies on the following argumentative topos (Reisigl and Wodak), stated or implied.",
    options=(
        Option("utilite", "Utilité", "Topos of usefulness: if an action is useful or advantageous, it should be done (or not, if useless)",
               "Si c'est utile ou avantageux, il faut le faire."),
        Option("danger_menace", "Danger, menace", "Topos of danger: if something poses a danger or threat, one should act against it",
               "Si c'est dangereux ou menaçant, il faut agir contre."),
        Option("humanitarisme", "Humanitarisme", "Topos of humanitarianism: if an action respects (or violates) human rights or humanitarian values, it should (not) be done",
               "Si cela respecte, ou bafoue, les droits humains, il faut le faire, ou l'empêcher."),
        Option("justice", "Justice, égalité", "Topos of justice: people or groups should be treated equally; an unequal treatment must change",
               "Tous doivent être traités également ; une inégalité doit cesser."),
        Option("responsabilite", "Responsabilité", "Topos of responsibility: because someone is responsible for a problem, they must act to solve it",
               "Celui qui a causé le problème doit le régler."),
        Option("fardeau", "Fardeau", "Topos of burden: if a person, group or institution is overburdened, measures must relieve them",
               "Si un groupe est accablé, il faut le soulager."),
        Option("finances", "Coût", "Topos of finances: if something costs too much or causes losses, it should be avoided (or the reverse)",
               "Si cela coûte trop cher, il faut y renoncer."),
        Option("realite", "Réalité", "Topos of reality: because reality is as it is, a specific action must be taken ('let's be realistic')",
               "« Soyons réalistes » : la réalité impose telle décision."),
        Option("histoire", "Histoire", "Topos of history: history teaches that specific actions have specific consequences",
               "L'histoire montre ce qu'il faut faire, ou éviter."),
        Option("droit_loi", "Droit, loi", "Topos of law: because a law, rule or treaty prescribes it, it must be done",
               "La loi ou un traité l'impose."),
        Option("urgence", "Urgence", "Topos of urgency: time pressure requires immediate action", "Le temps presse : il faut agir maintenant."),
        Option("culture_identite", "Culture, identité", "Topos of culture: because a group's culture or identity is as it is, it must be protected or specific problems arise",
               "Une culture ou une identité doit être protégée."),
    ),
)

LEGITIMATION = Variable(
    "legitimation", "multi", "Légitimation", framework="legitimation",
    instructions="To legitimise or delegitimise an action or policy, the tweet uses the following strategy (van Leeuwen).",
    options=(
        Option("autorisation", "Autorité", "Authorisation: reference to the authority of tradition, custom, law, experts or persons with institutional authority",
               "Par l'autorité : la loi, la tradition, un expert, une institution."),
        Option("evaluation_morale", "Évaluation morale", "Moral evaluation: reference to value systems, what is good, natural, normal, healthy or shameful",
               "Par les valeurs : c'est juste, naturel, normal, ou honteux."),
        Option("rationalisation", "Rationalisation", "Rationalisation: reference to the goals, uses, effects or efficiency of the action, or to how things are",
               "Par l'utilité ou l'efficacité : ça marche, ça sert à quelque chose."),
        Option("mythopoese", "Récit", "Mythopoesis: legitimation conveyed through a narrative whose outcome rewards legitimate actions and punishes illegitimate ones",
               "Par une histoire qui récompense les bons et punit les mauvais."),
    ),
)

RETARDEMENT = Variable(
    "retardement", "multi", "Retardement climatique", framework="retardement", scope="ecologie",
    instructions="The tweet expresses the following discourse of climate delay (Lamb et al., 2020).",
    options=(
        Option("individualisme", "Individualisme", "Individualism: responsibility lies with individual consumers' choices rather than systemic policy",
               "C'est aux individus de changer, pas aux politiques publiques. Rejeter la responsabilité."),
        Option("whataboutisme", "« Et les autres ? »", "Whataboutism: our emissions are negligible compared to others (China, USA, India...)",
               "Nos émissions sont négligeables face à la Chine ou aux États-Unis. Rejeter la responsabilité."),
        Option("passager_clandestin", "Passager clandestin", "Free-rider excuse: reducing our emissions is pointless or harmful while others keep polluting or gain an advantage",
               "Agir seuls est inutile, voire nuisible, tant que les autres n'agissent pas. Rejeter la responsabilité."),
        Option("optimisme_technologique", "Optimisme technologique", "Technological optimism: future technologies will solve the problem, so no drastic change is needed now",
               "La technologie réglera le problème : inutile de changer maintenant. Solution qui ne transforme rien."),
        Option("beaucoup_de_paroles", "Annonces sans action", "All talk, little action: ambitious targets or announcements presented as if they were action",
               "Des objectifs ambitieux présentés comme de l'action. Solution qui ne transforme rien."),
        Option("solutionnisme_fossile", "Solutionnisme fossile", "Fossil fuel solutionism: fossil fuels (e.g. gas, 'clean' oil) presented as part of the solution",
               "Les énergies fossiles présentées comme une partie de la solution. Solution qui ne transforme rien."),
        Option("pas_de_contrainte", "Pas de contrainte", "No sticks, just carrots: only incentives are acceptable, never restrictions, bans or taxes",
               "Des incitations, jamais d'interdiction ni de taxe. Solution qui ne transforme rien."),
        Option("justice_sociale", "Appel à la justice sociale", "Appeal to social justice: climate policies would hurt the poor or workers, so they should be delayed or abandoned",
               "Les mesures climatiques pénaliseraient les plus modestes, donc il faut les repousser. Insister sur les inconvénients."),
        Option("bien_etre", "Appel au mode de vie", "Appeal to well-being: fossil fuels, cars or current lifestyles are essential to well-being and must be preserved",
               "Notre mode de vie et notre bien-être exigent de garder voitures ou énergies actuelles. Insister sur les inconvénients."),
        Option("perfectionnisme", "Perfectionnisme", "Policy perfectionism: measures are rejected because they are imperfect, unpopular or not good enough",
               "Rejeter une mesure parce qu'elle est imparfaite. Insister sur les inconvénients."),
        Option("changement_impossible", "Changement impossible", "Change is impossible: cutting emissions is incompatible with our way of life, human nature or democracy",
               "Réduire les émissions serait incompatible avec notre société. Se résigner."),
        Option("fatalisme", "Fatalisme", "Doomism: it is too late to act, we are doomed anyway", "Il est trop tard, de toute façon. Se résigner."),
    ),
)

VISION = Variable(
    "vision", "choice", "Vision de l'écologie", framework="visions", scope="ecologie",
    instructions="Which environmental discourse (Dryzek) best describes the vision of ecology expressed in the tweet?",
    options=(
        Option("survivalisme", "Survivalisme", "Survivalism: ecological limits to growth; collapse unless drastic collective control",
               "La croissance a des limites physiques ; sans contrôle drastique, c'est l'effondrement."),
        Option("prometheen", "Prométhéen", "Promethean: no real limits; human ingenuity, technology, markets and growth overcome environmental problems; concerns are exaggerated",
               "Pas de vraies limites : le progrès, la technique et la croissance résoudront les problèmes."),
        Option("rationalisme_administratif", "Rationalisme administratif", "Administrative rationalism: experts, state agencies, regulation and planning solve environmental problems",
               "L'État, les experts, la réglementation et la planification règlent les problèmes."),
        Option("pragmatisme_democratique", "Pragmatisme démocratique", "Democratic pragmatism: citizen participation, consultation, local democracy and public debate",
               "La participation citoyenne, la concertation et le débat public."),
        Option("rationalisme_economique", "Rationalisme économique", "Economic rationalism: markets, prices, carbon pricing, incentives and competition",
               "Le marché, les prix, la tarification du carbone et les incitations."),
        Option("developpement_durable", "Développement durable", "Sustainable development: reconciling growth, environmental protection and social justice",
               "Concilier croissance, environnement et justice sociale."),
        Option("modernisation_ecologique", "Modernisation écologique", "Ecological modernisation: environmental protection as a driver of growth, innovation and competitiveness; green industry",
               "L'écologie comme moteur de croissance, d'innovation et d'industrie verte."),
        Option("radicalisme_vert", "Radicalisme vert", "Green radicalism: deep change in values, lifestyles and the economy; degrowth, critique of capitalism or consumerism",
               "Changer en profondeur les valeurs, les modes de vie et l'économie ; décroissance."),
        Option("non_applicable", "Non applicable", "The tweet does not address ecology, or no vision can be identified"),
    ),
)

ETHOS = Variable(
    "ethos", "choice", "Ethos", framework="ethos",
    instructions="The dominant self-image (ethos) the author builds through this tweet.",
    options=(
        Option("expert", "Expert compétent", "Competent expert: shows knowledge, mastery of the files, figures", "Maîtrise des dossiers, chiffres, compétence."),
        Option("homme_d_etat", "Chef d'État", "Statesman or leader: authority, responsibility, presidential stature, decision",
               "Autorité, sens des responsabilités, stature présidentielle."),
        Option("protecteur", "Protecteur", "Protector: protects the people, families, workers or the nation", "Protège le peuple, les familles, la nation."),
        Option("combattant", "Combattant", "Fighter: combat, resistance, struggle against adversaries", "Combat, résistance, lutte contre des adversaires."),
        Option("proche", "Proche des gens", "Close to people: simple, one of them, everyday life, empathy, field visits",
               "Simple, à l'écoute, sur le terrain, comme vous."),
        Option("rassembleur", "Rassembleur", "Unifier: gathering beyond divides, consensus", "Rassemble au-delà des clivages."),
        Option("visionnaire", "Visionnaire", "Visionary: future, project, hope, grand narrative", "Projet, avenir, espoir, grand récit."),
        Option("indetermine", "Indéterminé", "No identifiable self-image"),
    ),
)

AGENTIVITE = Variable(
    "agentivite", "choice", "Agentivité", framework="grammaire",
    instructions="How is agency (who does what) expressed for the main action or problem in the tweet?",
    options=(
        Option("responsable_nomme", "Responsable nommé", "A responsible agent is explicitly named for a problem or action ('the government raised taxes')",
               "Le responsable est nommé : « le gouvernement augmente les taxes »."),
        Option("responsable_efface", "Responsable effacé", "Agency is hidden: passive voice, nominalisation, impersonal phrasing ('prices are rising', 'mistakes were made')",
               "Le responsable disparaît : « les prix augmentent », « des erreurs ont été commises »."),
        Option("locuteur_agent", "Le candidat agit", "The author or their camp is presented as the agent of action ('I will', 'we did')",
               "Le candidat ou son camp se présente comme celui qui agit : « je ferai », « nous avons fait »."),
        Option("non_applicable", "Non applicable", "No action or process with an identifiable agent"),
    ),
)

MODALITE = Variable(
    "modalite", "choice", "Modalité", framework="grammaire",
    instructions="The dominant modality of the tweet.",
    options=(
        Option("obligation", "Obligation", "Deontic modality: must, should, it is necessary", "« Il faut », « nous devons »."),
        Option("certitude", "Certitude", "Epistemic certainty: it is certain, obviously, without any doubt", "« C'est évident », « sans aucun doute »."),
        Option("possibilite", "Possibilité", "Possibility or hypothesis: could, may, perhaps", "« Pourrait », « peut-être »."),
        Option("engagement", "Engagement", "Commitment or volition: I will, we want, I commit", "« Je ferai », « je m'engage », « nous voulons »."),
        Option("assertion", "Simple assertion", "Plain assertion without marked modality", "Un énoncé sans marque particulière."),
    ),
)

ACTE = Variable(
    "acte_discursif", "choice", "Acte de discours", framework="enonciation",
    instructions="The dominant speech act of the tweet.",
    options=(
        Option("promesse_proposition", "Promesse, proposition", "Announces a measure, a programme commitment, or a plan", "Annonce une mesure ou un engagement."),
        Option("critique_attaque", "Critique, attaque", "Criticises or attacks a policy, a person or a group", "Critique une politique, une personne, un groupe."),
        Option("constat_information", "Constat, information", "Reports facts, figures, events or an agenda without explicit evaluation", "Rapporte des faits ou un agenda."),
        Option("appel_mobilisation", "Appel, mobilisation", "Calls to action, to vote, to join, to resist", "Appelle à agir, voter, rejoindre, résister."),
        Option("autre", "Autre", "None of the above (greeting, thanks, anecdote)"),
    ),
)

REGISTRE = Variable(
    "registre", "score", "Registre émotionnel", framework="enonciation",
    instructions="The emotional register of the tweet.",
    options=(
        Option("factuel", "Factuel", "Calm and factual: states facts or positions without strong evaluative language"),
        Option("engage", "Engagé", "Engaged: clearly evaluative, uses value-laden words, but remains measured"),
        Option("alarmiste_indigne", "Alarmiste, indigné", "Alarmist or indignant: strong language, outrage, catastrophe, insults, exclamation"),
    ),
)

REACTIVITE = Variable(
    "reactivite", "noul", "Réaction à l'actualité", framework="enonciation",
    instructions="The tweet reacts to a specific current event (a news item, a vote, a disaster, a statement by someone else).",
)

# Rapport à la croissance (axe vertical de la boussole), d'après la typologie de Dryzek
VISION_GROWTH_SCORE = {
    "survivalisme": 1.0, "radicalisme_vert": 1.0,
    "pragmatisme_democratique": 0.0, "developpement_durable": 0.0, "rationalisme_administratif": 0.0,
    "modernisation_ecologique": -0.5, "rationalisme_economique": -0.5,
    "prometheen": -1.0,
}

VARIABLES: tuple[Variable, ...] = (
    ECOLOGIE, NIVEAU, THEMES, POSITION, CADRAGE, POLARISATION, ADVERSAIRE, VICTIME, PROCEDES, TOPOI,
    LEGITIMATION, RETARDEMENT, VISION, ETHOS, AGENTIVITE, MODALITE, ACTE, REGISTRE, REACTIVITE,
)
VARIABLE_BY_KEY = {v.key: v for v in VARIABLES}
THEME_KEYS = THEMES.option_keys


def non_ecology_defaults() -> dict:
    """Valeurs imposées quand le tweet ne parle pas d'écologie (cohérence entre variables)."""
    out: dict = {"niveau": "aucun"}
    for v in VARIABLES:
        if v.scope != "ecologie":
            continue
        out[v.key] = [] if v.kind == "multi" else "non_applicable"
    return out


NON_ECOLOGIE_DEFAULTS = non_ecology_defaults()

# Le texte libre produit par Claude en plus de la grille (sémantique locale)
TEXT_FIELDS = {
    "nous": "Who 'we' designates in the tweet (empty string if no 'we' group).",
    "eux": "Who 'they' designates in the tweet (empty string if no out-group).",
    "lexique": "Up to 5 marked words or phrases quoted verbatim from the tweet (loaded, metaphorical, euphemistic or hyperbolic terms).",
    "implicites": "One French sentence stating the presupposition or implication the tweet relies on (empty if none).",
    "resume": "One French sentence justifying the classification.",
    "confiance": "Confidence in the classification: faible, moyenne or elevee.",
}

# Moteurs de codage, présentés sur le site
ENGINES = (
    Framework(
        "jev", "Jev, un modèle de décision", "TypeSafe",
        "Jev est un modèle « System One », par analogie avec la pensée rapide décrite par Kahneman : "
        "il ne rédige pas de texte, il répond à des questions fermées. Pour chaque variable, il "
        "renvoie une probabilité pour chaque réponse possible et un indice de confiance. Il code chaque "
        "jour tous les nouveaux tweets.",
        "Chaque tweet reçoit environ 70 questions en parallèle. Les définitions des catégories sont "
        "rédigées en anglais, langue principale de Jev ; les tweets restent en français.",
        (Ref("TypeSafe (2026). Introducing System One models and Jev.", "https://typesafe.ai/blog/introducing-system-one-models-and-jev"),
         Ref("Kahneman, D. (2011). Thinking, Fast and Slow. New York : Farrar, Straus and Giroux.")),
    ),
    Framework(
        "claude", "Claude, un modèle de langage", "Anthropic",
        "Claude est un grand modèle de langage. Lancé à la demande, il sert de second codeur : il code "
        "la même grille sans voir les réponses de Jev, ce qui permet de mesurer leur accord. Il relève "
        "aussi ce qu'un modèle de décision ne sait pas produire : le lexique marqué, les présupposés, "
        "un résumé. Il prépare enfin les tweets anonymisés des jeux et leur traduction anglaise.",
        "Claude est utilisé sur les décisions incertaines de Jev, sur un échantillon de validation et "
        "pour les jeux.",
        (Ref("Anthropic. Claude.", "https://www.anthropic.com/claude"),),
    ),
    Framework(
        "fiabilite", "Mesurer l'accord entre codeurs", "Klaus Krippendorff",
        "Deux codeurs, humains ou machines, ne sont jamais d'accord sur tout. L'alpha de Krippendorff "
        "mesure leur accord en tenant compte du hasard : 1 signifie un accord parfait, 0 un accord "
        "dû au seul hasard. On considère qu'au-dessus de 0,8 une variable est fiable.",
        "L'accord est calculé entre Jev et Claude. Il mesure la convergence de deux modèles, pas la "
        "justesse du codage : deux modèles peuvent partager les mêmes biais.",
        (Ref("Krippendorff, K. (2018). Content Analysis: An Introduction to Its Methodology, 4e éd. Thousand Oaks : Sage."),),
    ),
)
