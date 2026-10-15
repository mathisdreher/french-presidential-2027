"""Livre de codes (codebook) : source unique des catégories utilisées par Jev et par Claude.

Chaque variable est définie une seule fois ici ; les questions Jev et le prompt Claude
sont générés à partir de ces définitions. Les descriptions sont en anglais car l'anglais
est la langue d'entraînement principale de Jev (le contenu des tweets reste en français).

Les dimensions "CDA" sont inspirées de l'approche socio-cognitive de Teun van Dijk :
macrostructures (sujets), sémantique locale (lexique, implicites), carré idéologique
(polarisation Nous/Eux), acteurs et rôles, actes de discours, modalités rhétoriques.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Option:
    key: str
    label: str          # libellé français (rapports, site)
    description: str    # description anglaise (instructions Jev / Claude)


@dataclass(frozen=True)
class Variable:
    key: str
    kind: str                       # "noul" | "choice" | "score"
    label: str
    instructions: str               # question posée au modèle (anglais)
    options: tuple[Option, ...] = field(default_factory=tuple)   # choice
    levels: tuple[str, ...] = field(default_factory=tuple)       # score (ordonné, bas -> haut)
    level_keys: tuple[str, ...] = field(default_factory=tuple)   # clés des niveaux
    block: str = "contenu"          # contenu | position | cda

    @property
    def option_keys(self) -> tuple[str, ...]:
        return tuple(o.key for o in self.options)


# ----------------------------------------------------------------------------- contenu
ECOLOGIE = Variable(
    key="parle_ecologie", kind="noul", label="Parle d'écologie", block="contenu",
    instructions=(
        "The tweet addresses ecology, the environment, climate, biodiversity, pollution, "
        "or energy (nuclear, renewables, electricity prices, grid, energy sobriety), including "
        "when the author criticises ecological policies or activists. Metaphorical uses "
        "('political climate', 'the energy of youth') do NOT count."
    ),
)

NIVEAU = Variable(
    key="niveau", kind="score", label="Niveau de centralité", block="contenu",
    instructions="How central ecology, environment or energy is to this tweet.",
    level_keys=("aucun", "secondaire", "central"),
    levels=(
        "The tweet does not address ecology, environment or energy at all",
        "Ecology, environment or energy is mentioned among other topics, e.g. one item in a list of priorities",
        "Ecology, environment or energy is the main subject of the tweet",
    ),
)

THEMES: tuple[Option, ...] = (
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
    Option("autre_ecologie", "Autre écologie", "Any other ecological or environmental topic not listed above"),
)

POSITION = Variable(
    key="position", kind="choice", label="Position", block="position",
    instructions="The author's stance toward ecological action in this tweet.",
    options=(
        Option("favorable_transition", "Favorable à la transition", "Supports ecological action, proposes or defends environmental or energy-transition measures"),
        Option("critique_ecologie", "Critique de l'écologie", "Criticises ecological policies, norms, activists, or frames ecology as punitive, ideological or harmful"),
        Option("neutre", "Neutre", "States facts, reports information, or the stance is ambiguous"),
        Option("non_applicable", "Non applicable", "The tweet does not address ecology at all"),
    ),
)

# --------------------------------------------------------------------------------- CDA
CADRAGE = Variable(
    key="cadrage", kind="choice", label="Cadrage dominant", block="cda",
    instructions="The dominant frame through which ecology or energy is presented in this tweet.",
    options=(
        Option("urgence_menace", "Urgence et menace", "Ecology as an emergency or existential threat: disasters, heatwaves, irreversible damage"),
        Option("opportunite_economique", "Opportunité économique", "Ecology as growth, innovation, jobs, competitiveness or industrial opportunity"),
        Option("contrainte_punitive", "Contrainte et écologie punitive", "Ecology as a burden: bans, taxes, norms, bureaucracy, loss of freedom or purchasing power"),
        Option("souverainete", "Souveraineté et indépendance", "Energy or food independence, national sovereignty, reducing reliance on foreign supply"),
        Option("justice_sociale", "Justice sociale", "Inequality, protection of modest households, fair distribution of the costs of transition"),
        Option("science_rationalite", "Science et rationalité", "Appeals to science, expertise, pragmatism or technical solutions"),
        Option("identite_terroir", "Identité, terroir, ruralité", "Rural life, farmers, landscapes, local heritage, way of life"),
        Option("sante", "Santé", "Health consequences of pollution, pesticides, air quality"),
        Option("non_applicable", "Non applicable", "The tweet does not address ecology, or no frame can be identified"),
    ),
)

POLARISATION = Variable(
    key="polarisation", kind="choice", label="Polarisation (carré idéologique)", block="cda",
    instructions=(
        "Van Dijk's ideological square: does the tweet emphasise the positive qualities of the author's "
        "own group ('us'), the negative qualities of an out-group ('them'), both, or neither?"
    ),
    options=(
        Option("autopresentation_positive", "Autoprésentation positive", "Emphasises the merits, achievements or values of the author, their party or their camp"),
        Option("presentation_negative_autrui", "Présentation négative d'autrui", "Blames, discredits or attacks an out-group (opponents, institutions, elites, activists)"),
        Option("les_deux", "Les deux", "Both positive self-presentation and negative other-presentation"),
        Option("aucune", "Aucune", "No clear us/them polarisation"),
    ),
)

ADVERSAIRE = Variable(
    key="adversaire", kind="choice", label="Adversaire désigné", block="cda",
    instructions="Who is cast as the opponent, culprit or negative 'other' in this tweet, if anyone.",
    options=(
        Option("gouvernement_executif", "Gouvernement / exécutif", "The current government, the President, ministers, the executive's record"),
        Option("union_europeenne", "Union européenne", "Brussels, EU institutions, EU norms or directives"),
        Option("ecologistes_gauche", "Écologistes / gauche", "Environmental activists, green parties, the left, 'wokism'"),
        Option("droite_extreme_droite", "Droite / extrême droite", "The right, the far right, RN, Reconquête, climate sceptics"),
        Option("lobbies_industries", "Lobbies et industries", "Corporations, lobbies, polluters, multinationals, finance"),
        Option("elites_technocrates_medias", "Élites, technocrates, médias", "Elites, technocrats, experts, media, 'the system'"),
        Option("puissances_etrangeres", "Puissances étrangères", "Foreign countries or powers (China, USA, Russia, Gulf states)"),
        Option("autre_candidat", "Autre candidat", "A named rival candidate for the 2027 election"),
        Option("aucun", "Aucun", "No opponent is designated"),
    ),
)

VICTIME = Variable(
    key="victime", kind="choice", label="Groupe présenté comme victime", block="cda",
    instructions="Which group is presented as suffering, threatened or in need of protection in this tweet.",
    options=(
        Option("menages_modestes", "Ménages modestes", "Low-income households, working classes, people hit by prices or bans"),
        Option("agriculteurs_ruraux", "Agriculteurs et ruraux", "Farmers, fishers, rural inhabitants, small towns"),
        Option("entreprises_industrie", "Entreprises et industrie", "Businesses, industry, workers of a sector threatened by regulation or competition"),
        Option("planete_generations_futures", "Planète et générations futures", "The planet, nature, future generations, humanity as a whole"),
        Option("francais_en_general", "Les Français en général", "The French people or the nation as a whole"),
        Option("aucune", "Aucune", "No victim group is presented"),
    ),
)

ACTE = Variable(
    key="acte_discursif", kind="choice", label="Acte de discours dominant", block="cda",
    instructions="The dominant speech act of the tweet.",
    options=(
        Option("promesse_proposition", "Promesse / proposition", "Announces a measure, a programme commitment, or a plan"),
        Option("critique_attaque", "Critique / attaque", "Criticises or attacks a policy, a person or a group"),
        Option("constat_information", "Constat / information", "Reports facts, figures, events or an agenda without explicit evaluation"),
        Option("appel_mobilisation", "Appel / mobilisation", "Calls to action, to vote, to join, to resist"),
        Option("autre", "Autre", "None of the above (greeting, thanks, anecdote)"),
    ),
)

REGISTRE = Variable(
    key="registre", kind="score", label="Registre émotionnel", block="cda",
    instructions="The emotional register of the tweet.",
    level_keys=("factuel", "engage", "alarmiste_indigne"),
    levels=(
        "Calm and factual: states facts or positions without strong evaluative language",
        "Engaged: clearly evaluative, uses value-laden words, but remains measured",
        "Alarmist or indignant: strong language, outrage, catastrophe, insults, exclamation",
    ),
)

CHIFFRES = Variable(
    key="chiffres", kind="noul", label="Usage de chiffres", block="cda",
    instructions="The tweet uses numbers, statistics, amounts, percentages or dates as arguments (the 'number game').",
)
REACTIVITE = Variable(
    key="reactivite", kind="noul", label="Réaction à l'actualité", block="cda",
    instructions="The tweet reacts to a specific current event (a news item, a vote, a disaster, a statement by someone else).",
)
AUTORITE = Variable(
    key="autorite", kind="noul", label="Appel à l'autorité", block="cda",
    instructions="The tweet invokes an authority to support its point: scientists, a report, experts, an institution, a court, history.",
)

VARIABLES: tuple[Variable, ...] = (
    ECOLOGIE, NIVEAU, POSITION, CADRAGE, POLARISATION, ADVERSAIRE, VICTIME, ACTE, REGISTRE,
    CHIFFRES, REACTIVITE, AUTORITE,
)
CHOICE_VARS = tuple(v for v in VARIABLES if v.kind == "choice")
SCORE_VARS = tuple(v for v in VARIABLES if v.kind == "score")
NOUL_VARS = tuple(v for v in VARIABLES if v.kind == "noul")
THEME_KEYS = tuple(t.key for t in THEMES)

# Valeurs imposées quand le tweet ne parle pas d'écologie (cohérence inter-variables)
NON_ECOLOGIE_DEFAULTS = {
    "niveau": "aucun",
    "themes": [],
    "position": "non_applicable",
    "cadrage": "non_applicable",
}


def codebook_markdown() -> str:
    """Rendu Markdown du livre de codes (documentation, site)."""
    out = ["| Variable | Type | Valeurs |", "|---|---|---|"]
    out.append(f"| `{ECOLOGIE.key}` | oui/non | {ECOLOGIE.instructions} |")
    for v in VARIABLES:
        if v.kind == "choice":
            vals = "<br>".join(f"`{o.key}` : {o.description}" for o in v.options)
        elif v.kind == "score":
            vals = "<br>".join(f"`{k}` : {d}" for k, d in zip(v.level_keys, v.levels))
        else:
            vals = v.instructions
        if v is ECOLOGIE:
            continue
        out.append(f"| `{v.key}` | {v.kind} | {vals} |")
    out.append("| `themes` | multi (oui/non par thème) | " + "<br>".join(f"`{t.key}` : {t.description}" for t in THEMES) + " |")
    return "\n".join(out)
