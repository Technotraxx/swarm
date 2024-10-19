import os
import logging
from typing import Dict, Any
import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI
from firecrawl import FirecrawlApp
from swarm import Agent
from swarm.repl import run_demo_loop
from serpapi import GoogleSearch
import json
import pandas as pd

# Define dictionaries for country and language options
COUNTRIES = {
    "United States": "us",
    "United Kingdom": "uk",
    "France": "fr",
    "Germany": "de",
    "Japan": "jp",
    "Australia": "au",
    "Canada": "ca",
    "India": "in",
    "Brazil": "br",
    "Spain": "es"
}

LANGUAGES = {
    "English": "en",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Japanese": "ja",
    "Portuguese": "pt",
    "Italian": "it",
    "Russian": "ru",
    "Chinese (Simplified)": "zh-CN",
    "Arabic": "ar"
}

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Streamlit app title
st.title("Web Scraping and Analysis App")

# Sidebar for API key inputs
st.sidebar.header("API Keys")
firecrawl_api_key = st.sidebar.text_input("Firecrawl API Key", type="password")
openai_api_key = st.sidebar.text_input("OpenAI API Key", type="password")
serp_api_key = st.sidebar.text_input("SERP API Key", type="password")

# Initialize FirecrawlApp and OpenAI if API keys are provided
if firecrawl_api_key and openai_api_key and serp_api_key:
    app = FirecrawlApp(api_key=firecrawl_api_key)
    client = OpenAI(api_key=openai_api_key)
else:
    st.warning("Please enter all API keys in the sidebar to use the app.")
    st.stop()

def generate_completion(role: str, prompt: str, content: str = "") -> str:
    """Generate a completion using OpenAI."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # or "gpt-3.5-turbo" if you prefer
            messages=[
                {"role": "system", "content": f"You are a {role}. Analyze the content based on the given instructions."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        st.error(f"Error generating completion: {e}")
        return ""

def search_google(query: str, objective: str, search_type: str, country: str, language: str) -> Dict[str, Any]:
    """Search Google or Google News using SerpAPI."""
    try:
        st.info(f"Searching {search_type} for: {query}")
        params = {
            "q": query,
            "api_key": serp_api_key,
            "gl": country,
            "hl": language
        }
        
        if search_type == "Google News":
            params["engine"] = "google_news"
        else:
            params["engine"] = "google"
        
        search = GoogleSearch(params)
        results = search.get_dict()
        st.info("Search completed successfully.")
        return results
    except Exception as e:
        st.error(f"Error searching {search_type}: {str(e)}")
        return {"objective": objective, "results": [], "error": str(e)}
        
def map_url_pages(url: str, objective: str) -> Dict[str, Any]:
    """Map a website's pages using Firecrawl."""
    try:
        st.info(f"Mapping URL: {url}")
        search_query = generate_completion(
            "website search query generator",
            f"Generate a 1-2 word search query for the website: {url} based on the objective",
            f"Objective: {objective}"
        )
        st.info(f"Generated search query: {search_query}")
        map_status = app.map_url(url, params={"search": search_query})
        st.info(f"Firecrawl map_url response: {map_status}")
        
        if map_status.get('success') == True:  # Changed from 'status' to 'success'
            links = map_status.get('links', [])
            top_link = links[0] if links else None
            st.success(f"Mapping successful. Found {len(links)} links.")
            return {"objective": objective, "results": [top_link] if top_link else []}
        else:
            error_message = map_status.get('message', 'Unknown error')
            st.error(f"Firecrawl mapping failed: {error_message}")
            return {"objective": objective, "results": [], "error": f"Mapping failed: {error_message}"}
    except Exception as e:
        st.error(f"Error mapping URL pages: {str(e)}")
        return {"objective": objective, "results": [], "error": str(e)}

def scrape_url(url: str, objective: str) -> Dict[str, Any]:
    """Scrape a website using Firecrawl."""
    try:
        st.info(f"Scraping URL: {url}")
        scrape_status = app.scrape_url(
            url,
            params={'formats': ['markdown']}
        )
        st.info(f"Firecrawl scrape_url response received.")
        
        if isinstance(scrape_status, dict) and 'markdown' in scrape_status:
            markdown_content = scrape_status['markdown']
            if markdown_content:
                st.success("Successfully scraped content.")
                return {"objective": objective, "results": markdown_content}
            else:
                st.warning("No markdown content found in the scrape results.")
                return {"objective": objective, "results": None, "error": "No content scraped"}
        else:
            st.error(f"Unexpected response format from Firecrawl API: {scrape_status}")
            return {"objective": objective, "results": None, "error": "Unexpected API response format"}
    except Exception as e:
        st.error(f"Error scraping URL: {str(e)}")
        return {"objective": objective, "results": None, "error": str(e)}

def analyze_website_content(content: str, objective: str, role: str, instruction_option: str) -> Dict[str, Any]:
    """Analyze the scraped website content using OpenAI."""
    try:
        if not content:
            return {"objective": objective, "results": None, "error": "No content to analyze"}
        
        base_prompt = f"Ziel: {objective}\n\nInhalt: {content[:24000]}"  # Limit content to 8000 characters
        
        if instruction_option == "default":
            task = "Analyze the following website content from one or more URLs and extract key insights based on the objective. Provide a summary of the main points and any relevant details."
        elif instruction_option == "german":
            task = "Analysiere den folgenden Website-Inhalt von einer oder mehreren URLs und extrahiere wichtige Erkenntnisse basierend auf dem Ziel. Gib eine Zusammenfassung der Hauptpunkte und aller relevanten Details."
        elif instruction_option == "structured":
            task = "Extrahiere alle Fakten und Kerndaten aus dem folgenden Website-Inhalt. Strukturiere die Informationen als JSON-Ausgabe und inkludiere die Quelle für jede Information. Berücksichtige dabei das gegebene Ziel."
        elif instruction_option == "summary":
            task = "Schreibe für jeden Inhalt der folgenden Websites eine kurze Zusammenfassung. Berücksichtige dabei das gegebene Ziel und stelle sicher, dass jede Zusammenfassung klar der entsprechenden URL zugeordnet ist."
        
        full_prompt = f"{task}\n\n{base_prompt}"
        
        analysis = generate_completion(role, full_prompt, "")
        
        # Attempt to parse the analysis as JSON, but fall back to string if it fails
        try:
            analysis_results = json.loads(analysis)
        except json.JSONDecodeError:
            analysis_results = {"analysis": analysis}
        
        return {"objective": objective, "results": analysis_results}
    except Exception as e:
        st.error(f"Error analyzing website content: {str(e)}")
        return {"objective": objective, "results": None, "error": str(e)}


def main():
    st.header("Web Data Extraction")
    
    # Initialize session state variables
    if 'search_performed' not in st.session_state:
        st.session_state.search_performed = False
    if 'search_results' not in st.session_state:
        st.session_state.search_results = []
    if 'checkbox_states' not in st.session_state:
        st.session_state.checkbox_states = []

    # Input fields
    objective = st.text_input("Enter your web data extraction objective:")
    role = st.text_input("Enter the role for analysis (e.g., data analyst, financial expert):", value="data analyst")

    # Instruction option dropdown
    instruction_option = st.selectbox(
        "Select analysis instruction:",
        ["default", "german", "structured", "summary"],
        format_func=lambda x: {
            "default": "Default (English)",
            "german": "Default (German)",
            "structured": "Structured JSON output",
            "summary": "Summary for each content"
        }[x]
    )
    
    # Search type selection
    search_type = st.radio("Select search type:", ("Google Search", "Google News"))
    
    # Country and language selection
    col1, col2 = st.columns(2)
    with col1:
        country = st.selectbox("Select country:", list(COUNTRIES.keys()))
    with col2:
        language = st.selectbox("Select language:", list(LANGUAGES.keys()))
    
    # Search button
    if st.button("Search") and objective:
        st.session_state.search_performed = True
        with st.spinner("Searching..."):
            search_results = search_google(objective, objective, search_type, COUNTRIES[country], LANGUAGES[language])
            if search_results.get("error"):
                st.error(f"Error in {search_type}: {search_results['error']}")
            else:
                if search_type == "Google News":
                    st.session_state.search_results = search_results.get("news_results", [])[:5]
                else:
                    st.session_state.search_results = search_results.get("organic_results", [])[:5]
                st.session_state.checkbox_states = [False] * len(st.session_state.search_results)

    # Display search results and checkboxes
    if st.session_state.search_performed and st.session_state.search_results:
        st.subheader("Top 5 Search Results")
        for i, result in enumerate(st.session_state.search_results):
            col1, col2 = st.columns([0.1, 0.9])
            with col1:
                st.session_state.checkbox_states[i] = st.checkbox("", key=f"checkbox_{i}", value=st.session_state.checkbox_states[i])
            with col2:
                st.write(f"**{result['title']}**")
                st.write(f"Source: {result['link']}")

    # Optional: Enter a specific URL
    specific_url = st.text_input("Enter a specific URL to analyze (optional):")

    # Analysis button
    if st.button("Start Analysis"):
        selected_urls = [result['link'] for i, result in enumerate(st.session_state.search_results) if st.session_state.checkbox_states[i]]
        
        if specific_url:
            selected_urls.append(specific_url)
        
        if not selected_urls:
            st.warning("Please select at least one search result or enter a specific URL to analyze.")
            return
        
        with st.spinner("Analyzing..."):
            # Scrape all selected URLs
            all_scraped_content = []
            for url in selected_urls:
                st.info(f"Scraping URL: {url}")
                scrape_results = scrape_url(url, objective)
                if scrape_results.get("error"):
                    st.warning(f"Error in scraping URL {url}: {scrape_results['error']}")
                    continue
                
                if scrape_results.get("results"):
                    all_scraped_content.append(f"Content from {url}:\n{scrape_results['results']}\n\n")
                else:
                    st.warning(f"No content was scraped from the URL: {url}")
            
            if not all_scraped_content:
                st.error("No content was successfully scraped from any of the selected URLs.")
                return
            
            # Combine all scraped content
            combined_content = "\n".join(all_scraped_content)
            
            # Analyze combined content
            analysis_results = analyze_website_content(combined_content, objective, role, instruction_option)
            if analysis_results.get("error"):
                st.error(f"Error in analyzing content: {analysis_results['error']}")
                return
            
            # Display results
            st.success("Analysis complete!")
            st.subheader("Analysis Results")
            st.json(analysis_results["results"])

if __name__ == "__main__":
    main()
