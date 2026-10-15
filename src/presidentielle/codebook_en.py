"""Version anglaise du livre de codes, pour le site (libellés, cadres théoriques).

Les définitions anglaises des catégories sont celles données aux modèles (`description`
dans codebook.py) : elles servent aussi de définitions aux lecteurs anglophones.
"""

from __future__ import annotations

VARIABLES = {
    "parle_ecologie": "About ecology", "niveau": "Centrality of ecology", "themes": "Themes", "position": "Stance",
    "cadrage": "Dominant frame", "polarisation": "Polarisation", "adversaire": "Designated opponent",
    "victime": "Designated victim", "procedes": "Devices", "topoi": "Topoi", "legitimation": "Legitimation",
    "retardement": "Climate delay", "vision": "Vision of ecology", "ethos": "Ethos", "agentivite": "Agency",
    "modalite": "Modality", "acte_discursif": "Speech act", "registre": "Emotional register",
    "reactivite": "Reacting to the news", "echelle": "Scale of action", "horizon": "Time horizon",
}

OPTIONS = {
    "niveau": {"aucun": "Absent", "secondaire": "Secondary", "central": "Central"},
    "themes": {
        "climat": "Climate", "energie_nucleaire": "Nuclear power", "energies_renouvelables": "Renewables",
        "prix_energie_reseau": "Energy prices and grid", "sobriete_efficacite": "Sobriety and efficiency",
        "transports_mobilite": "Transport and mobility", "biodiversite_nature": "Biodiversity and nature",
        "agriculture_alimentation": "Farming and food", "pollution_sante": "Pollution and health", "eau": "Water",
        "industrie_verte_emploi": "Green industry and jobs", "fiscalite_normes": "Taxes and regulation",
        "international_europe": "International and Europe", "autre_ecologie": "Other",
    },
    "position": {"favorable_transition": "Supports the transition", "critique_ecologie": "Critical of ecology",
                 "neutre": "Neutral", "non_applicable": "Not applicable"},
    "cadrage": {
        "urgence_menace": "Emergency and threat", "opportunite_economique": "Economic opportunity",
        "contrainte_punitive": "Burden, punitive ecology", "souverainete": "Sovereignty and independence",
        "justice_sociale": "Social justice", "science_rationalite": "Science and rationality",
        "identite_terroir": "Identity, land, rural life", "sante": "Health", "non_applicable": "Not applicable",
    },
    "polarisation": {"autopresentation_positive": "Positive self-presentation",
                     "presentation_negative_autrui": "Negative other-presentation", "les_deux": "Both", "aucune": "None"},
    "adversaire": {
        "gouvernement_executif": "Government, executive", "union_europeenne": "European Union",
        "ecologistes_gauche": "Greens, the left", "droite_extreme_droite": "Right, far right",
        "lobbies_industries": "Lobbies, industries", "elites_technocrates_medias": "Elites, technocrats, media",
        "puissances_etrangeres": "Foreign powers", "autre_candidat": "Another candidate", "aucun": "None",
    },
    "victime": {
        "menages_modestes": "Low-income households", "agriculteurs_ruraux": "Farmers, rural people",
        "entreprises_industrie": "Businesses, industry", "planete_generations_futures": "Planet, future generations",
        "francais_en_general": "The French", "aucune": "None",
    },
    "procedes": {
        "denegation": "Apparent denial", "consensus": "Appeal to consensus", "victimisation": "Victimisation",
        "euphemisme": "Euphemism", "hyperbole": "Hyperbole", "generalisation": "Generalisation",
        "glorification_nationale": "National self-glorification", "comparaison": "Comparison",
        "contrefactuel": "Counterfactual", "illustration": "Illustration", "ironie": "Irony", "metaphore": "Metaphor",
        "norme": "Norm expression", "jeu_des_chiffres": "Number game", "autorite": "Appeal to authority",
        "populisme": "Populism",
    },
    "topoi": {
        "utilite": "Usefulness", "danger_menace": "Danger, threat", "humanitarisme": "Humanitarianism",
        "justice": "Justice, equality", "responsabilite": "Responsibility", "fardeau": "Burden", "finances": "Cost",
        "realite": "Reality", "histoire": "History", "droit_loi": "Law", "urgence": "Urgency",
        "culture_identite": "Culture, identity",
    },
    "legitimation": {"autorisation": "Authority", "evaluation_morale": "Moral evaluation",
                     "rationalisation": "Rationalisation", "mythopoese": "Narrative"},
    "retardement": {
        "individualisme": "Individualism", "whataboutisme": "Whataboutism", "passager_clandestin": "Free-rider excuse",
        "optimisme_technologique": "Technological optimism", "beaucoup_de_paroles": "All talk, little action",
        "solutionnisme_fossile": "Fossil fuel solutionism", "pas_de_contrainte": "No sticks, just carrots",
        "justice_sociale": "Appeal to social justice", "bien_etre": "Appeal to well-being",
        "perfectionnisme": "Policy perfectionism", "changement_impossible": "Change is impossible", "fatalisme": "Doomism",
    },
    "vision": {
        "survivalisme": "Survivalism", "prometheen": "Promethean", "rationalisme_administratif": "Administrative rationalism",
        "pragmatisme_democratique": "Democratic pragmatism", "rationalisme_economique": "Economic rationalism",
        "developpement_durable": "Sustainable development", "modernisation_ecologique": "Ecological modernisation",
        "radicalisme_vert": "Green radicalism", "non_applicable": "Not applicable",
    },
    "ethos": {
        "expert": "Competent expert", "homme_d_etat": "Statesman", "protecteur": "Protector", "combattant": "Fighter",
        "proche": "Close to people", "rassembleur": "Unifier", "visionnaire": "Visionary", "indetermine": "Undetermined",
    },
    "agentivite": {"responsable_nomme": "Responsible party named", "responsable_efface": "Responsible party hidden",
                   "locuteur_agent": "The candidate acts", "non_applicable": "Not applicable"},
    "modalite": {"obligation": "Obligation", "certitude": "Certainty", "possibilite": "Possibility",
                 "engagement": "Commitment", "assertion": "Plain assertion"},
    "acte_discursif": {"promesse_proposition": "Promise, proposal", "critique_attaque": "Criticism, attack",
                       "constat_information": "Statement, information", "appel_mobilisation": "Call to action", "autre": "Other"},
    "registre": {"factuel": "Factual", "engage": "Engaged", "alarmiste_indigne": "Alarmist, indignant"},
    "echelle": {"individus": "Individuals", "territoires": "Local level", "etat_nation": "State and nation",
                "europe_international": "Europe and the world", "entreprises_marche": "Business and markets", "non_applicable": "Not applicable"},
    "horizon": {"passe_nostalgie": "Past to regain", "passe_accusation": "Past on trial", "present_urgence": "Present and urgency",
                "futur_projet": "Future and plans", "non_applicable": "Not applicable"},
}

# clé -> (libellé, auteurs, ce que dit la théorie, comment elle est codée ici)
FRAMEWORKS = {
    "macro": (
        "Topics and macrostructures", "Teun A. van Dijk",
        "For van Dijk, a text is organised around a few dominant topics, its macrostructures. What is talked about, "
        "and what is not, is already a choice: a candidate's agenda reveals what they consider important and what "
        "they want to make visible.",
        "For each tweet: does it address ecology, broadly including energy, how centrally, and which themes? "
        "A criticism of ecology counts as a tweet about ecology.",
    ),
    "cadrage": (
        "Framing and stance", "Robert Entman, George Lakoff",
        "To frame is to select some aspects of reality and make them more salient, so as to promote a particular "
        "problem definition, causal interpretation, moral evaluation and remedy. The same topic, electric cars for "
        "instance, can be framed as a climate emergency, a burden on purchasing power or a matter of industrial "
        "sovereignty.",
        "The dominant frame of each ecology tweet, and the candidate's stance: supportive of ecological action, "
        "critical, or neutral.",
    ),
    "carre": (
        "The ideological square", "Teun A. van Dijk",
        "Ideological discourse polarises between an “us” and a “them”. Van Dijk sums it up as a square: emphasise "
        "our good things, emphasise their bad things, play down our bad things, play down their good things. Who is "
        "cast as the opponent, and who as the victim, says a lot about how a candidate builds their camp.",
        "For each tweet: positive self-presentation, negative other-presentation, both or neither; the designated "
        "opponent; the group presented as a victim.",
    ),
    "procedes": (
        "Devices of ideological discourse", "Teun A. van Dijk",
        "Van Dijk catalogued the devices through which an ideology is expressed in discourse: apparent denial, "
        "appeal to consensus, the number game, euphemism, hyperbole, generalisation, victimisation and others. None "
        "is ideological in itself; using them to serve a camp is.",
        "Sixteen devices are detected in each tweet; a tweet can contain several.",
    ),
    "topoi": (
        "Argumentative topoi", "Ruth Wodak, Martin Reisigl",
        "Wodak's discourse-historical approach identifies topoi, argumentative shortcuts that link an argument to a "
        "conclusion without spelling it out: “if it is dangerous, we must act”, “if it costs too much, we must give "
        "it up”, “let's be realistic”. They show how each camp justifies its position, beyond being for or against.",
        "Twelve topoi are detected in each tweet; a tweet can use several.",
    ),
    "legitimation": (
        "Legitimation", "Theo van Leeuwen",
        "To get a policy accepted or rejected, one legitimises or delegitimises it. Van Leeuwen distinguishes four "
        "resources: authority (an expert, the law, tradition), moral evaluation (it is right, it is natural), "
        "rationalisation (it is useful, it works) and narrative (a story that rewards or punishes).",
        "The four resources are detected in each tweet; a tweet can combine several.",
    ),
    "retardement": (
        "Discourses of climate delay", "William Lamb and co-authors",
        "Outright climate denial has become rare. Lamb and co-authors show that climate action is more often delayed "
        "by discourses that accept the problem but push the solution away: redirecting responsibility, pushing "
        "non-transformative solutions, emphasising the downsides, or surrendering. They identify twelve of them.",
        "The twelve discourses are detected in ecology tweets. Spotting a delay discourse says nothing about its "
        "author's sincerity: some arguments, such as social justice, are also legitimate concerns.",
    ),
    "visions": (
        "Visions of ecology", "John Dryzek",
        "Dryzek classifies environmental discourses along two questions: does growth have limits, and should the "
        "system be changed in depth or adjusted? He derives a typology ranging from the Promethean discourse, which "
        "trusts progress, to green radicalism, which wants to change ways of life.",
        "The dominant vision of each ecology tweet.",
    ),
    "ethos": (
        "Ethos", "Dominique Maingueneau, Ruth Amossy",
        "Every discourse builds an image of the speaker, the ethos. A candidate does not say “I am competent”: they "
        "show it through the way they speak, with figures and files to back it up. The ethos can be that of the "
        "expert, the protector, the fighter or the statesman.",
        "The dominant self-image built by each tweet.",
    ),
    "grammaire": (
        "Who acts, and in what tone", "Norman Fairclough, Michael Halliday",
        "Grammar is not neutral. “Prices are rising” erases who is responsible; “the government is raising prices” "
        "names them. Likewise, “we must”, “I will” or “it is certain” commit the speaker differently. Fairclough "
        "draws on Halliday's grammar to show how these choices build power relations.",
        "For each tweet: is the agent of the action named, hidden, or is it the candidate themselves; and which "
        "modality dominates: obligation, certainty, possibility, commitment or plain assertion.",
    ),
    "enonciation": (
        "Acts, emotions and context", "John Austin, John Searle, James Martin and Peter White",
        "To speak is to act: promising, attacking, informing or calling to action are speech acts. The emotional "
        "register, from factual to indignant, belongs to evaluation. Finally, a tweet often responds to the news: "
        "van Dijk speaks of context models.",
        "The dominant speech act, the emotional register, and whether the tweet reacts to a specific event.",
    ),
    "appropriation": (
        "Issue ownership", "John Petrocik",
        "According to Petrocik, each party “owns” certain issues in voters' eyes: it is seen as more credible on them "
        "and has an interest in talking about them. Ecology is traditionally associated with the greens and the left. "
        "Other candidates can ignore it, or approach it from an angle they own, such as energy and its price.",
        "Computed without any model: the thematic profile of each candidate's ecology tweets is compared with that "
        "of each political family.",
    ),
    "formules": (
        "Formulas", "Alice Krieg-Planque",
        "A formula is a short expression that, at a given moment, circulates, becomes an issue and sparks "
        "controversy: “punitive ecology”, “ecological planning”, “sobriety”. Tracking who launches a formula, who "
        "picks it up, diverts or contests it, means following a battle to impose the words of the debate.",
        "Computed without any model: each formula in config/formules.yaml is detected through its variants in the "
        "tweets, with its first use and how it spreads. Formulas are quoted in French, the language of the debate.",
    ),
    "boussole": (
        "The ecology compass", "Built for this site, after John Dryzek",
        "The compass places each candidate on two axes computed from their ecology tweets. The horizontal axis "
        "measures stance: each tweet supporting ecological action counts +1, each critical tweet −1, a neutral tweet "
        "0. The vertical axis measures the view of growth, after Dryzek's typology: survivalism and green radicalism, "
        "which set limits to growth, count +1; the Promethean discourse, which denies them, −1; ecological "
        "modernisation and economic rationalism, which bet on green growth and the market, −0.5; other visions 0.",
        "This is an index built for this site, for teaching purposes: it sums up two dimensions among others and "
        "depends on the quality of the coding. Candidates with fewer than 8 ecology tweets are not placed.",
    ),
    "echelle_horizon": (
        "Scale and horizon", "Michael Maniates; Reinhart Koselleck; Zygmunt Bauman",
        "Who is expected to make the ecological effort, and which time does the speaker look to? Maniates showed how "
        "environmental discourse 'individualises' responsibility: gestures, consumption, everyone for themselves, at the "
        "expense of collective choices. Koselleck distinguishes the 'space of experience' (the past one draws on) from "
        "the 'horizon of expectation' (the future one promises); Bauman calls a political ideal turned towards a lost "
        "past 'retrotopia'.",
        "For each ecology tweet: at which scale action is placed (individuals, local level, State and nation, Europe and "
        "the world, business and markets) and which time dominates (past to regain, past on trial, present and urgency, "
        "future and plans).",
    ),
    "engagement": (
        "Relative engagement", "A measure built for this site, after studies of online engagement",
        "A tweet's raw figures depend first on how well known its author is: a candidate followed by two million "
        "accounts mechanically gets more reactions than another. To compare, each tweet is set against its author's "
        "habit: relative engagement is the number of interactions (likes, reposts, replies, quotes) divided by the "
        "median interactions of their tweets. ×2 means twice as many reactions as usual, ×0.5 half as many. Research "
        "on social networks shows that emotion and moral outrage help a message spread.",
        "Interactions are recorded 48 hours after posting, once most reactions are in, so that all tweets are "
        "compared at the same age; tweets collected before this measure was set up were read again later. The "
        "median is only computed for candidates with at least 10 measured tweets. Views are shown separately: they "
        "measure exposure, not reaction.",
    ),
    "reseau": (
        "The network of the debate", "Network analysis; Mathieu Jacomy and co-authors (Gephi), Vincent Blondel and co-authors",
        "Four networks link the candidates: to the formulas they use, to the topics they cover, to each other by how similar "
        "their ecology discourse is, and to each other by who names whom. Two points close together in the drawing share "
        "expressions, subjects or a way of speaking; a formula in the centre travels between camps. The positions have no "
        "unit: only proximity matters.",
        "Computed in your browser with a spring layout close to ForceAtlas2, Gephi's algorithm. Proximity: each candidate "
        "has a profile (share of their ecology tweets in each category of topic, position, framing, vision, delay, adversary "
        "and topoi, each variable weighing the same); they are linked to the three closest profiles (cosine similarity), "
        "and groups are detected with the Louvain method. Who names whom: a link goes from a tweet's author to every other "
        "candidate whose @account or name appears in it. The .gexf file opens in Gephi for a full analysis.",
    ),
    "lexique": (
        "Lexicometry", "Ludovic Lebart, André Salem, Ted Dunning",
        "Lexicometry, a French tradition in political discourse analysis, counts words without interpreting them. "
        "It looks for a speaker's distinctive vocabulary: the words they use significantly more than others.",
        "Computed without any model: for each candidate, the words of their ecology tweets most over-represented "
        "compared with the other candidates, according to Dunning's log-likelihood ratio. A word must appear in at "
        "least two tweets; tweets in other languages, stop words, numbers and the candidate's own name are left out, "
        "and a word counts at most three times per tweet. Words stay in French.",
    ),
    # moteurs
    "jev": (
        "Jev, a decision model", "TypeSafe",
        "Jev is a “System One” model, by analogy with the fast thinking described by Kahneman: it does not write "
        "text, it answers closed questions. For each variable, it returns a probability for each possible answer "
        "and a confidence score. It codes all new tweets every day.",
        "Each tweet receives about 70 questions in parallel. Category definitions are written in English, Jev's main "
        "language; tweets stay in French.",
    ),
    "claude": (
        "Claude, a language model", "Anthropic",
        "Claude is a large language model. Run on demand, it serves as a second coder: it codes the same grid "
        "without seeing Jev's answers, which makes it possible to measure their agreement. It also records what a "
        "decision model cannot produce: loaded vocabulary, presuppositions, a summary. Finally, it prepares the "
        "anonymised tweets for the games, with their English translation.",
        "Claude is used on Jev's uncertain decisions, on a validation sample and for the games.",
    ),
    "confiance": (
        "Jev's confidence", "TypeSafe; calibration after Guo and co-authors",
        "For each decision, Jev gives a probability (yes or no question) or a calibrated confidence score (choice "
        "between categories). Calibrated means that a decision made with a confidence of 0.8 should be right about 8 "
        "times out of 10. Showing this confidence makes the coding auditable: you can see where the model hesitates.",
        "Three levels. Low: probability of ecology between 0.3 and 0.7, or confidence below 0.6 on stance, frame or "
        "how central ecology is; this is the rule that sends the decision to Claude when it runs. Medium: confidence "
        "up to 0.8 (probability up to 0.9 for ecology). High above that. The Method tab shows whether agreement with "
        "Claude rises with Jev's confidence, a sign of well-calibrated confidence.",
    ),
    "fiabilite": (
        "Measuring agreement between coders", "Klaus Krippendorff",
        "Two coders, human or machine, never agree on everything. Krippendorff's alpha measures their agreement "
        "while accounting for chance: 1 means perfect agreement, 0 agreement due to chance alone. A variable is "
        "usually considered reliable above 0.8.",
        "Agreement is computed between Jev and Claude. It measures how two models converge, not whether the coding "
        "is right: two models can share the same biases.",
    ),
}
