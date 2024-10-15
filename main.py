import streamlit as st
from firecrawl import FirecrawlApp
from swarm import Agent
from openai import OpenAI
import validators  # Für die URL-Validierung

# Streamlit App Layout
st.set_page_config(
    page_title="Editorial Nachrichten Assistent",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📰 Editorial Nachrichten Assistent")
st.markdown("""
Willkommen beim **Editorial Nachrichten Assistenten**! Geben Sie die URL eines Nachrichtenartikels ein, und unser Assistent erstellt für Sie ein umfassendes Editorial, indem er die Inhalte scrapt, analysiert, faktenprüft, zusammenfasst und bearbeitet.
""")

# Sidebar für API-Schlüssel Eingaben und Stil-Anweisungen
st.sidebar.header("API-Konfiguration")

firecrawl_api_key = st.sidebar.text_input(
    "Firecrawl API-Schlüssel",
    type="password",
    help="Geben Sie hier Ihren Firecrawl API-Schlüssel ein."
)

openai_api_key = st.sidebar.text_input(
    "OpenAI API-Schlüssel",
    type="password",
    help="Geben Sie hier Ihren OpenAI API-Schlüssel ein."
)

# Initialisierung von FirecrawlApp und OpenAI nur wenn API-Schlüssel bereitgestellt werden
if firecrawl_api_key and openai_api_key:
    try:
        app = FirecrawlApp(api_key=firecrawl_api_key)
        client = OpenAI(api_key=openai_api_key)
    except Exception as e:
        st.sidebar.error(f"Fehler bei der Initialisierung der APIs: {str(e)}")
        st.stop()
else:
    st.sidebar.warning("Bitte geben Sie sowohl den Firecrawl- als auch den OpenAI-API-Schlüssel ein, um fortzufahren.")
    st.stop()

def scrape_website(url):
    """Eine Website mit Firecrawl scrapen."""
    try:
        scrape_response = app.scrape_url(
            url,
            params={'formats': ['markdown']}
        )
        st.write("🔍 Scrape-Antwort:", scrape_response)  # Debugging-Anweisung

        # Überprüfen ob 'markdown' im Antwort enthält
        if isinstance(scrape_response, dict) and 'markdown' in scrape_response:
            return scrape_response['markdown']
        else:
            raise KeyError("Weder der Schlüssel 'markdown' noch 'content' sind in der Scrape-Antwort vorhanden.")

    except Exception as e:
        st.error(f"Ein Fehler ist beim Scrapen aufgetreten: {str(e)}")
        return None

def generate_completion(role, task, content):
    """Generiere eine Vervollständigung mit OpenAI."""
    try:
        response = client.chat.completions.create(
            model="gpt-4",  # Stellen Sie sicher, dass der Modellname korrekt ist
            messages=[
                {"role": "system", "content": f"Du bist ein {role}. {task}"},
                {"role": "user", "content": content}
            ]
        )
        completion = response.choices[0].message.content.strip()
        return completion
    except Exception as e:
        st.error(f"Ein Fehler ist bei der Generierung der Vervollständigung aufgetreten: {str(e)}")
        return None

def analyze_website_content(content):
    """Analysiere den gescrapten Website-Inhalt für wichtige Erkenntnisse."""
    analysis = generate_completion(
        "Inhaltsanalyst",
        "Analysiere den folgenden Nachrichteninhalt und gib wichtige Erkenntnisse, einschließlich Relevanz, Bedeutung und potenzieller Auswirkungen.",
        content
    )
    if not analysis:
        st.error("Inhalt konnte nicht analysiert werden.")
    return analysis

def fact_check_content(content):
    """Faktenprüfe den bereitgestellten Inhalt."""
    fact_check = generate_completion(
        "Faktenprüfer",
        "Überprüfe die faktische Genauigkeit des folgenden Nachrichteninhalts. Hebe eventuelle Unstimmigkeiten hervor oder bestätige die Gültigkeit der Informationen.",
        content
    )
    if not fact_check:
        st.error("Inhalt konnte nicht faktengeprüft werden.")
    return fact_check

def summarize_content(content):
    """Fasse den Nachrichteninhalt zusammen in Text, Zitate und Tabelle."""
    summary = generate_completion(
        "Zusammenfasser",
        "Erstelle eine prägnante Zusammenfassung des folgenden Nachrichtenartikels. Teile die Zusammenfassung in drei Teile auf: \n1. Zusammenfassung als Text \n2. Die wichtigsten Zitate mit Personen- oder Herkunftsangabe \n3. Die wichtigsten Fakten als kleine Tabelle.",
        content
    )
    if not summary:
        st.error("Inhalt konnte nicht zusammengefasst werden.")
    return summary

def generate_editorial(analysis, fact_check, summary, style_instructions):
    """Generiere ein Editorial basierend auf Analyse, Faktenprüfung, Zusammenfassung und Stil-Anweisungen."""
    if not all([analysis, fact_check, summary, style_instructions]):
        st.error("Es fehlen Komponenten zur Generierung des Editorials.")
        return None
    editorial = generate_completion(
        "Redakteur",
        "Verfasse einen gut strukturierten Editorial-Artikel unter Verwendung der folgenden Analyse, Faktenprüfung, Zusammenfassung und Stil-Anweisungen.",
        f"Analyse: {analysis}\nFaktenprüfung: {fact_check}\nZusammenfassung:\n{summary}\nStil-Anweisungen: {style_instructions}"
    )
    if not editorial:
        st.error("Editorial konnte nicht generiert werden.")
    return editorial

# Definition der Agenten

def handoff_to_scraper():
    """Übergebe die URL an den Website Scraper Agent."""
    return website_scraper_agent

def handoff_to_analyzer():
    """Übergebe den gescrapten Inhalt an den Content Analyzer Agent."""
    return content_analyzer_agent

def handoff_to_fact_checker():
    """Übergebe den Inhalt an den Faktenprüfer Agent."""
    return fact_checker_agent

def handoff_to_summarizer():
    """Übergebe den Inhalt an den Zusammenfasser Agent."""
    return summarizer_agent

def handoff_to_editor(style_instructions):
    """Übergebe die analysierten, faktengeprüften, zusammengefassten Inhalte und Stil-Anweisungen an den Redakteur Agent."""
    return editor_agent

user_interface_agent = Agent(
    name="Benutzeroberflächen-Agent",
    instructions=(
        "Du bist ein Benutzeroberflächen-Agent, der die Interaktionen mit dem Benutzer verwaltet. "
        "Beginne damit, nach einer URL einer Nachrichtenwebsite zu fragen, für die der Benutzer ein Editorial erstellen möchte. "
        "Stelle bei Bedarf Klärungsfragen. Sei klar und prägnant."
    ),
    functions=[handoff_to_scraper],
)

website_scraper_agent = Agent(
    name="Website Scraper Agent",
    instructions="Du bist ein Website Scraper Agent, spezialisiert auf das Extrahieren von Inhalten aus Nachrichtenwebsites.",
    functions=[scrape_website, handoff_to_analyzer],
)

content_analyzer_agent = Agent(
    name="Inhaltsanalyst Agent",
    instructions=(
        "Du bist ein Inhaltsanalyst Agent, der gescrapten Nachrichteninhalt auf wichtige Erkenntnisse und Relevanz untersucht. "
        "Biete eine gründliche Analyse zur Unterstützung der Editorial-Erstellung. Sei prägnant."
    ),
    functions=[analyze_website_content, handoff_to_fact_checker],
)

fact_checker_agent = Agent(
    name="Faktenprüfer Agent",
    instructions=(
        "Du bist ein Faktenprüfer Agent, verantwortlich für die Überprüfung der Genauigkeit des Nachrichteninhalts. "
        "Identifiziere und hebe eventuelle Unstimmigkeiten hervor oder bestätige die Gültigkeit der Informationen. Sei präzise."
    ),
    functions=[fact_check_content, handoff_to_summarizer],
)

summarizer_agent = Agent(
    name="Zusammenfasser Agent",
    instructions=(
        "Du bist ein Zusammenfasser Agent, beauftragt mit der Verdichtung des Nachrichteninhalts zu einer prägnanten Zusammenfassung. "
        "Stelle sicher, dass die Zusammenfassung in drei Teile aufgeteilt ist: \n1. Zusammenfassung als Text \n2. Die wichtigsten Zitate mit Personen- oder Herkunftsangabe \n3. Die wichtigsten Fakten als kleine Tabelle. Sei klar und bündig."
    ),
    functions=[summarize_content, handoff_to_editor],
)

editor_agent = Agent(
    name="Redakteur Agent",
    instructions=(
        "Du bist ein Redakteur Agent, verantwortlich für das Verfassen eines ausgefeilten Editorial-Artikels. "
        "Nutze die Analyse, Faktenprüfung, Zusammenfassung und Stil-Anweisungen, um ein kohärentes und ansprechendes Stück zu erstellen. "
        "Stelle sicher, dass das Editorial gut strukturiert und fehlerfrei ist."
    ),
    functions=[generate_editorial],
)

# Definition des Arbeitsablaufs
def run_agents(url, style_instructions, second_url=None):
    try:
        # Schritt 1: Website Scrapen
        scraped_content = scrape_website(url)
        if not scraped_content:
            st.error("🔴 Das Scrapen der Website ist fehlgeschlagen. Bitte überprüfen Sie die URL und versuchen Sie es erneut.")
            return None
        st.success("✅ Website erfolgreich gescrapt.")

        # Schritt 2: Inhalt Analysieren
        analysis = analyze_website_content(scraped_content)
        if not analysis:
            st.error("🔴 Inhalt konnte nicht analysiert werden.")
            return None
        st.info("📝 Inhalt analysiert.")

        # Schritt 3: Faktenprüfen
        fact_check = fact_check_content(scraped_content)
        if not fact_check:
            st.error("🔴 Inhalt konnte nicht faktengeprüft werden.")
            return None
        st.info("🔍 Inhalt faktengeprüft.")

        # Schritt 4: Zusammenfassen
        summary = summarize_content(scraped_content)
        if not summary:
            st.error("🔴 Inhalt konnte nicht zusammengefasst werden.")
            return None
        st.info("📝 Inhalt zusammengefasst.")

        # Optional: Zweite Quelle scrapen und verarbeiten
        if second_url:
            st.markdown("---")
            st.subheader("📎 Zweite Quelle hinzufügen")
            st.info("Verarbeite die zweite Quelle...")

            scraped_content_2 = scrape_website(second_url)
            if not scraped_content_2:
                st.error("🔴 Das Scrapen der zweiten Website ist fehlgeschlagen. Bitte überprüfen Sie die URL und versuchen Sie es erneut.")
                return None
            st.success("✅ Zweite Website erfolgreich gescrapt.")

            analysis_2 = analyze_website_content(scraped_content_2)
            if not analysis_2:
                st.error("🔴 Inhalt der zweiten Quelle konnte nicht analysiert werden.")
                return None
            st.info("📝 Inhalt der zweiten Quelle analysiert.")

            fact_check_2 = fact_check_content(scraped_content_2)
            if not fact_check_2:
                st.error("🔴 Inhalt der zweiten Quelle konnte nicht faktengeprüft werden.")
                return None
            st.info("🔍 Inhalt der zweiten Quelle faktengeprüft.")

            summary_2 = summarize_content(scraped_content_2)
            if not summary_2:
                st.error("🔴 Inhalt der zweiten Quelle konnte nicht zusammengefasst werden.")
                return None
            st.info("📝 Inhalt der zweiten Quelle zusammengefasst.")

            # Kombinieren der Analysen, Faktenprüfungen und Zusammenfassungen
            combined_analysis = f"{analysis}\n\nZusätzliche Analyse der zweiten Quelle:\n{analysis_2}"
            combined_fact_check = f"{fact_check}\n\nZusätzliche Faktenprüfung der zweiten Quelle:\n{fact_check_2}"
            combined_summary = f"{summary}\n\nZusätzliche Zusammenfassung der zweiten Quelle:\n{summary_2}"
        else:
            combined_analysis = analysis
            combined_fact_check = fact_check
            combined_summary = summary

        # Schritt 5: Editorial Generieren
        editorial = generate_editorial(combined_analysis, combined_fact_check, combined_summary, style_instructions)
        if not editorial:
            st.error("🔴 Editorial konnte nicht generiert werden.")
            return None
        st.success("📰 Editorial erfolgreich erstellt.")

        return {
            "Analyse": combined_analysis,
            "Faktenprüfung": combined_fact_check,
            "Zusammenfassung": combined_summary,
            "Editorial": editorial
        }
    except Exception as e:
        st.error(f"Ein unerwarteter Fehler ist aufgetreten: {str(e)}")
        return None

# Streamlit App Hauptoberfläche
with st.form(key='news_form'):
    url = st.text_input("Geben Sie die URL des Nachrichtenartikels ein:", "")
    style_instructions = st.text_input("Geben Sie Ihre Stil-Anweisungen für das Editorial ein:", "")
    second_url = st.text_input("Geben Sie eine zweite URL für zusätzliche Informationen ein (optional):", "")
    submit_button = st.form_submit_button(label='Editorial Generieren')

if submit_button:
    if not url:
        st.error("Bitte geben Sie eine gültige URL ein.")
    elif not validators.url(url):
        st.error("Die eingegebene URL ist ungültig. Bitte geben Sie eine korrekte URL ein.")
    elif style_instructions.strip() == "":
        st.error("Bitte geben Sie Ihre Stil-Anweisungen ein.")
    elif second_url and not validators.url(second_url):
        st.error("Die eingegebene zweite URL ist ungültig. Bitte geben Sie eine korrekte URL ein.")
    else:
        with st.spinner("Verarbeitung..."):
            results = run_agents(url, style_instructions, second_url if second_url else None)
            if results:
                st.subheader("🔍 Analyse")
                st.write(results["Analyse"])

                st.subheader("🔍 Faktenprüfung")
                st.write(results["Faktenprüfung"])

                st.subheader("📝 Zusammenfassung")
                st.write(results["Zusammenfassung"])

                st.subheader("📰 Editorial")
                st.write(results["Editorial"])
