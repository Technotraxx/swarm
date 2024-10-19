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

def generate_completion(role: str, task: str, content: str) -> str:
    """Generate a completion using OpenAI."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # or "gpt-4" if you have access
            messages=[
                {"role": "system", "content": f"You are a {role}. {task}"},
                {"role": "user", "content": content}
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

def analyze_website_content(content: str, objective: str, role: str) -> Dict[str, Any]:
    """Analyze the scraped website content using OpenAI."""
    try:
        if not content:
            return {"objective": objective, "results": None, "error": "No content to analyze"}
        
        task = "Analyze the following website content and extract key insights based on the objective."
        prompt = f"Objective: {objective}\n\nContent: {content[:4000]}"  # Limit content to 4000 characters to avoid token limits
        
        analysis = generate_completion(task, prompt, role)
        
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
    
    objective = st.text_input("Enter your web data extraction objective:")
    role = st.text_input("Enter the role for analysis (e.g., data analyst, financial expert):", value="data analyst")
    url = st.text_input("Enter the URL to analyze (optional):")
    
    # Add radio button for search type selection
    search_type = st.radio("Select search type:", ("Google Search", "Google News"))
    
    # Add dropdown menus for country and language selection
    col1, col2 = st.columns(2)
    with col1:
        country = st.selectbox("Select country:", list(COUNTRIES.keys()))
    with col2:
        language = st.selectbox("Select language:", list(LANGUAGES.keys()))
    
    if st.button("Start Analysis"):
        if not objective:
            st.warning("Please enter an objective.")
            return
        
        with st.spinner("Processing..."):
            if not url:
                # Perform search based on selected type, country, and language
                search_results = search_google(objective, objective, search_type, COUNTRIES[country], LANGUAGES[language])
                if search_results.get("error"):
                    st.error(f"Error in {search_type}: {search_results['error']}")
                    return
                
                # Display raw SerpAPI results in an expander
                with st.expander(f"View Raw {search_type} Results"):
                    st.json(search_results)
                
                # Extract and display top 5 results
                if search_type == "Google News":
                    results = search_results.get("news_results", [])
                else:
                    results = search_results.get("organic_results", [])
                
                if not results:
                    st.warning(f"No results found from {search_type}.")
                    return
                
                top_5_results = results[:5]
                df = pd.DataFrame(top_5_results)
                
                if 'title' in df.columns and 'link' in df.columns:
                    df = df[['title', 'link']]  # Select only title and link columns
                    st.subheader("Top 5 Search Results")
                    st.dataframe(df)
                    
                    # For now, we'll continue with the first result
                    url = df['link'].iloc[0]
                    st.info(f"Analyzing first result: {url}")
                else:
                    st.error("Unexpected result format. Unable to display results.")
                    return
            
            # Scrape URL
            scrape_results = scrape_url(url, objective)
            if scrape_results.get("error"):
                st.error(f"Error in scraping URL: {scrape_results['error']}")
                return
            
            if not scrape_results.get("results"):
                st.error("No content was scraped from the URL.")
                return
            
            # Analyze content
            analysis_results = analyze_website_content(scrape_results["results"], objective, role)
            if analysis_results.get("error"):
                st.error(f"Error in analyzing content: {analysis_results['error']}")
                return
            
            # Display results
            st.success("Analysis complete!")
            st.subheader("Analysis Results")
            st.json(analysis_results["results"])

if __name__ == "__main__":
    main()
