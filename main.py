import streamlit as st
from firecrawl import FirecrawlApp
from swarm import Agent
from openai import OpenAI
import validators  # Falls Sie die URL-Validierung nutzen möchten

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

# Sidebar für API-Schlüssel Eingaben
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
    """Fasse den Nachrichteninhalt zusammen."""
    summary = generate_completion(
        "Zusammenfasser",
        "Erstelle eine prägnante Zusammenfassung des folgenden Nachrichtenartikels.",
        content
    )
    if not summary:
        st.error("Inhalt konnte nicht zusammengefasst werden.")
    return summary

def generate_editorial(analysis, fact_check, summary):
    """Generiere ein Editorial basierend auf Analyse, Faktenprüfung und Zusammenfassung."""
    if not all([analysis, fact_check, summary]):
        st.error("Es fehlen Komponenten zur Generierung des Editorials.")
        return None
    editorial = generate_completion(
        "Redakteur",
        "Verfasse einen gut strukturierten Editorial-Artikel unter Verwendung der folgenden Analyse, Faktenprüfung und Zusammenfassung.",
        f"Analyse: {analysis}\nFaktenprüfung: {fact_check}\nZusammenfassung: {summary}"
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

def handoff_to_editor():
    """Übergebe die analysierten und zusammengefassten Inhalte an den Redakteur Agent."""
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
        "Stelle sicher, dass die Zusammenfassung alle wesentlichen Punkte erfasst. Sei klar und bündig."
    ),
    functions=[summarize_content, handoff_to_editor],
)

editor_agent = Agent(
    name="Redakteur Agent",
    instructions=(
        "Du bist ein Redakteur Agent, verantwortlich für das Verfassen eines ausgefeilten Editorial-Artikels. "
        "Nutze die Analyse, Faktenprüfung und Zusammenfassung, um ein kohärentes und ansprechendes Stück zu erstellen. "
        "Stelle sicher, dass das Editorial gut strukturiert und fehlerfrei ist."
    ),
    functions=[generate_editorial],
)

# Definition des Arbeitsablaufs
def run_agents(url):
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

        # Schritt 5: Editorial Generieren
        editorial = generate_editorial(analysis, fact_check, summary)
        if not editorial:
            st.error("🔴 Editorial konnte nicht generiert werden.")
            return None
        st.success("📰 Editorial erfolgreich erstellt.")

        return {
            "Analyse": analysis,
            "Faktenprüfung": fact_check,
            "Zusammenfassung": summary,
            "Editorial": editorial  # **Achten Sie darauf, dass hier ein Komma steht, wenn noch weitere Elemente folgen**
        }
    except Exception as e:
        st.error(f"Ein unerwarteter Fehler ist aufgetreten: {str(e)}")
        return None

# Streamlit App Hauptoberfläche
with st.form(key='news_form'):
    url = st.text_input("Geben Sie die URL des Nachrichtenartikels ein:", "")
    submit_button = st.form_submit_button(label='Editorial Generieren')

if submit_button:
    if not url:
        st.error("Bitte geben Sie eine gültige URL ein.")
    else:
        with st.spinner("Verarbeitung..."):
            results = run_agents(url)
            if results:
                st.subheader("🔍 Analyse")
                st.write(results["Analyse"])

                st.subheader("🔍 Faktenprüfung")
                st.write(results["Faktenprüfung"])

                st.subheader("📝 Zusammenfassung")
                st.write(results["Zusammenfassung"])

                st.subheader("📰 Editorial")
                st.write(results["Editorial"])
